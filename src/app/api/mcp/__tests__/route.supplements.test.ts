import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { format, addDays, subDays } from 'date-fns';

// ─── Supabase admin mock ─────────────────────────────────────────────────────
// Chainable, thenable query builder with per-table FIFO response queues.
// Mirrors the harness in route.meals.test.ts, plus `.not()` which the
// supplement tools use for null-column filters.

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
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'gte', 'lte', 'in', 'not', 'order', 'limit']) {
        builder[m] = vi.fn((...a: unknown[]) => {
            if (['insert', 'update', 'upsert', 'delete'].includes(m)) {
                call.method = m;
                call.payload = a[0];
            }
            if (['eq', 'gte', 'lte', 'in', 'not'].includes(m)) call.filters.push([m, ...a]);
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

const STORED_SUPPLEMENT = {
    id: 'supp-1',
    name: 'Creatine',
    kind: 'supplement',
    dose_amount: 5,
    dose_unit: 'g',
    form: 'powder',
    notes: null,
    updated_at: '2026-07-01T00:00:00Z',
};

describe('POST /api/mcp — supplement & medication tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const key of Object.keys(tableResponses)) delete tableResponses[key];
        fromCalls.length = 0;
    });

    it('lists the supplement tools in tools/list', async () => {
        queueResponse('mcp_api_keys', { user_id: 'test-user-id' });
        const response = await POST(rpcRequest('tools/list'));
        const json = await response.json();

        const names = json.result.tools.map((t: { name: string }) => t.name);
        for (const tool of [
            'save_supplement', 'get_supplements', 'schedule_supplement',
            'log_supplement', 'get_supplement_schedule', 'update_scheduled_supplement',
        ]) {
            expect(names).toContain(tool);
        }
    });

    describe('save_supplement', () => {
        it('creates a new catalogue entry', async () => {
            queueResponse('supplements', []); // no existing entries
            queueResponse('supplements', { id: 'supp-new', name: 'Creatine', kind: 'supplement' }); // insert

            const { data, isError } = await callTool('save_supplement', {
                name: 'Creatine', dose_amount: 5, dose_unit: 'g', form: 'powder',
            });

            expect(isError).toBe(false);
            expect(data.action).toBe('created');
            expect(data.supplement_id).toBe('supp-new');

            const insert = findCall('supplements', 'insert');
            const payload = insert?.payload as Record<string, unknown>;
            expect(payload.user_id).toBe('test-user-id');
            expect(payload.kind).toBe('supplement');
            expect(payload.dose_amount).toBe(5);
        });

        it('updates an existing entry by name, case-insensitively', async () => {
            queueResponse('supplements', [{ id: 'supp-1', name: 'creatine', kind: 'supplement', dose_amount: 5, dose_unit: 'g' }]);
            queueResponse('supplements', { id: 'supp-1', name: 'Creatine', kind: 'supplement' }); // update

            const { data, isError } = await callTool('save_supplement', { name: 'Creatine', dose_amount: 10 });

            expect(isError).toBe(false);
            expect(data.action).toBe('updated');
            expect(findCall('supplements', 'update')).toBeTruthy();
        });

        it('rejects an unknown kind', async () => {
            const { data, isError } = await callTool('save_supplement', { name: 'Aspirin', kind: 'drug' });

            expect(isError).toBe(true);
            expect(data).toContain('kind must be one of');
        });

        it('requires a name', async () => {
            const { data, isError } = await callTool('save_supplement', { dose_amount: 5 });

            expect(isError).toBe(true);
            expect(data).toContain('name is required');
        });
    });

    describe('get_supplements', () => {
        it('returns the catalogue with an upcoming-schedule summary', async () => {
            queueResponse('supplements', [STORED_SUPPLEMENT]);
            queueResponse('supplement_doses', [
                { supplement_id: 'supp-1', scheduled_date: day(1), scheduled_time: '08:00:00' },
                { supplement_id: 'supp-1', scheduled_date: day(1), scheduled_time: '20:00:00' },
                { supplement_id: 'supp-1', scheduled_date: day(2), scheduled_time: '08:00:00' },
            ]);

            const { data, isError } = await callTool('get_supplements');

            expect(isError).toBe(false);
            expect(data).toHaveLength(1);
            expect(data[0].name).toBe('Creatine');
            expect(data[0].active_schedule.times).toEqual(['08:00', '20:00']);
            expect(data[0].active_schedule.upcoming_dose_count).toBe(3);
        });

        it('returns a null schedule for an unscheduled entry', async () => {
            queueResponse('supplements', [STORED_SUPPLEMENT]);
            queueResponse('supplement_doses', []);

            const { data, isError } = await callTool('get_supplements');

            expect(isError).toBe(false);
            expect(data[0].active_schedule).toBeNull();
        });
    });

    describe('schedule_supplement', () => {
        it('errors with available names when the supplement does not exist', async () => {
            queueResponse('supplements', [{ ...STORED_SUPPLEMENT, name: 'Vitamin D' }]);

            const { data, isError } = await callTool('schedule_supplement', {
                supplement_name: 'Creatine', date: day(1),
            });

            expect(isError).toBe(true);
            expect(data).toContain('"Vitamin D"');
            expect(data).toContain('save_supplement');
        });

        it('rejects a malformed time', async () => {
            queueResponse('supplements', [STORED_SUPPLEMENT]);

            const { data, isError } = await callTool('schedule_supplement', {
                supplement_name: 'Creatine', date: day(1), times: ['8am'],
            });

            expect(isError).toBe(true);
            expect(data).toContain('HH:MM');
        });

        it('schedules a single dose with a reminder at dose time by default', async () => {
            queueResponse('supplements', [STORED_SUPPLEMENT]);
            queueResponse('supplement_doses', [{ id: 'dose-1', scheduled_date: day(1), scheduled_time: '08:00:00' }]);

            const { data, isError } = await callTool('schedule_supplement', {
                supplement_name: 'Creatine', date: day(1),
            });

            expect(isError).toBe(false);
            expect(data.scheduled_count).toBe(1);
            expect(data.reminders).toBe(true);

            const rows = findCall('supplement_doses', 'insert')?.payload as Record<string, unknown>[];
            expect(rows).toHaveLength(1);
            expect(rows[0]).toEqual(expect.objectContaining({
                supplement_id: 'supp-1', name: 'Creatine', dose_amount: 5, dose_unit: 'g',
                scheduled_time: '08:00:00', status: 'planned', remind_minutes: 0,
            }));
        });

        it('disables reminders with remind: false', async () => {
            queueResponse('supplements', [STORED_SUPPLEMENT]);
            queueResponse('supplement_doses', []);

            const { isError } = await callTool('schedule_supplement', {
                supplement_name: 'Creatine', date: day(1), remind: false,
            });

            expect(isError).toBe(false);
            const rows = findCall('supplement_doses', 'insert')?.payload as Record<string, unknown>[];
            expect(rows[0].remind_minutes).toBeNull();
        });

        it('multiplies recurrence dates by times of day', async () => {
            queueResponse('supplements', [STORED_SUPPLEMENT]);
            queueResponse('supplement_doses', []);

            const { isError } = await callTool('schedule_supplement', {
                supplement_name: 'Creatine', date: day(0), times: ['08:00', '20:00'],
                recurrence: { days_of_week: ['mon', 'wed', 'fri'], until: day(21) },
            });

            expect(isError).toBe(false);
            const rows = findCall('supplement_doses', 'insert')?.payload as Record<string, unknown>[];
            // 3 weeks × 3 weekdays ± boundary days, × 2 times each
            expect(rows.length).toBeGreaterThanOrEqual(14);
            expect(rows.length % 2).toBe(0);
            for (const row of rows) {
                const weekday = new Date((row.scheduled_date as string) + 'T00:00:00').getDay();
                expect([1, 3, 5]).toContain(weekday); // Mon, Wed, Fri
                expect(['08:00:00', '20:00:00']).toContain(row.scheduled_time);
            }
        });

        it('caps recurrence at 90 days and reports the truncation', async () => {
            queueResponse('supplements', [STORED_SUPPLEMENT]);
            queueResponse('supplement_doses', []);

            const { data, isError } = await callTool('schedule_supplement', {
                supplement_name: 'Creatine', date: day(0),
                recurrence: { days_of_week: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], until: day(200) },
            });

            expect(isError).toBe(false);
            expect(data.note).toContain('90');

            const rows = findCall('supplement_doses', 'insert')?.payload as Record<string, unknown>[];
            const cap = day(90);
            for (const row of rows) {
                expect((row.scheduled_date as string) <= cap).toBe(true);
            }
        });
    });

    describe('log_supplement', () => {
        it('marks a scheduled dose taken by dose_id', async () => {
            queueResponse('supplement_doses', {
                id: 'dose-1', name: 'Creatine', scheduled_date: day(0), scheduled_time: '08:00:00',
                dose_amount: 5, dose_unit: 'g',
            });

            const { data, isError } = await callTool('log_supplement', { dose_id: 'dose-1' });

            expect(isError).toBe(false);
            expect(data.logged.name).toBe('Creatine');
            expect(data.logged.time).toBe('08:00');

            const patch = findCall('supplement_doses', 'update')?.payload as Record<string, unknown>;
            expect(patch.status).toBe('taken');
            expect(patch.taken_at).toBeTruthy();
        });

        it('errors when the dose_id is unknown', async () => {
            queueResponse('supplement_doses', null);

            const { data, isError } = await callTool('log_supplement', { dose_id: 'nope' });

            expect(isError).toBe(true);
            expect(data).toContain('not found');
        });

        it('logs an ad-hoc intake with catalogue defaults when the name matches', async () => {
            queueResponse('supplements', [STORED_SUPPLEMENT]);
            queueResponse('supplement_doses', {
                id: 'dose-adhoc', name: 'Creatine', scheduled_date: day(0), scheduled_time: null,
                dose_amount: 5, dose_unit: 'g',
            });

            const { data, isError } = await callTool('log_supplement', { supplement_name: 'creatine' });

            expect(isError).toBe(false);
            expect(data.logged.dose_amount).toBe(5);
            expect(data.note).toBeUndefined();

            const insert = findCall('supplement_doses', 'insert')?.payload as Record<string, unknown>;
            expect(insert.supplement_id).toBe('supp-1');
            expect(insert.status).toBe('taken');
            expect(insert.dose_amount).toBe(5);
        });

        it('allows an unknown ad-hoc name and suggests saving it', async () => {
            queueResponse('supplements', []);
            queueResponse('supplement_doses', {
                id: 'dose-adhoc', name: 'Ibuprofen', scheduled_date: day(0), scheduled_time: null,
                dose_amount: 400, dose_unit: 'mg',
            });

            const { data, isError } = await callTool('log_supplement', {
                supplement_name: 'Ibuprofen', dose_amount: 400, dose_unit: 'mg',
            });

            expect(isError).toBe(false);
            expect(data.note).toContain('save_supplement');

            const insert = findCall('supplement_doses', 'insert')?.payload as Record<string, unknown>;
            expect(insert.supplement_id).toBeNull();
            expect(insert.dose_amount).toBe(400);
        });

        it('rejects passing both dose_id and supplement_name', async () => {
            const { data, isError } = await callTool('log_supplement', {
                dose_id: 'dose-1', supplement_name: 'Creatine',
            });

            expect(isError).toBe(true);
            expect(data).toContain('exactly one');
        });
    });

    describe('get_supplement_schedule', () => {
        it('groups doses by day and computes adherence from past doses only', async () => {
            queueResponse('supplement_doses', [
                { id: 'd-1', supplement_id: 'supp-1', name: 'Creatine', kind: 'supplement', dose_amount: 5, dose_unit: 'g', scheduled_date: day(-1), scheduled_time: '08:00:00', status: 'taken', taken_at: '2026-07-18T08:02:00Z', skipped_reason: null, notes: null },
                { id: 'd-2', supplement_id: 'supp-1', name: 'Magnesium', kind: 'supplement', dose_amount: 200, dose_unit: 'mg', scheduled_date: day(-1), scheduled_time: '20:00:00', status: 'planned', taken_at: null, skipped_reason: null, notes: null },
                { id: 'd-3', supplement_id: 'supp-1', name: 'Creatine', kind: 'supplement', dose_amount: 5, dose_unit: 'g', scheduled_date: day(0), scheduled_time: '08:00:00', status: 'skipped', taken_at: null, skipped_reason: 'travelling', notes: null },
                { id: 'd-4', supplement_id: 'supp-1', name: 'Magnesium', kind: 'supplement', dose_amount: 200, dose_unit: 'mg', scheduled_date: day(0), scheduled_time: '20:00:00', status: 'planned', taken_at: null, skipped_reason: null, notes: null },
            ]);

            const { data, isError } = await callTool('get_supplement_schedule', {
                start_date: day(-1), end_date: day(0),
            });

            expect(isError).toBe(false);
            expect(data.days).toHaveLength(2);
            expect(data.days[0].entries).toHaveLength(2);

            // d-1 taken, d-3 skipped, d-2 missed (planned, in the past); d-4 upcoming (today, excluded)
            expect(data.summary).toEqual({
                taken: 1, skipped: 1, missed: 1, upcoming: 1,
                adherence_pct: 33, // 1 taken of 3 past-due
            });

            const skipped = data.days[1].entries.find((e: { id: string }) => e.id === 'd-3');
            expect(skipped.status).toBe('skipped');
            expect(skipped.skipped_reason).toBe('travelling');
        });

        it('returns a null adherence when nothing is past due', async () => {
            queueResponse('supplement_doses', [
                { id: 'd-1', supplement_id: 'supp-1', name: 'Creatine', kind: 'supplement', dose_amount: 5, dose_unit: 'g', scheduled_date: day(1), scheduled_time: '08:00:00', status: 'planned', taken_at: null, skipped_reason: null, notes: null },
            ]);

            const { data, isError } = await callTool('get_supplement_schedule', {
                start_date: day(1), end_date: day(1),
            });

            expect(isError).toBe(false);
            expect(data.summary.adherence_pct).toBeNull();
            expect(data.summary.upcoming).toBe(1);
        });

        it('rejects an end_date before start_date', async () => {
            const { data, isError } = await callTool('get_supplement_schedule', {
                start_date: day(3), end_date: day(1),
            });

            expect(isError).toBe(true);
            expect(data).toContain('before start_date');
        });
    });

    describe('update_scheduled_supplement', () => {
        it('skips a dose with a reason', async () => {
            queueResponse('supplement_doses', {
                id: 'dose-1', name: 'Creatine', scheduled_date: day(1), scheduled_time: '08:00:00',
                status: 'skipped', skipped_reason: 'stomach upset', notes: null,
            });

            const { data, isError } = await callTool('update_scheduled_supplement', {
                dose_id: 'dose-1', status: 'skipped', reason: 'stomach upset',
            });

            expect(isError).toBe(false);
            expect(data.updated.status).toBe('skipped');
            expect(data.updated.skipped_reason).toBe('stomach upset');

            const patch = findCall('supplement_doses', 'update')?.payload as Record<string, unknown>;
            expect(patch.status).toBe('skipped');
            expect(patch.skipped_reason).toBe('stomach upset');
        });

        it('restores a dose to planned and clears skip metadata', async () => {
            queueResponse('supplement_doses', {
                id: 'dose-1', name: 'Creatine', scheduled_date: day(1), scheduled_time: '08:00:00',
                status: 'planned', skipped_reason: null, notes: null,
            });

            const { data, isError } = await callTool('update_scheduled_supplement', {
                dose_id: 'dose-1', status: 'planned',
            });

            expect(isError).toBe(false);
            expect(data.updated.status).toBe('planned');

            const patch = findCall('supplement_doses', 'update')?.payload as Record<string, unknown>;
            expect(patch.skipped_reason).toBeNull();
            expect(patch.taken_at).toBeNull();
        });

        it('deletes future planned doses of the supplement with apply_to_future_doses', async () => {
            queueResponse('supplement_doses', {
                id: 'dose-1', supplement_id: 'supp-1', name: 'Creatine', scheduled_date: day(1),
            });
            queueResponse('supplement_doses', [{ id: 'dose-1' }, { id: 'dose-2' }, { id: 'dose-3' }]); // delete

            const { data, isError } = await callTool('update_scheduled_supplement', {
                dose_id: 'dose-1', status: 'skipped', apply_to_future_doses: true,
            });

            expect(isError).toBe(false);
            expect(data.stopped).toBe('Creatine');
            expect(data.deleted_planned_doses).toBe(3);

            const del = findCall('supplement_doses', 'delete');
            expect(del?.filters).toEqual(expect.arrayContaining([
                ['eq', 'status', 'planned'],
                ['gte', 'scheduled_date', day(1)],
                ['eq', 'supplement_id', 'supp-1'],
            ]));
        });

        it('rejects apply_to_future_doses without status skipped', async () => {
            const { data, isError } = await callTool('update_scheduled_supplement', {
                dose_id: 'dose-1', apply_to_future_doses: true,
            });

            expect(isError).toBe(true);
            expect(data).toContain('apply_to_future_doses requires');
        });

        it('errors when the dose does not exist', async () => {
            queueResponse('supplement_doses', null);

            const { data, isError } = await callTool('update_scheduled_supplement', {
                dose_id: 'nope', new_time: '21:00',
            });

            expect(isError).toBe(true);
            expect(data).toContain('not found');
        });
    });
});
