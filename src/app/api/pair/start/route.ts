import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CODE_TTL_SECONDS, generateCode, sha256 } from '@/lib/pairing';

// POST /api/pair/start — called by an unauthenticated device (e.g. the watch).
// The device generates its own ftk_ key locally and sends only the SHA-256 hash.
// Returns a short code the user types into Settings → Pair a device.
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const keyHash = (body.key_hash as string) ?? '';
    const deviceName = ((body.device_name as string) || 'Paired device').slice(0, 60);

    if (!/^[0-9a-f]{64}$/.test(keyHash)) {
        return NextResponse.json({ error: 'key_hash must be a lowercase hex SHA-256' }, { status: 400 });
    }

    // Opportunistic cleanup of expired requests
    await supabaseAdmin.from('pairing_requests').delete().lt('expires_at', new Date().toISOString());

    const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

    // Retry on the (vanishingly rare) code collision
    for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateCode();
        const { error } = await supabaseAdmin.from('pairing_requests').insert({
            code_hash: sha256(code),
            key_hash: keyHash,
            device_name: deviceName,
            expires_at: expiresAt,
        });
        if (!error) {
            return NextResponse.json({ code, expires_in: CODE_TTL_SECONDS });
        }
        if (error.code !== '23505') {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }
    return NextResponse.json({ error: 'Could not generate a pairing code, try again' }, { status: 500 });
}
