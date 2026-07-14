import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getCallerUser, getPartnershipForUser, getDisplayName } from '@/lib/partner-server';
import { sendPushToUser } from '@/lib/push-server';

const MANUAL_NUDGE_TYPES = ['encouragement', 'check_in', 'streak_save'] as const;
const RATE_LIMIT_MS = 60 * 60 * 1000; // one manual nudge per partnership per hour

const PUSH_TITLES: Record<(typeof MANUAL_NUDGE_TYPES)[number], (name: string) => string> = {
    encouragement: name => `💪 ${name} is cheering you on!`,
    check_in: name => `👋 ${name} is checking in on you`,
    streak_save: name => `🔥 ${name} is rooting for your streak`,
};

/**
 * POST /api/partner/nudge  { partnershipId, nudgeType, message? }
 * Sends a one-tap encouragement to the caller's partner (stored + push).
 */
export async function POST(req: NextRequest) {
    try {
        const admin = getSupabaseAdmin();
        const caller = await getCallerUser(req, admin);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { partnershipId, nudgeType, message } = await req.json();
        if (!partnershipId || !MANUAL_NUDGE_TYPES.includes(nudgeType)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const ctx = await getPartnershipForUser(admin, partnershipId, caller.id);
        if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (ctx.partnership.status !== 'active') {
            return NextResponse.json({ error: 'Partnership is not active' }, { status: 409 });
        }

        // Rate limit: at most one manual nudge per hour per partnership per sender
        const cutoff = new Date(Date.now() - RATE_LIMIT_MS).toISOString();
        const { data: recent } = await admin
            .from('partner_nudges')
            .select('id')
            .eq('partnership_id', partnershipId)
            .eq('from_user_id', caller.id)
            .in('nudge_type', MANUAL_NUDGE_TYPES as unknown as string[])
            .gte('created_at', cutoff)
            .limit(1);
        if (recent && recent.length > 0) {
            return NextResponse.json({ error: 'You already sent a nudge recently' }, { status: 429 });
        }

        const trimmedMessage = typeof message === 'string' ? message.slice(0, 200).trim() || null : null;

        const { error: insertError } = await admin.from('partner_nudges').insert({
            partnership_id: partnershipId,
            from_user_id: caller.id,
            to_user_id: ctx.otherUserId,
            nudge_type: nudgeType,
            message: trimmedMessage,
        });
        if (insertError) throw insertError;

        const senderName = await getDisplayName(admin, caller.id);
        await sendPushToUser(admin, ctx.otherUserId, {
            title: PUSH_TITLES[nudgeType as (typeof MANUAL_NUDGE_TYPES)[number]](senderName),
            body: trimmedMessage || 'Keep it up — your partner has your back!',
            url: '/partner',
            tag: 'partner-nudge',
        });

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Partner nudge error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
