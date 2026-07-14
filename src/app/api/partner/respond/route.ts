import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getCallerUser, getDisplayName, Partnership } from '@/lib/partner-server';
import { sendPushToUser } from '@/lib/push-server';

/**
 * POST /api/partner/respond  { partnershipId, action: 'accept' | 'decline' }
 * Only the invitee may respond. When the invite was sent to an email with no
 * account at the time, the caller's verified email is matched here and the
 * account is linked — this is the signup auto-link path.
 */
export async function POST(req: NextRequest) {
    try {
        const admin = getSupabaseAdmin();
        const caller = await getCallerUser(req, admin);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { partnershipId, action } = await req.json();
        if (!partnershipId || !['accept', 'decline'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const { data } = await admin
            .from('partnerships')
            .select('*')
            .eq('id', partnershipId)
            .maybeSingle();
        const p = data as Partnership | null;
        if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const callerEmail = caller.email?.toLowerCase() ?? '';
        const isInvitee = p.invitee_id === caller.id
            || (p.invitee_id === null && p.invitee_email.toLowerCase() === callerEmail);
        if (!isInvitee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (p.status !== 'pending') {
            return NextResponse.json({ error: 'Invite is no longer pending' }, { status: 409 });
        }

        // Make sure the invitee has a profile row before the inviter needs their name
        await admin.from('profiles').upsert({
            id: caller.id,
            email: callerEmail,
            full_name: (caller.user_metadata as any)?.full_name ?? undefined,
        }, { onConflict: 'id' });

        const update = action === 'accept'
            ? { invitee_id: caller.id, status: 'active', accepted_at: new Date().toISOString() }
            : { invitee_id: caller.id, status: 'declined' };

        const { error: updateError } = await admin
            .from('partnerships')
            .update(update)
            .eq('id', p.id)
            .eq('status', 'pending');
        if (updateError) throw updateError;

        if (action === 'accept') {
            const inviteeName = await getDisplayName(admin, caller.id);
            await sendPushToUser(admin, p.inviter_id, {
                title: '🎉 Partner invite accepted',
                body: `${inviteeName} accepted your workout partner invite!`,
                url: '/partner',
                tag: 'partner-accepted',
            });
        }

        return NextResponse.json({ ok: true, status: action === 'accept' ? 'active' : 'declined' });
    } catch (error: any) {
        console.error('Partner respond error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
