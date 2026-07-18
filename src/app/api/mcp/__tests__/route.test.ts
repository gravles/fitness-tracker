import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { format, addDays, subDays } from 'date-fns';

// ─── Supabase admin mock ─────────────────────────────────────────────────────
// Chainable, thenable query builder with per-table FIFO response queues.

const tableResponses: Record<string, Array<{ data: unknown; error: unknown }>> = {};
const fromCalls: Array<{ table: string; method?: string; payload?: unknown; filters: unknown[][] }> = [];

function queueResponse(table: string, data: unknown, error: unknown = null) {
    (tableResponses[table] ??= []).push({ data, error });
}

function createBuilder(table: string) {
    const call: { table: string; method?: string; payload?: unknown; filters: unknown[][] } = { table, filters: [] };
    fromCalls.push(call);

    const respond = () => {
        const queue = tableResponses[table];
        return queue?.length ? queue.shift()! : { data: null, error: null };
    };

    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'gte', 'lte', 'in', 'order', 'limit']) {
        builder[m] = vi.fn((...a: unknown[]) => {
            if (['insert', 'update', 'upsert', 'delete'].includes(m)) {
                call.method = m;
                call.payload = a[0];
            }
            if (['eq', 'gte', 'lte', 'in'].includes(m)) call.filters.push([m, ...a]);
            return builder;
        });
    }
    builder.single = vi.fn(() => Promise.resolve(respond()));
    builder.maybeSingle = vi.fn(() => Promise.resolve(respond()));
    // Awaiting the builder directly (no .single()) resolves the next queued response
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(respond()).then(resolve, reject);
    return builder;
}

vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: { from: vi.fn((table: string) => createBuilder(table)) },
}));

import { POST } from '../route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TODAY = format(new Date(), 'yyyy-MM-dd');
const day = (offset: number) => format(offset >= 0 ? addDays(new Date(), offset) : subDays(new Date(), -offset), 'yyyy-MM-dd');

function rpcRequest(method: string, params: object = {}): NextRequest {
    return new NextRequest('http://localhost:3000/api/mcp?key=test-key', {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        headers: { 'Content-Type': 'application/json' },
    });
}

/** Authorize, call one tool, and return { data, isError } from the tool result. */
async function callTool(name: string, args: object = {}) {
    queueResponse('mcp_api_keys', { user_id: 'test-user-id' });
    queueResponse('user_settings', null); // timezone lookup for "today" → null = server clock
    const response = await POST(rpcRequest('tools/call', { name, arguments: args }));
    const json = await response.json();
    const result = json.result;
    return { data: JSON.parse(result.content[0].text), isError: result.isError === true };
}

function findCall(table: string, method?: string) {
    return fromCalls.find(c => c.table === table && (!method || c.method === method));
}

const STORED_TEMPLATE = {
    id: 'tpl-1',
    name: 'Upper A',
    description: 'Heavy upper',
    exercises: [{ name: 'Bench Press', sets: 4, reps: '8-12', rest: 90, order: 1 }],
    fallback_exercises: [{ name: 'Push-ups', sets: 3, reps: '15-20', rest: 60, order: 1 }],
    estimated_duration: 45,
    updated_at: '2026-07-01T00:00:00Z',
};

