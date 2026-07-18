import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { CODE_ALPHABET, sha256 } from '@/lib/pairing';

// ─── Supabase admin mock ─────────────────────────────────────────────────────
// Chainable, thenable query builder with per-table FIFO response queues
// (same pattern as the MCP route tests).

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
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'lt', 'order', 'limit']) {
        builder[m] = vi.fn((...a: unknown[]) => {
            if (['insert', 'update', 'upsert', 'delete'].includes(m)) {
                call.method = m;
                call.payload = a[0];
            }
            if (['eq', 'lt'].includes(m)) call.filters.push([m, ...a]);
            return builder;
        });
    }
    builder.single = vi.fn(() => Promise.resolve(respond()));
    builder.maybeSingle = vi.fn(() => Promise.resolve(respond()));
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(respond()).then(resolve, reject);
    return builder;
}

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase-admin', () => ({
    supabaseAdmin: {
        from: vi.fn((table: string) => createBuilder(table)),
        auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
    },
}));

import { POST as startPOST } from '../start/route';
import { POST as claimPOST } from '../claim/route';
import { POST as pollPOST } from '../poll/route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_KEY_HASH = crypto.createHash('sha256').update('ftk_test').digest('hex');
const FUTURE = new Date(Date.now() + 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

function request(path: string, body: object, jwt?: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/pair/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json',
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
    });
}

function findCall(table: string, method?: string) {
    return fromCalls.find(c => c.table === table && (!method || c.method === method));
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(tableResponses)) delete tableResponses[k];
    fromCalls.length = 0;
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
});

// ─── start ───────────────────────────────────────────────────────────────────

describe('POST /api/pair/start', () => {
    it('rejects a malformed key_hash', async () => {
        const res = await startPOST(request('start', { key_hash: 'not-hex' }));
        expect(res.status).toBe(400);
    });

    it('creates a pairing request and returns a readable code', async () => {
        queueResponse('pairing_requests', null); // expired-rows cleanup
        queueResponse('pairing_requests', null); // insert ok

        const res = await startPOST(request('start', { key_hash: VALID_KEY_HASH, device_name: 'Galaxy Watch Ultra' }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.code).toHaveLength(6);
        for (const ch of data.code) expect(CODE_ALPHABET).toContain(ch);
        expect(data.expires_in).toBe(300);

        const insert = findCall('pairing_requests', 'insert');
        const payload = insert?.payload as Record<string, unknown>;
        expect(payload.key_hash).toBe(VALID_KEY_HASH);
        expect(payload.device_name).toBe('Galaxy Watch Ultra');
        expect(payload.code_hash).toBe(sha256(data.code));
    });

    it('retries on a code collision', async () => {
        queueResponse('pairing_requests', null); // cleanup
        queueResponse('pairing_requests', null, { code: '23505', message: 'duplicate' });
        queueResponse('pairing_requests', null); // second insert ok

        const res = await startPOST(request('start', { key_hash: VALID_KEY_HASH }));
        expect(res.status).toBe(200);
        expect(fromCalls.filter(c => c.table === 'pairing_requests' && c.method === 'insert')).toHaveLength(2);
    });
});

// ─── claim ───────────────────────────────────────────────────────────────────

describe('POST /api/pair/claim', () => {
    it('requires authentication', async () => {
        const res = await claimPOST(request('claim', { code: 'ABC234' }));
        expect(res.status).toBe(401);
    });

    it('rejects an invalid JWT', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
        const res = await claimPOST(request('claim', { code: 'ABC234' }, 'bad.jwt.here'));
        expect(res.status).toBe(401);
    });

    it('rejects an unknown or expired code', async () => {
        queueResponse('pairing_requests', null); // lookup miss
        const res = await claimPOST(request('claim', { code: 'ABC234' }, 'jwt.jwt.jwt'));
        expect(res.status).toBe(404);

        queueResponse('pairing_requests', { id: 'p1', key_hash: VALID_KEY_HASH, device_name: 'W', claimed_at: null, expires_at: PAST });
        const res2 = await claimPOST(request('claim', { code: 'ABC234' }, 'jwt.jwt.jwt'));
        expect(res2.status).toBe(404);
    });

    it('rejects an already-claimed code', async () => {
        queueResponse('pairing_requests', { id: 'p1', key_hash: VALID_KEY_HASH, device_name: 'W', claimed_at: FUTURE, expires_at: FUTURE });
        const res = await claimPOST(request('claim', { code: 'ABC234' }, 'jwt.jwt.jwt'));
        expect(res.status).toBe(404);
    });

    it("registers the device's key hash under the caller's account", async () => {
        queueResponse('pairing_requests', { id: 'p1', key_hash: VALID_KEY_HASH, device_name: 'Galaxy Watch Ultra', claimed_at: null, expires_at: FUTURE });
        queueResponse('mcp_api_keys', null);     // insert ok
        queueResponse('pairing_requests', null); // claimed_at update ok

        const res = await claimPOST(request('claim', { code: 'abc 234' }, 'jwt.jwt.jwt'));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toEqual({ success: true, device_name: 'Galaxy Watch Ultra' });

        // Lowercase/spaced input was normalized before hashing
        const lookup = findCall('pairing_requests');
        expect(lookup?.filters).toContainEqual(['eq', 'code_hash', sha256('ABC234')]);

        const keyInsert = findCall('mcp_api_keys', 'insert');
        expect(keyInsert?.payload).toEqual({ user_id: 'user-1', key_hash: VALID_KEY_HASH, name: 'Galaxy Watch Ultra' });

        const update = findCall('pairing_requests', 'update');
        expect((update?.payload as Record<string, unknown>).claimed_at).toBeTruthy();
    });
});

// ─── poll ────────────────────────────────────────────────────────────────────

describe('POST /api/pair/poll', () => {
    it('requires a code', async () => {
        const res = await pollPOST(request('poll', {}));
        expect(res.status).toBe(400);
    });

    it('reports pending while unclaimed and unexpired', async () => {
        queueResponse('pairing_requests', { id: 'p1', claimed_at: null, expires_at: FUTURE });
        const res = await pollPOST(request('poll', { code: 'ABC234' }));
        expect(await res.json()).toEqual({ status: 'pending' });
    });

    it('reports claimed once the code is claimed, and deletes the request', async () => {
        queueResponse('pairing_requests', { id: 'p1', claimed_at: FUTURE, expires_at: FUTURE });
        queueResponse('pairing_requests', null); // delete
        const res = await pollPOST(request('poll', { code: 'ABC234' }));
        expect(await res.json()).toEqual({ status: 'claimed' });
        expect(findCall('pairing_requests', 'delete')).toBeTruthy();
    });

    it('reports expired for unknown or stale codes', async () => {
        const res = await pollPOST(request('poll', { code: 'ABC234' }));
        expect(await res.json()).toEqual({ status: 'expired' });

        queueResponse('pairing_requests', { id: 'p1', claimed_at: null, expires_at: PAST });
        queueResponse('pairing_requests', null); // delete
        const res2 = await pollPOST(request('poll', { code: 'ABC234' }));
        expect(await res2.json()).toEqual({ status: 'expired' });
    });
});
