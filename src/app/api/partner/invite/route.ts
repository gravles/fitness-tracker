import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getCallerUser, sendEmail, getDisplayName } from '@/lib/partner-server';
import { sendPushToUser } from '@/lib/push-server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/partner/invite  { email }
 * Invites someone to be a workout partner. The response is identical whether
 * or not the email belongs to an existing account (anti-enumeration).
 */
export async function POST(req: NextRequest) {
    try {
        const admin = getSupabaseAdmin();
        const caller = await getCallerUser(req, admin);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const email = String(body?.email ?? '').toLowerCase().trim();
        if (!EMAIL_RE.test(email)) {
            return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
        }
        if (email === caller.email?.toLowerCase()) {
            return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
        }

        // Keep the caller's profile fresh so the invitee sees a name
        await admin.from('profiles').upsert({
            id: caller.id,
            email: caller.email?.toLowerCase(),
            full_name: (caller.user_metadata as any)?.full_name ?? undefined,
        }, { onConflict: 'id' });

        // Look up whether the invitee already has an account (server-side only)
        const { data: inviteeProfile } = await admin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();
        const inviteeId: string | null = inviteeProfile?.id ?? null;

        // Reject duplicates in either direction (only reveals the caller's own
        // partnership state, never whether the email has an account)
        const orClauses = [`and(inviter_id.eq.${caller.id},invitee_email.eq.${email})`];
        if (inviteeId) {
            orClauses.push(`and(inviter_id.eq.${inviteeId},invitee_id.eq.${caller.id})`);
        }
        const { data: existing } = await admin
            .from('partnerships')
            .select('id, status')
            .or(orClauses.join(','))
            .in('status', ['pending', 'active', 'paused']);
        if (existing && existing.length > 0) {
            return NextResponse.json({ error: 'A partnership with this person already exists' }, { status: 409 });
        }

        const { data: partnership, error: insertError } = await admin
            .from('partnerships')
            .insert({
                inviter_id: caller.id,
                invitee_id: inviteeId,
                invitee_email: email,
            })
            .select()
            .single();
        if (insertError) throw insertError;

        const inviterName = await getDisplayName(admin, caller.id);

        if (inviteeId) {
            // Existing user: in-app pending invite + push
            await sendPushToUser(admin, inviteeId, {
                title: '🤝 Workout partner invite',
                body: `${inviterName} wants to be your workout partner!`,
                url: '/partner',
                tag: 'partner-invite',
            });
        } else {
            // No account yet: email invite with signup deep-link
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fit.nathandavie.com';
            const link = `${appUrl}/?invite=${partnership.invite_token}`;
            await sendEmail(
                email,
                `${inviterName} invited you to be workout partners 💪`,
                `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .card { background: white; border-radius: 16px; padding: 28px; max-width: 480px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 12px; color: #1a1a2e; }
  p { color: #555; font-size: 15px; line-height: 1.5; }
  .btn { display: inline-block; margin-top: 16px; padding: 12px 24px; background: #1a1a2e; color: #fff; border-radius: 10px; text-decoration: none; font-weight: 700; }
  .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #aaa; }
</style></head><body>
  <div class="card">
    <h1>You've been invited! 🤝</h1>
    <p>${inviterName} wants to be your workout partner on Fitness Tracker — share progress, keep each other accountable, and swap workouts and meal ideas.</p>
    <a class="btn" href="${link}">Join &amp; accept the invite</a>
    <p class="footer">Sent by Fitness Tracker · If you weren't expecting this, you can ignore it.</p>
  </div>
</body></html>`
            );
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Partner invite error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
