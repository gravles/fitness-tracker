import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getCallerUser, getPartnershipForUser } from '@/lib/partner-server';

/**
 * POST /api/partner/update
 *   { partnershipId, op: 'share_level', shareLevel: 'summary' | 'full' }
 *   { partnershipId, op: 'pause' | 'resume' | 'end' }
 *
 * Whitelisted mutations only. A caller can change what THEY share
 * (their own share column), or pause/resume/end the partnership.
 * The inviter may also 'end' (cancel) a still-pending invite.
 */
export async function POST(req: NextRequest) {
    try {
        const admin = getSupabaseAdmin();
        const caller = await getCallerUser(req, admin);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { partnershipId, op, shareLevel } = await req.json();
        if (!partnershipId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

        // Cancel-pending is the one op allowed on an unlinked partnership
        if (op === 'end') {
            const { data: pending } = await admin
                .from('partnerships')
                .select('id')
                .eq('id', partnershipId)
                .eq('inviter_id', caller.id)
                .eq('status', 'pending')
                .maybeSingle();
            if (pending) {
                await admin.from('partnerships')
                    .update({ status: 'ended', ended_at: new Date().toISOString() })
                    .eq('id', partnershipId);
                return NextResponse.json({ ok: true, status: 'ended' });
            }
        }

        const ctx = await getPartnershipForUser(admin, partnershipId, caller.id);
        if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const { partnership: p, myShareColumn } = ctx;

        if (op === 'share_level') {
            if (!['summary', 'full'].includes(shareLevel)) {
                return NextResponse.json({ error: 'Invalid share level' }, { status: 400 });
            }
            if (!['active', 'paused'].includes(p.status)) {
                return NextResponse.json({ error: 'Partnership is not active' }, { status: 409 });
            }
            await admin.from('partnerships')
                .update({ [myShareColumn]: shareLevel })
                .eq('id', p.id);
            return NextResponse.json({ ok: true, shareLevel });
        }

        if (op === 'pause' || op === 'resume') {
            const from = op === 'pause' ? 'active' : 'paused';
            const to   = op === 'pause' ? 'paused' : 'active';
            if (p.status !== from) {
                return NextResponse.json({ error: `Partnership is not ${from}` }, { status: 409 });
            }
            await admin.from('partnerships').update({ status: to }).eq('id', p.id);
            return NextResponse.json({ ok: true, status: to });
        }

        if (op === 'end') {
            if (!['active', 'paused'].includes(p.status)) {
                return NextResponse.json({ error: 'Partnership is not active' }, { status: 409 });
            }
            await admin.from('partnerships')
                .update({ status: 'ended', ended_at: new Date().toISOString() })
                .eq('id', p.id);
            return NextResponse.json({ ok: true, status: 'ended' });
        }

        return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
    } catch (error: any) {
        console.error('Partner update error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
