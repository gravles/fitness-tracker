import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Chainable supabase builder mock (per-table FIFO queues) ─────────────────

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
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'gte', 'lte', 'in', 'or', 'not', 'order', 'limit']) {
        builder[m] = vi.fn((...a: unknown[]) => {
            if (['insert', 'update', 'upsert', 'delete'].includes(m)) {
                call.method = m;
                call.payload = a[0];
            }
            if (['eq', 'neq', 'gte', 'lte', 'in', 'or', 'not'].includes(m)) call.filters.push([m, ...a]);
            return builder;
        });
    }
    builder.single = vi.fn(() => Promise.resolve(respond()));
    builder.maybeSingle = vi.fn(() => Promise.resolve(respond()));
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(respond()).then(resolve, reject);
    return builder;
}

const mockAdmin = { from: vi.fn((table: string) => createBuilder(table)) };

// Caller identity, controlled per test
let mockCaller: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;

vi.mock('@/lib/partner-server', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/partner-server')>();
    return {
        ...actual,
        getSupabaseAdmin: () => mockAdmin,
        getCallerUser: vi.fn(async () => mockCaller),
        sendEmail: vi.fn(async () => true),
    };
});

const sendPushToUser = vi.fn(async (..._args: unknown[]) => ({ sent: 1, failed: 0 }));
vi.mock('@/lib/push-server', () => ({
    sendPushToUser: (...args: unknown[]) => sendPushToUser(...args),
}));

import { POST as invitePost } from '../invite/route';
import { POST as respondPost } from '../respond/route';
import { GET as summaryGet } from '../summary/route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ME = 'user-me';
const OTHER = 'user-other';

function post(path: string, body: object): NextRequest {
    return new NextRequest(`http://localhost:3000${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    });
}

function get(path: string): NextRequest {
    return new NextRequest(`http://localhost:3000${path}`, {
        headers: { Authorization: 'Bearer test-token' },
    });
}

function partnershipRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'p-1',
        inviter_id: ME,
        invitee_id: OTHER,
        invitee_email: 'other@example.com',
        status: 'active',
        inviter_share_level: 'summary',
        invitee_share_level: 'summary',
        invite_token: 'tok',
        invited_at: '2026-07-01T00:00:00Z',
        accepted_at: '2026-07-02T00:00:00Z',
        ended_at: null,
        ...overrides,
    };
}

beforeEach(() => {
    for (const k of Object.keys(tableResponses)) delete tableResponses[k];
    fromCalls.length = 0;
    sendPushToUser.mockClear();
    mockCaller = { id: ME, email: 'me@example.com' };
});

// ─── Invite ──────────────────────────────────────────────────────────────────

describe('POST /api/partner/invite', () => {
    it('rejects unauthenticated callers', async () => {
        mockCaller = null;
        const res = await invitePost(post('/api/partner/invite', { email: 'x@y.com' }));
        expect(res.status).toBe(401);
    });

    it('rejects invalid emails', async () => {
        const res = await invitePost(post('/api/partner/invite', { email: 'not-an-email' }));
        expect(res.status).toBe(400);
    });

    it('rejects self-invites', async () => {
        const res = await invitePost(post('/api/partner/invite', { email: 'ME@example.com' }));
        expect(res.status).toBe(400);
    });

    it('rejects duplicates', async () => {
        queueResponse('profiles', null);                    // caller profile upsert
        queueResponse('profiles', { id: OTHER });           // invitee lookup
        queueResponse('partnerships', [{ id: 'p-existing', status: 'active' }]); // duplicate check
        const res = await invitePost(post('/api/partner/invite', { email: 'other@example.com' }));
        expect(res.status).toBe(409);
    });

    it('returns an identical body whether or not the email has an account (anti-enumeration)', async () => {
        // Known account
        queueResponse('profiles', null);
        queueResponse('profiles', { id: OTHER });
        queueResponse('partnerships', []);
        queueResponse('partnerships', partnershipRow());    // insert result
        queueResponse('profiles', { full_name: 'Me', email: 'me@example.com' }); // display name
        const known = await invitePost(post('/api/partner/invite', { email: 'other@example.com' }));
        const knownBody = await known.json();

        // Unknown account
        queueResponse('profiles', null);
        queueResponse('profiles', null);                    // no profile for this email
        queueResponse('partnerships', []);
        queueResponse('partnerships', partnershipRow({ invitee_id: null, invitee_email: 'new@example.com' }));
        queueResponse('profiles', { full_name: 'Me', email: 'me@example.com' });
        const unknown = await invitePost(post('/api/partner/invite', { email: 'new@example.com' }));
        const unknownBody = await unknown.json();

        expect(known.status).toBe(200);
        expect(unknown.status).toBe(200);
        expect(JSON.stringify(knownBody)).toBe(JSON.stringify(unknownBody));
    });

    it('links invitee_id when the email already has an account', async () => {
        queueResponse('profiles', null);
        queueResponse('profiles', { id: OTHER });
        queueResponse('partnerships', []);
        queueResponse('partnerships', partnershipRow());
        queueResponse('profiles', { full_name: 'Me', email: 'me@example.com' });
        await invitePost(post('/api/partner/invite', { email: 'other@example.com' }));

        const insert = fromCalls.find(c => c.table === 'partnerships' && c.method === 'insert');
        expect(insert?.payload).toMatchObject({ inviter_id: ME, invitee_id: OTHER, invitee_email: 'other@example.com' });
        expect(sendPushToUser).toHaveBeenCalled();
    });
});

// ─── Respond ─────────────────────────────────────────────────────────────────