describe('POST /api/mcp — coach scheduling tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const key of Object.keys(tableResponses)) delete tableResponses[key];
        fromCalls.length = 0;
    });

    it('rejects tool calls without a valid API key', async () => {
        queueResponse('mcp_api_keys', null);
        const response = await POST(rpcRequest('tools/call', { name: 'get_schedule', arguments: {} }));
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json.error.message).toContain('Unauthorized');
    });

    it('lists the new coach tools in tools/list', async () => {
        queueResponse('mcp_api_keys', { user_id: 'test-user-id' });
        const response = await POST(rpcRequest('tools/list'));
        const json = await response.json();

        const names = json.result.tools.map((t: { name: string }) => t.name);
        for (const tool of [
            'save_workout_template', 'get_workout_templates', 'schedule_workout',
            'get_schedule', 'update_scheduled_workout', 'log_workout',
        ]) {
            expect(names).toContain(tool);
        }
    });

    describe('save_workout_template', () => {
        it('creates a new template with mapped exercise fields', async () => {
            queueResponse('workout_templates', []); // no existing templates
            queueResponse('workout_templates', { id: 'tpl-new', name: 'Upper A' }); // insert

            const { data, isError } = await callTool('save_workout_template', {
                name: 'Upper A',
                description: 'Heavy upper',
                exercises: [
                    { exercise_name: 'Bench Press', sets: 4, rep_range: '8-12', rest_seconds: 90, order: 1 },
                    { exercise_name: 'Barbell Row', sets: 4, rep_range: '8-12', order: 2 },
                ],
                fallback_exercises: [
                    { exercise_name: 'Push-ups', sets: 3, rep_range: '15-20', order: 1 },
                ],
            });

            expect(isError).toBe(false);
            expect(data.action).toBe('created');
            expect(data.exercise_count).toBe(2);
            expect(data.fallback_count).toBe(1);

            const insert = findCall('workout_templates', 'insert');
            const payload = insert?.payload as Record<string, unknown>;
            expect(payload.author_id).toBe('test-user-id');
            expect(payload.exercises).toEqual([
                expect.objectContaining({ name: 'Bench Press', sets: 4, reps: '8-12', rest: 90, order: 1 }),
                expect.objectContaining({ name: 'Barbell Row', sets: 4, reps: '8-12', rest: 60, order: 2 }),
            ]);
        });

        it('updates an existing template by name, case-insensitively', async () => {
            queueResponse('workout_templates', [{ id: 'tpl-1', name: 'upper a' }]);
            queueResponse('workout_templates', { id: 'tpl-1', name: 'Upper A' }); // update

            const { data, isError } = await callTool('save_workout_template', {
                name: 'Upper A',
                exercises: [{ exercise_name: 'Bench Press', sets: 4, rep_range: '8-12' }],
            });

            expect(isError).toBe(false);
            expect(data.action).toBe('updated');
            expect(findCall('workout_templates', 'update')).toBeTruthy();
        });

        it('rejects a template without exercises', async () => {
            const { data, isError } = await callTool('save_workout_template', { name: 'Upper A', exercises: [] });

            expect(isError).toBe(true);
            expect(data).toContain('exercises');
        });
    });

    describe('get_workout_templates', () => {
        it('returns templates with MCP-shaped exercises and fallbacks', async () => {
            queueResponse('workout_templates', [STORED_TEMPLATE]);

            const { data, isError } = await callTool('get_workout_templates');

            expect(isError).toBe(false);
            expect(data).toHaveLength(1);
            expect(data[0].exercises[0]).toEqual(
                expect.objectContaining({ exercise_name: 'Bench Press', sets: 4, rep_range: '8-12', rest_seconds: 90 })
            );
            expect(data[0].fallback_exercises[0].exercise_name).toBe('Push-ups');
        });

        it('suggests +5 lbs when every set hit the top of the rep range last session', async () => {
            queueResponse('workout_templates', [STORED_TEMPLATE]);
            queueResponse('workouts', [{ id: 'w-1', date: day(-2) }]);
            queueResponse('workout_exercises', [{ id: 'we-1', workout_id: 'w-1', exercise_name: 'Bench Press' }]);
            queueResponse('workout_sets', [
                { exercise_id: 'we-1', weight: 185, reps: 12, completed: true },
                { exercise_id: 'we-1', weight: 185, reps: 12, completed: true },
                { exercise_id: 'we-1', weight: 185, reps: 12, completed: true },
                { exercise_id: 'we-1', weight: 185, reps: 12, completed: true },
            ]);

            const { data, isError } = await callTool('get_workout_templates');

            expect(isError).toBe(false);
            expect(data[0].exercises[0]).toEqual(expect.objectContaining({
                last_weight_lbs: 185,
                suggested_weight_lbs: 190,
                progression: 'increase',
            }));
        });

        it('repeats the last weight when the rep target was missed', async () => {
            queueResponse('workout_templates', [STORED_TEMPLATE]);
            queueResponse('workouts', [{ id: 'w-1', date: day(-2) }]);
            queueResponse('workout_exercises', [{ id: 'we-1', workout_id: 'w-1', exercise_name: 'bench press' }]); // case-insensitive match
            queueResponse('workout_sets', [
                { exercise_id: 'we-1', weight: 185, reps: 12, completed: true },
                { exercise_id: 'we-1', weight: 185, reps: 10, completed: true }, // missed the top
                { exercise_id: 'we-1', weight: 185, reps: 9, completed: true },
                { exercise_id: 'we-1', weight: 185, reps: 8, completed: true },
            ]);

            const { data } = await callTool('get_workout_templates');

            expect(data[0].exercises[0]).toEqual(expect.objectContaining({
                last_weight_lbs: 185,
                last_reps: [12, 10, 9, 8],
                suggested_weight_lbs: 185,
                progression: 'repeat',
            }));
        });

        it('leaves exercises untouched without weighted history', async () => {
            queueResponse('workout_templates', [STORED_TEMPLATE]);
            queueResponse('workouts', []); // no recent sessions

            const { data } = await callTool('get_workout_templates');

            expect(data[0].exercises[0].suggested_weight_lbs).toBeUndefined();
            expect(data[0].exercises[0].progression).toBeUndefined();
        });
    });

    describe('schedule_workout', () => {
        it('rejects malformed dates with a clear message', async () => {
            const { data, isError } = await callTool('schedule_workout', { date: '07/06/2026', activity_type: 'Rowing' });

            expect(isError).toBe(true);
            expect(data).toContain('YYYY-MM-DD');
        });

        it('rejects passing both template_name and activity_type', async () => {
            const { data, isError } = await callTool('schedule_workout', {
                date: day(1), template_name: 'Upper A', activity_type: 'Rowing',
            });

            expect(isError).toBe(true);
            expect(data).toContain('exactly one');
        });

        it('errors with available names when the template does not exist', async () => {
            queueResponse('workout_templates', [{ ...STORED_TEMPLATE, name: 'Lower A' }]);

            const { data, isError } = await callTool('schedule_workout', { date: day(1), template_name: 'Upper A' });

            expect(isError).toBe(true);
            expect(data).toContain('"Lower A"');
        });

        it('schedules a single ad-hoc cardio workout as planned', async () => {
            queueResponse('scheduled_workouts', [{ id: 'sw-1', scheduled_date: day(2) }]);

            const { data, isError } = await callTool('schedule_workout', {
                date: day(2), activity_type: 'Rowing', duration_mins: 30, notes: 'Zone 2',
            });

            expect(isError).toBe(false);
            expect(data.scheduled_count).toBe(1);

            const rows = findCall('scheduled_workouts', 'insert')?.payload as Record<string, unknown>[];
            expect(rows).toHaveLength(1);
            expect(rows[0]).toEqual(expect.objectContaining({
                title: 'Rowing',
                status: 'scheduled',
                duration_minutes: 30,
                scheduled_time: '12:00:00',
                notes: 'Zone 2',
            }));
        });

        it('expands a recurrence onto matching weekdays only', async () => {
            queueResponse('workout_templates', [STORED_TEMPLATE]);
            queueResponse('scheduled_workouts', []);

            const { isError } = await callTool('schedule_workout', {
                date: day(0),
                template_name: 'Upper A',
                recurrence: { days_of_week: ['mon', 'thu'], until: day(21) },
            });

            expect(isError).toBe(false);
            const rows = findCall('scheduled_workouts', 'insert')?.payload as Record<string, unknown>[];
            expect(rows.length).toBeGreaterThanOrEqual(5); // 3 weeks × 2 days ± boundary days
            for (const row of rows) {
                const weekday = new Date((row.scheduled_date as string) + 'T00:00:00Z').getUTCDay();
                expect([1, 4]).toContain(weekday); // Monday or Thursday
                expect(row.template_id).toBe('tpl-1');
            }
        });

        it('caps recurrence at 90 days and reports the truncation', async () => {
            queueResponse('workout_templates', [STORED_TEMPLATE]);
            queueResponse('scheduled_workouts', []);

            const { data, isError } = await callTool('schedule_workout', {
                date: day(0),
                template_name: 'Upper A',
                recurrence: { days_of_week: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], until: day(200) },
            });

            expect(isError).toBe(false);
            expect(data.note).toContain('90');

            const rows = findCall('scheduled_workouts', 'insert')?.payload as Record<string, unknown>[];
            const cap = day(90);
            for (const row of rows) {
                expect((row.scheduled_date as string) <= cap).toBe(true);
            }
        });

        it('rejects invalid days_of_week values', async () => {
            queueResponse('workout_templates', [STORED_TEMPLATE]);

            const { data, isError } = await callTool('schedule_workout', {
                date: day(0), template_name: 'Upper A',
                recurrence: { days_of_week: ['monday'], until: day(30) },
            });

            expect(isError).toBe(true);
            expect(data).toContain('days_of_week');
        });
    });

    describe('get_schedule', () => {
        it('derives planned / missed / completed / skipped statuses', async () => {
            queueResponse('scheduled_workouts', [
                { id: 'sw-1', scheduled_date: day(-2), scheduled_time: '12:00:00', title: 'Upper A', status: 'scheduled', use_fallback: false, template: null },
                { id: 'sw-2', scheduled_date: day(1), scheduled_time: '12:00:00', title: 'Upper A', status: 'scheduled', use_fallback: false, template: null },
                { id: 'sw-3', scheduled_date: day(-1), scheduled_time: '12:00:00', title: 'Rowing', status: 'completed', use_fallback: false, completed_workout_id: 'w-9', template: null },
                { id: 'sw-4', scheduled_date: day(-1), scheduled_time: '18:00:00', title: 'Upper A', status: 'skipped', skipped_reason: 'sick', use_fallback: false, template: null },
            ]);

            const { data, isError } = await callTool('get_schedule', { start_date: day(-3), end_date: day(3) });

            expect(isError).toBe(false);
            const byId = Object.fromEntries(data.map((w: { id: string }) => [w.id, w]));
            expect(byId['sw-1'].status).toBe('missed');
            expect(byId['sw-2'].status).toBe('planned');
            expect(byId['sw-3'].status).toBe('completed');
            expect(byId['sw-3'].completed_workout_id).toBe('w-9');
            expect(byId['sw-4'].status).toBe('skipped');
            expect(byId['sw-4'].skipped_reason).toBe('sick');
        });

        it('returns fallback exercises when the entry was swapped to the short version', async () => {
            queueResponse('scheduled_workouts', [
                { id: 'sw-1', scheduled_date: day(1), scheduled_time: '12:00:00', title: 'Upper A', status: 'scheduled', use_fallback: true, template: STORED_TEMPLATE },
            ]);

            const { data } = await callTool('get_schedule');

            expect(data[0].using_fallback).toBe(true);
            expect(data[0].exercises[0].exercise_name).toBe('Push-ups');
        });

        it('rejects an end_date before start_date', async () => {
            const { data, isError } = await callTool('get_schedule', { start_date: day(3), end_date: day(1) });

            expect(isError).toBe(true);
            expect(data).toContain('before start_date');
        });

        it('auto-links a stale entry to a same-day workout matching the template name', async () => {
            // 1: initial select, 2: already-linked check, 3: update
            queueResponse('scheduled_workouts', [
                { id: 'sw-1', scheduled_date: day(-1), scheduled_time: '12:00:00', title: 'Session', status: 'scheduled', use_fallback: false, completed_workout_id: null, template: STORED_TEMPLATE },
            ]);
            queueResponse('workouts', [{ id: 'w-42', date: day(-1), activity_type: 'Upper A' }]);
            queueResponse('scheduled_workouts', []);
            queueResponse('scheduled_workouts', null);

            const { data, isError } = await callTool('get_schedule', { start_date: day(-2), end_date: day(0) });

            expect(isError).toBe(false);
            expect(data[0].status).toBe('completed');
            expect(data[0].completed_workout_id).toBe('w-42');

            const patch = findCall('scheduled_workouts', 'update')?.payload as Record<string, unknown>;
            expect(patch.status).toBe('completed');
            expect(patch.completed_workout_id).toBe('w-42');
        });

        it('still reports missed when the same-day workout does not match', async () => {
            queueResponse('scheduled_workouts', [
                { id: 'sw-1', scheduled_date: day(-1), scheduled_time: '12:00:00', title: 'Upper A', status: 'scheduled', use_fallback: false, completed_workout_id: null, template: null },
            ]);
            queueResponse('workouts', [{ id: 'w-42', date: day(-1), activity_type: 'Rowing' }]);
            queueResponse('scheduled_workouts', []);

            const { data } = await callTool('get_schedule', { start_date: day(-2), end_date: day(0) });

            expect(data[0].status).toBe('missed');
            expect(findCall('scheduled_workouts', 'update')).toBeUndefined();
        });

        it('does not steal a workout already linked to another entry', async () => {
            queueResponse('scheduled_workouts', [
                { id: 'sw-1', scheduled_date: day(-1), scheduled_time: '12:00:00', title: 'Upper A', status: 'scheduled', use_fallback: false, completed_workout_id: null, template: null },
            ]);
            queueResponse('workouts', [{ id: 'w-42', date: day(-1), activity_type: 'Upper A' }]);
            queueResponse('scheduled_workouts', [{ completed_workout_id: 'w-42' }]);

            const { data } = await callTool('get_schedule', { start_date: day(-2), end_date: day(0) });

            expect(data[0].status).toBe('missed');
            expect(findCall('scheduled_workouts', 'update')).toBeUndefined();
        });
    });

    describe('update_scheduled_workout', () => {
        it('skips an entry with a reason', async () => {
            queueResponse('scheduled_workouts', {
                id: 'sw-1', scheduled_date: day(1), scheduled_time: '12:00:00',
                title: 'Upper A', status: 'skipped', skipped_reason: 'travelling', use_fallback: false, notes: null,
            });

            const { data, isError } = await callTool('update_scheduled_workout', {
                scheduled_workout_id: 'sw-1', status: 'skipped', reason: 'travelling',
            });

            expect(isError).toBe(false);
            expect(data.updated.status).toBe('skipped');
            expect(data.updated.skipped_reason).toBe('travelling');

            const patch = findCall('scheduled_workouts', 'update')?.payload as Record<string, unknown>;
            expect(patch.status).toBe('skipped');
            expect(patch.skipped_reason).toBe('travelling');
        });

        it('moves an entry to a new date', async () => {
            queueResponse('scheduled_workouts', {
                id: 'sw-1', scheduled_date: day(4), scheduled_time: '12:00:00',
                title: 'Upper A', status: 'scheduled', skipped_reason: null, use_fallback: false, notes: null,
            });

            const { data, isError } = await callTool('update_scheduled_workout', {
                scheduled_workout_id: 'sw-1', new_date: day(4),
            });

            expect(isError).toBe(false);
            expect(data.updated.status).toBe('planned');

            const patch = findCall('scheduled_workouts', 'update')?.payload as Record<string, unknown>;
            expect(patch.scheduled_date).toBe(day(4));
        });

        it('errors when the entry does not exist', async () => {
            queueResponse('scheduled_workouts', null); // maybeSingle finds nothing

            const { data, isError } = await callTool('update_scheduled_workout', {
                scheduled_workout_id: 'nope', use_fallback: true,
            });

            expect(isError).toBe(true);
            expect(data).toContain('not found');
        });

        it('rejects a reason without status skipped', async () => {
            const { data, isError } = await callTool('update_scheduled_workout', {
                scheduled_workout_id: 'sw-1', reason: 'busy',
            });

            expect(isError).toBe(true);
            expect(data).toContain('skipped');
        });
    });

    describe('log_workout (extended)', () => {
        it('logs strength exercises with sets and marks the matching scheduled entry completed', async () => {
            queueResponse('workouts', { id: 'w-1', date: TODAY, activity_type: 'Strength Training' }); // insert
            queueResponse('workout_exercises', { id: 'ex-1' });
            queueResponse('workout_sets', null);
            queueResponse('daily_logs', null);
            queueResponse('scheduled_workouts', [{ id: 'sw-1', title: 'Upper A' }]); // match by date
            queueResponse('scheduled_workouts', null); // update to completed

            const { data, isError } = await callTool('log_workout', {
                activity_type: 'Strength Training',
                duration_mins: 60,
                intensity: 'Hard',
                exercises: [
                    { exercise_name: 'Bench Press', sets: [{ reps: 8, weight_lbs: 155 }, { reps: 7, weight_lbs: 155 }] },
                ],
            });

            expect(isError).toBe(false);
            expect(data.completed_scheduled_workout).toEqual({ id: 'sw-1', title: 'Upper A' });

            const sets = findCall('workout_sets', 'insert')?.payload as Record<string, unknown>[];
            expect(sets).toEqual([
                expect.objectContaining({ exercise_id: 'ex-1', set_number: 1, reps: 8, weight: 155, completed: true }),
                expect.objectContaining({ exercise_id: 'ex-1', set_number: 2, reps: 7, weight: 155, completed: true }),
            ]);

            const schedUpdate = fromCalls.find(c => c.table === 'scheduled_workouts' && c.method === 'update');
            expect((schedUpdate?.payload as Record<string, unknown>).status).toBe('completed');
            expect((schedUpdate?.payload as Record<string, unknown>).completed_workout_id).toBe('w-1');
        });

        it('stores heart-rate fields from a watch session', async () => {
            queueResponse('workouts', { id: 'w-hr', date: TODAY, activity_type: 'Strength Training' });
            queueResponse('daily_logs', null);
            queueResponse('scheduled_workouts', []); // no scheduled entry to match

            const { isError } = await callTool('log_workout', {
                activity_type: 'Strength Training', duration_mins: 45,
                average_heartrate: 128, max_heartrate: 171,
            });

            expect(isError).toBe(false);
            const insert = findCall('workouts', 'insert')?.payload as Record<string, unknown>;
            expect(insert.average_heartrate).toBe(128);
            expect(insert.max_heartrate).toBe(171);
        });

        it('marks an explicit scheduled_workout_id completed', async () => {
            queueResponse('workouts', { id: 'w-2', date: TODAY, activity_type: 'Rowing' });
            queueResponse('daily_logs', null);
            queueResponse('scheduled_workouts', { id: 'sw-7', title: 'Rowing' }); // targeted update

            const { data, isError } = await callTool('log_workout', {
                activity_type: 'Rowing', duration_mins: 30, intensity: 'Moderate', scheduled_workout_id: 'sw-7',
            });

            expect(isError).toBe(false);
            expect(data.completed_scheduled_workout.id).toBe('sw-7');
        });

        it('errors when the explicit scheduled_workout_id is unknown', async () => {
            queueResponse('workouts', { id: 'w-3', date: TODAY, activity_type: 'Rowing' });
            queueResponse('daily_logs', null);
            queueResponse('scheduled_workouts', null); // maybeSingle finds nothing

            const { data, isError } = await callTool('log_workout', {
                activity_type: 'Rowing', scheduled_workout_id: 'nope',
            });

            expect(isError).toBe(true);
            expect(data).toContain('not found');
        });

        it('still logs a plain cardio workout without schedule matching side effects', async () => {
            queueResponse('workouts', { id: 'w-4', date: TODAY, activity_type: 'Running' });
            queueResponse('daily_logs', null);
            queueResponse('scheduled_workouts', []); // nothing planned that day

            const { data, isError } = await callTool('log_workout', {
                activity_type: 'Running', duration_mins: 30, intensity: 'Moderate',
            });

            expect(isError).toBe(false);
            expect(data.completed_scheduled_workout).toBeNull();
        });
    });

    describe('timezone-aware today', () => {
        it("resolves date defaults in the user's timezone, not the server clock", async () => {
            vi.useFakeTimers();
            try {
                // 03:00 UTC on Jan 2 = 10 PM Jan 1 in Toronto — the exact evening-rollover bug
                vi.setSystemTime(new Date('2026-01-02T03:00:00Z'));

                queueResponse('mcp_api_keys', { user_id: 'test-user-id' });
                queueResponse('user_settings', { timezone: 'America/Toronto' });
                queueResponse('daily_logs', null); // existing log lookup
                queueResponse('daily_logs', null); // upsert

                const response = await POST(rpcRequest('tools/call', {
                    name: 'log_food',
                    arguments: { name: 'Late snack', calories: 100 },
                }));
                const json = await response.json();
                expect(json.result.isError).toBeFalsy();

                const upsert = findCall('daily_logs', 'upsert')?.payload as Record<string, unknown>;
                expect(upsert.date).toBe('2026-01-01');
            } finally {
                vi.useRealTimers();
            }
        });

        it('falls back to the server clock when no timezone is stored', async () => {
            vi.useFakeTimers();
            try {
                vi.setSystemTime(new Date('2026-01-02T03:00:00Z'));

                queueResponse('mcp_api_keys', { user_id: 'test-user-id' });
                queueResponse('user_settings', null); // no timezone stored
                queueResponse('daily_logs', null);
                queueResponse('daily_logs', null);

                const response = await POST(rpcRequest('tools/call', {
                    name: 'log_food',
                    arguments: { name: 'Late snack', calories: 100 },
                }));
                await response.json();

                const upsert = findCall('daily_logs', 'upsert')?.payload as Record<string, unknown>;
                expect(upsert.date).toBe(format(new Date(), 'yyyy-MM-dd'));
            } finally {
                vi.useRealTimers();
            }
        });
    });
});
