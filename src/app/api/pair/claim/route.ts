import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizeCode, sha256 } from '@/lib/pairing';

async function getUserId(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get('authorization');
    const jwt = authHeader?.replace('Bearer ', '').trim();
    if (!jwt) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt);
    if (error || !user) return null;
    return user.id;
}

// POST /api/pair/claim — called from the logged-in web/phone app with the code
// shown on the device. Registers the device's key hash as an mcp_api_keys entry
// belonging to the caller.
export async function POST(req: NextRequest) {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = normalizeCode((body.code as string) ?? '');
    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

    const { data: pairing } = await supabaseAdmin
        .from('pairing_requests')
        .select('id,key_hash,device_name,claimed_at,expires_at')
        .eq('code_hash', sha256(code))
        .maybeSingle();

    if (!pairing || pairing.claimed_at || new Date(pairing.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Invalid or expired code' }, { status: 404 });
    }

    const { error: keyErr } = await supabaseAdmin.from('mcp_api_keys').insert({
        user_id: userId,
        key_hash: pairing.key_hash,
        name: pairing.device_name,
    });
    if (keyErr) return NextResponse.json({ error: keyErr.message }, { status: 500 });

    const { error: claimErr } = await supabaseAdmin
        .from('pairing_requests')
        .update({ claimed_at: new Date().toISOString() })
        .eq('id', pairing.id);
    if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 });

    return NextResponse.json({ success: true, device_name: pairing.device_name });
}