describe('POST /api/partner/respond', () => {
    it('rejects a caller who is not the invitee', async () => {
        mockCaller = { id: 'stranger', email: 'stranger@example.com' };
        queueResponse('partnerships', partnershipRow({ status: 'pending' }));
        const res = await respondPost(post('/api/partner/respond', { partnershipId: 'p-1', action: 'accept' }));
        expect(res.status).toBe(404);
    });

    it('accepts and links an unlinked invite by verified email match (signup auto-link)', async () => {
        mockCaller = { id: 'new-user', email: 'other@example.com' };
        queueResponse('partnerships', partnershipRow({ status: 'pending', invitee_id: null }));
        queueResponse('profiles', null);           // invitee profile upsert
        queueResponse('partnerships', null);       // update ack
        queueResponse('profiles', { full_name: 'Other', email: 'other@example.com' }); // display name
        const res = await respondPost(post('/api/partner/respond', { partnershipId: 'p-1', action: 'accept' }));
        expect(res.status).toBe(200);

        const update = fromCalls.find(c => c.table === 'partnerships' && c.method === 'update');
        expect(update?.payload).toMatchObject({ invitee_id: 'new-user', status: 'active' });
        expect(sendPushToUser).toHaveBeenCalled();
    });

    it('rejects responding to a non-pending partnership', async () => {
        mockCaller = { id: OTHER, email: 'other@example.com' };
        queueResponse('partnerships', partnershipRow({ status: 'active' }));
        const res = await respondPost(post('/api/partner/respond', { partnershipId: 'p-1', action: 'accept' }));
        expect(res.status).toBe(409);
    });
});

// ─── Summary (the security-critical read path) ───────────────────────────────

function queueSummaryData() {
    queueResponse('profiles', { full_name: 'Other Person' });
    queueResponse('daily_logs', [
        { date: '2026-07-13', movement_completed: true, protein_grams: 120, calories: 2000, sleep_quality: 4, daily_note: 'felt great' },
    ]);
    queueResponse('workouts', [{ date: '2026-07-13' }]);
    queueResponse('daily_logs', [{ date: '2026-07-13', movement_completed: true }]);
    queueResponse('user_settings', { streak_type: 'any', current_level: 3 });
}

describe('GET /api/partner/summary', () => {
    it('404s for a non-participant', async () => {
        mockCaller = { id: 'stranger', email: 's@example.com' };
        queueResponse('partnerships', partnershipRow());
        const res = await summaryGet(get('/api/partner/summary?partnershipId=p-1'));
        expect(res.status).toBe(404);
    });

    it("summary share level returns aggregates but NEVER raw workout/log rows", async () => {
        queueResponse('partnerships', partnershipRow({ invitee_share_level: 'summary' }));
        queueSummaryData();
        const res = await summaryGet(get('/api/partner/summary?partnershipId=p-1'));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.summary).toMatchObject({ daysLogged: 1, workoutsCount: 1, proteinDays: 1, level: 3 });
        expect(body.full).toBeUndefined();
        // Defence in depth: no raw row arrays anywhere in the payload
        expect(JSON.stringify(body)).not.toContain('recentWorkouts');
        expect(JSON.stringify(body)).not.toContain('recentLogs');
    });

    it('full share level adds whitelisted recent activity', async () => {
        queueResponse('partnerships', partnershipRow({ invitee_share_level: 'full' }));
        queueSummaryData();
        queueResponse('workouts', [{
            id: 'w-1', date: '2026-07-13', activity_type: 'strength', duration: 45, intensity: 'high',
            workout_exercises: [{ name: 'Bench Press' }],
            user_id: OTHER,             // must NOT leak through
            notes: 'private notes',     // must NOT leak through
        }]);
        queueResponse('daily_logs', [{
            date: '2026-07-13', calories: 2000, protein_grams: 120, carbs_grams: 180, fat_grams: 60,
            movement_type: 'gym', movement_duration: 45,
            daily_note: 'private note', // must NOT leak through
        }]);
        const res = await summaryGet(get('/api/partner/summary?partnershipId=p-1'));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.full.recentWorkouts[0]).toEqual({
            date: '2026-07-13', activityType: 'strength', duration: 45, intensity: 'high', exercises: ['Bench Press'],
        });
        expect(body.full.recentLogs[0]).toEqual({
            date: '2026-07-13', calories: 2000, proteinGrams: 120, carbsGrams: 180, fatGrams: 60,
            movementType: 'gym', movementDuration: 45,
        });
        expect(JSON.stringify(body.full)).not.toContain('user_id');
        expect(JSON.stringify(body.full)).not.toContain('private');
    });

    it('caller sees data governed by the OTHER side\'s share level, not their own', async () => {
        // Caller is the invitee; inviter shares 'full', invitee shares 'summary'.
        mockCaller = { id: OTHER, email: 'other@example.com' };
        queueResponse('partnerships', partnershipRow({ inviter_share_level: 'full', invitee_share_level: 'summary' }));
        queueSummaryData();
        queueResponse('workouts', []);
        queueResponse('daily_logs', []);
        const res = await summaryGet(get('/api/partner/summary?partnershipId=p-1'));
        const body = await res.json();
        expect(body.full).toBeDefined();
        expect(body.partnership.myShareLevel).toBe('summary');
        expect(body.partnership.theirShareLevel).toBe('full');
    });

    it('paused partnerships return no stats at all', async () => {
        queueResponse('partnerships', partnershipRow({ status: 'paused' }));
        queueResponse('profiles', { full_name: 'Other Person' });
        const res = await summaryGet(get('/api/partner/summary?partnershipId=p-1'));
        const body = await res.json();
        expect(body.paused).toBe(true);
        expect(body.summary).toBeUndefined();
        expect(body.full).toBeUndefined();
    });
});
