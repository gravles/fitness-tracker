import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { format, addDays, subDays } from 'date-fns';

// ─── Supabase admin mock ─────────────────────────────────────────────────────
// Chainable, thenable query builder with per-table FIFO response queues.
// Mirrors the harness in route.test.ts (workout planning tools).

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
    const response = await POST(rpcRequest('tools/call', { name, arguments: args }));
    const json = await response.json();
    const result = json.result;
    return { data: JSON.parse(result.content[0].text), isError: result.isError === true };
}

function findCall(table: string, method?: string) {
    return fromCalls.find(c => c.table === table && (!method || c.method === method));
}

const STORED_MEAL = {
    id: 'meal-1',
    name: 'Fajita chicken bowl',
    description: 'Batch-cooked lunch',
    calories: 620,
    protein: 55,
    carbs: 60,
    fat: 15,
    tags: ['lunch', 'batch-cooked'],
    ingredients: ['chicken breast', 'rice', 'peppers', 'salsa'],
    updated_at: '2026-07-01T00:00:00Z',
};

describe('POST /api/mcp — coach meal planning tools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const key of Object.keys(tableResponses)) delete tableResponses[key];
        fromCalls.length = 0;
    });

    it('lists the new meal-planning tools in tools/list', async () => {
        queueResponse('mcp_api_keys', { user_id: 'test-user-id' });
        const response = await POST(rpcRequest('tools/list'));
        const json = await response.json();

        const names = json.result.tools.map((t: { name: string }) => t.name);
        for (const tool of [
            'save_meal', 'get_meals', 'plan_meal', 'get_meal_plan',
            'update_planned_meal', 'log_planned_meal',
        ]) {
            expect(names).toContain(tool);
        }
    });

    describe('save_meal', () => {
        it('creates a new meal', async () => {
            queueResponse('mcp_meals', []); // no existing meals
            queueResponse('mcp_meals', { id: 'meal-new', name: 'Fajita chicken bowl' }); // insert

            const { data, isError } = await callTool('save_meal', {
                name: 'Fajita chicken bowl',
                calories: 620,
                protein: 55,
                carbs: 60,
                fat: 15,
                tags: ['lunch', 'batch-cooked'],
                ingredients: ['chicken breast', 'rice', 'peppers', 'salsa'],
            });

            expect(isError).toBe(false);
            expect(data.action).toBe('created');
            expect(data.meal_id).toBe('meal-new');

            const insert = findCall('mcp_meals', 'insert');
            const payload = insert?.payload as Record<string, unknown>;
            expect(payload.user_id).toBe('test-user-id');
            expect(payload.calories).toBe(620);
            expect(payload.tags).toEqual(['lunch', 'batch-cooked']);
        });

        it('updates an existing meal by name, case-insensitively', async () => {
            queueResponse('mcp_meals', [{ id: 'meal-1', name: 'fajita chicken bowl' }]);
            queueResponse('mcp_meals', { id: 'meal-1', name: 'Fajita chicken bowl' }); // update

            const { data, isError } = await callTool('save_meal', {
                name: 'Fajita chicken bowl', calories: 650,
            });

            expect(isError).toBe(false);
            expect(data.action).toBe('updated');
            expect(findCall('mcp_meals', 'update')).toBeTruthy();
        });

        it('rejects a meal without calories', async () => {
            const { data, isError } = await callTool('save_meal', { name: 'Fajita chicken bowl' });

            expect(isError).toBe(true);
            expect(data).toContain('calories');
        });
    });

    describe('get_meals', () => {
        it('returns saved meals with macros and tags', async () => {
            queueResponse('mcp_meals', [STORED_MEAL]);

            const { data, isError } = await callTool('get_meals');

            expect(isError).toBe(false);
            expect(data).toHaveLength(1);
            expect(data[0]).toEqual(expect.objectContaining({ name: 'Fajita chicken bowl', calories: 620, tags: ['lunch', 'batch-cooked'] }));
        });
    });

    describe('plan_meal', () => {
        it('rejects malformed dates', async () => {
            const { data, isError } = await callTool('plan_meal', { date: '07/06/2026', slot: 'lunch', name: 'Shake', calories: 200 });

            expect(isError).toBe(true);
            expect(data).toContain('YYYY-MM-DD');
        });

        it('rejects an invalid slot', async () => {
            const { data, isError } = await callTool('plan_meal', { date: day(1), slot: 'brunch', name: 'Shake', calories: 200 });

            expect(isError).toBe(true);
            expect(data).toContain('slot must be one of');
        });

        it('rejects passing both meal_name and an ad-hoc name', async () => {
            const { data, isError } = await callTool('plan_meal', {
                date: day(1), slot: 'lunch', meal_name: 'Fajita chicken bowl', name: 'Shake', calories: 200,
            });

            expect(isError).toBe(true);
            expect(data).toContain('exactly one');
        });

        it('errors with available names when the meal does not exist', async () => {
            queueResponse('mcp_meals', [{ ...STORED_MEAL, name: 'Turkey chili' }]);

            const { data, isError } = await callTool('plan_meal', { date: day(1), slot: 'lunch', meal_name: 'Fajita chicken bowl' });

            expect(isError).toBe(true);
            expect(data).toContain('"Turkey chili"');
        });

        it('plans a single ad-hoc meal', async () => {
            queueResponse('planned_meals', [{ id: 'pm-1', scheduled_date: day(2) }]);

            const { data, isError } = await callTool('plan_meal', {
                date: day(2), slot: 'closer', name: 'Protein shake', calories: 220, protein: 40, time: '21:00',
            });

            expect(isError).toBe(false);
            expect(data.scheduled_count).toBe(1);
            expect(data.meal_name).toBe('Protein shake');

            const rows = findCall('planned_meals', 'insert')?.payload as Record<string, unknown>[];
            expect(rows).toHaveLength(1);
            expect(rows[0]).toEqual(expect.objectContaining({
                name: 'Protein shake', calories: 220, protein: 40, slot: 'closer', scheduled_time: '21:00:00', status: 'planned',
            }));
        });

        it('expands a recurrence onto matching weekdays only', async () => {
            queueResponse('mcp_meals', [STORED_MEAL]);
            queueResponse('planned_meals', []);

            const { isError } = await callTool('plan_meal', {
                date: day(0), slot: 'lunch', meal_name: 'Fajita chicken bowl',
                recurrence: { days_of_week: ['mon', 'wed', 'fri'], until: day(21) },
            });

            expect(isError).toBe(false);
            const rows = findCall('planned_meals', 'insert')?.payload as Record<string, unknown>[];
            expect(rows.length).toBeGreaterThanOrEqual(7); // 3 weeks × 3 days ± boundary days
            for (const row of rows) {
                const weekday = new Date((row.scheduled_date as string) + 'T00:00:00').getDay();
                expect([1, 3, 5]).toContain(weekday); // Mon, Wed, Fri
                expect(row.meal_id).toBe('meal-1');
            }
        });

        it('caps recurrence at 90 days and reports the truncation', async () => {
            queueResponse('mcp_meals', [STORED_MEAL]);
            queueResponse('planned_meals', []);

            const { data, isError } = await callTool('plan_meal', {
                date: day(0), slot: 'lunch', meal_name: 'Fajita chicken bowl',
                recurrence: { days_of_week: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], until: day(200) },
            });

            expect(isError).toBe(false);
            expect(data.note).toContain('90');

            const rows = findCall('planned_meals', 'insert')?.payload as Record<string, unknown>[];
            const cap = day(90);
            for (const row of rows) {
                expect((row.scheduled_date as string) <= cap).toBe(true);
            }
        });
    });

    describe('get_meal_plan', () => {
        it('groups entries by day and computes planned vs. logged totals, excluding skipped from double counting', async () => {
            queueResponse('planned_meals', [
                { id: 'pm-1', scheduled_date: day(0), scheduled_time: '08:00:00', slot: 'break_fast', name: 'Oats', calories: 300, protein: 15, carbs: 50, fat: 5, notes: null, status: 'planned', skipped_reason: null, linked_food_log_id: null, actual_calories: null, actual_protein: null, actual_carbs: null, actual_fat: null },
                { id: 'pm-2', scheduled_date: day(0), scheduled_time: '13:00:00', slot: 'lunch', name: 'Fajita chicken bowl', calories: 620, protein: 55, carbs: 60, fat: 15, notes: null, status: 'logged', skipped_reason: null, linked_food_log_id: 'item-9', actual_calories: 580, actual_protein: 50, actual_carbs: 55, actual_fat: 14 },
                { id: 'pm-3', scheduled_date: day(0), scheduled_time: '19:00:00', slot: 'dinner', name: 'Steak', calories: 700, protein: 60, carbs: 20, fat: 30, notes: null, status: 'skipped', skipped_reason: 'eating out', linked_food_log_id: null, actual_calories: null, actual_protein: null, actual_carbs: null, actual_fat: null },
            ]);

            const { data, isError } = await callTool('get_meal_plan', { start_date: day(0), end_date: day(0) });

            expect(isError).toBe(false);
            expect(data).toHaveLength(1);
            const today = data[0];
            expect(today.entries).toHaveLength(3);

            // planned_totals excludes the skipped Steak (700/60/20/30)
            expect(today.planned_totals).toEqual({ calories: 920, protein: 70, carbs: 110, fat: 20 });
            // logged_totals only includes the logged entry's ACTUAL macros, not the plan snapshot
            expect(today.logged_totals).toEqual({ calories: 580, protein: 50, carbs: 55, fat: 14 });

            const skipped = today.entries.find((e: { id: string }) => e.id === 'pm-3');
            expect(skipped.status).toBe('skipped');
            expect(skipped.skipped_reason).toBe('eating out');

            const logged = today.entries.find((e: { id: string }) => e.id === 'pm-2');
            expect(logged.linked_food_log_id).toBe('item-9');
        });

        it('returns an empty day with zero totals when nothing is planned', async () => {
            queueResponse('planned_meals', []);

            const { data, isError } = await callTool('get_meal_plan', { start_date: day(0), end_date: day(0) });

            expect(isError).toBe(false);
            expect(data[0].entries).toEqual([]);
            expect(data[0].planned_totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
            expect(data[0].logged_totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
        });

        it('rejects an end_date before start_date', async () => {
            const { data, isError } = await callTool('get_meal_plan', { start_date: day(3), end_date: day(1) });

            expect(isError).toBe(true);
            expect(data).toContain('before start_date');
        });
    });

    describe('update_planned_meal', () => {
        it('skips an entry with a reason', async () => {
            queueResponse('planned_meals', {
                id: 'pm-1', scheduled_date: day(1), scheduled_time: '13:00:00', slot: 'lunch',
                name: 'Fajita chicken bowl', status: 'skipped', skipped_reason: 'eating out', notes: null,
            });

            const { data, isError } = await callTool('update_planned_meal', {
                planned_meal_id: 'pm-1', status: 'skipped', reason: 'eating out',
            });

            expect(isError).toBe(false);
            expect(data.updated.status).toBe('skipped');
            expect(data.updated.skipped_reason).toBe('eating out');

            const patch = findCall('planned_meals', 'update')?.payload as Record<string, unknown>;
            expect(patch.status).toBe('skipped');
            expect(patch.skipped_reason).toBe('eating out');
        });

        it('swaps the meal and recalculates macros', async () => {
            queueResponse('mcp_meals', [STORED_MEAL]);
            queueResponse('planned_meals', {
                id: 'pm-1', scheduled_date: day(1), scheduled_time: '13:00:00', slot: 'lunch',
                name: 'Fajita chicken bowl', status: 'planned', skipped_reason: null, notes: null,
            });

            const { isError } = await callTool('update_planned_meal', {
                planned_meal_id: 'pm-1', meal_name: 'Fajita chicken bowl',
            });

            expect(isError).toBe(false);
            const patch = findCall('planned_meals', 'update')?.payload as Record<string, unknown>;
            expect(patch.calories).toBe(620);
            expect(patch.meal_id).toBe('meal-1');
        });

        it('errors when the entry does not exist', async () => {
            queueResponse('planned_meals', null);

            const { data, isError } = await callTool('update_planned_meal', {
                planned_meal_id: 'nope', new_slot: 'dinner',
            });

            expect(isError).toBe(true);
            expect(data).toContain('not found');
        });

        it('rejects an invalid new_slot', async () => {
            const { data, isError } = await callTool('update_planned_meal', {
                planned_meal_id: 'pm-1', new_slot: 'brunch',
            });

            expect(isError).toBe(true);
            expect(data).toContain('slot must be one of');
        });
    });

    describe('log_food with planned_meal_id (no double counting)', () => {
        it('copies the planned meal macros as defaults and marks the entry logged', async () => {
            queueResponse('planned_meals', { id: 'pm-1', name: 'Fajita chicken bowl', scheduled_date: day(0), calories: 620, protein: 55, carbs: 60, fat: 15 });
            queueResponse('daily_logs', null); // existing log lookup
            queueResponse('daily_logs', null); // upsert
            queueResponse('planned_meals', null); // mark logged

            const { data, isError } = await callTool('log_food', { planned_meal_id: 'pm-1' });

            expect(isError).toBe(false);
            expect(data.logged.name).toBe('Fajita chicken bowl');
            expect(data.logged.calories).toBe(620);
            expect(data.linked_planned_meal).toEqual({ id: 'pm-1', name: 'Fajita chicken bowl' });

            const upsert = findCall('daily_logs', 'upsert')?.payload as Record<string, unknown>;
            expect(upsert.date).toBe(day(0)); // dated to the PLAN's day, not necessarily today
            expect(upsert.calories).toBe(620); // day total == exactly the one planned meal — no double count

            const markLogged = findCall('planned_meals', 'update')?.payload as Record<string, unknown>;
            expect(markLogged.status).toBe('logged');
            expect(markLogged.actual_calories).toBe(620);
        });

        it('overrides only the fields the caller passes, keeping the rest from the plan', async () => {
            queueResponse('planned_meals', { id: 'pm-1', name: 'Fajita chicken bowl', scheduled_date: day(0), calories: 620, protein: 55, carbs: 60, fat: 15 });
            queueResponse('daily_logs', null);
            queueResponse('daily_logs', null);
            queueResponse('planned_meals', null);

            const { data, isError } = await callTool('log_food', { planned_meal_id: 'pm-1', calories: 380 });

            expect(isError).toBe(false);
            expect(data.logged.calories).toBe(380); // overridden
            expect(data.logged.protein).toBe(55);   // still from the plan

            const markLogged = findCall('planned_meals', 'update')?.payload as Record<string, unknown>;
            expect(markLogged.actual_calories).toBe(380);
            expect(markLogged.actual_protein).toBe(55);
        });

        it('errors when the planned_meal_id is unknown', async () => {
            queueResponse('planned_meals', null);

            const { data, isError } = await callTool('log_food', { planned_meal_id: 'nope' });

            expect(isError).toBe(true);
            expect(data).toContain('not found');
        });

        it('still requires name and calories for a plain ad-hoc log_food call', async () => {
            const { data, isError } = await callTool('log_food', { protein: 10 });

            expect(isError).toBe(true);
            expect(data).toContain('name is required');
        });
    });

    describe('log_planned_meal', () => {
        it('logs the plan exactly as-is with no adjustments', async () => {
            queueResponse('planned_meals', { id: 'pm-1', name: 'Fajita chicken bowl', scheduled_date: day(0), calories: 620, protein: 55, carbs: 60, fat: 15 });
            queueResponse('daily_logs', null);
            queueResponse('daily_logs', null);
            queueResponse('planned_meals', null);

            const { data, isError } = await callTool('log_planned_meal', { planned_meal_id: 'pm-1' });

            expect(isError).toBe(false);
            expect(data.logged.calories).toBe(620);
            expect(data.linked_planned_meal.id).toBe('pm-1');
        });

        it('applies adjustments as overrides', async () => {
            queueResponse('planned_meals', { id: 'pm-1', name: 'Fajita chicken bowl', scheduled_date: day(0), calories: 620, protein: 55, carbs: 60, fat: 15 });
            queueResponse('daily_logs', null);
            queueResponse('daily_logs', null);
            queueResponse('planned_meals', null);

            const { data, isError } = await callTool('log_planned_meal', {
                planned_meal_id: 'pm-1', adjustments: { calories: 700 },
            });

            expect(isError).toBe(false);
            expect(data.logged.calories).toBe(700);
            expect(data.logged.protein).toBe(55);
        });

        it('requires planned_meal_id', async () => {
            const { data, isError } = await callTool('log_planned_meal', {});

            expect(isError).toBe(true);
            expect(data).toContain('planned_meal_id is required');
        });
    });
});
