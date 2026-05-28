import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

function sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

async function getUserId(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get('authorization');
    const jwt = authHeader?.replace('Bearer ', '').trim();
    if (!jwt) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt);
    if (error || !user) return null;
    return user.id;
}

// GET  /api/mcp/keygen  — list keys for the authenticated user
export async function GET(req: NextRequest) {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
        .from('mcp_api_keys')
        .select('id,name,created_at,last_used_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
}

// POST /api/mcp/keygen  — generate a new key (returns plaintext once)
export async function POST(req: NextRequest) {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = (body.name as string) || 'Claude MCP';

    // "ftk_" prefix + 40 random hex chars = 44 chars total, clearly identifiable
    const rawKey = 'ftk_' + crypto.randomBytes(20).toString('hex');
    const hash   = sha256(rawKey);

    const { data, error } = await supabaseAdmin
        .from('mcp_api_keys')
        .insert({ user_id: userId, key_hash: hash, name })
        .select('id,name,created_at')
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Return the plaintext key exactly once — it cannot be recovered afterwards
    return NextResponse.json({ ...data, key: rawKey });
}

// DELETE /api/mcp/keygen?id=<key-id>  — revoke a key
export async function DELETE(req: NextRequest) {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const keyId = new URL(req.url).searchParams.get('id');
    if (!keyId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await supabaseAdmin
        .from('mcp_api_keys')
        .delete()
        .eq('id', keyId)
        .eq('user_id', userId); // ownership check

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
