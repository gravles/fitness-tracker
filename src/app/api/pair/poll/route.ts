import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizeCode, sha256 } from '@/lib/pairing';

// POST /api/pair/poll — called by the device with its code until claimed.
// Returns status only; the device already holds its key locally.
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode((body.code as string) ?? '');
    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

    const { data: pairing } = await supabaseAdmin
        .from('pairing_requests')
        .select('id,claimed_at,expires_at')
        .eq('code_hash', sha256(code))
        .maybeSingle();

    if (!pairing) return NextResponse.json({ status: 'expired' });

    if (pairing.claimed_at) {
        // Pairing complete — the request row has served its purpose
        await supabaseAdmin.from('pairing_requests').delete().eq('id', pairing.id);
        return NextResponse.json({ status: 'claimed' });
    }

    if (new Date(pairing.expires_at) < new Date()) {
        await supabaseAdmin.from('pairing_requests').delete().eq('id', pairing.id);
        return NextResponse.json({ status: 'expired' });
    }

    return NextResponse.json({ status: 'pending' });
}
