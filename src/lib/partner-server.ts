// Server-side helpers shared by the /api/partner/* routes.
// All cross-user access for the partner feature is funnelled through these
// routes — RLS on user-data tables stays owner-only, and share_level is
// enforced here rather than in SQL.
import { NextRequest } from 'next/server';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export function getSupabaseAdmin(): SupabaseClient {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function getCallerUser(req: NextRequest, admin: SupabaseClient): Promise<User | null> {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const { data: { user } } = await admin.auth.getUser(token);
    return user ?? null;
}

export interface Partnership {
    id: string;
    inviter_id: string;
    invitee_id: string | null;
    invitee_email: string;
    status: 'pending' | 'active' | 'paused' | 'declined' | 'ended';
    inviter_share_level: 'summary' | 'full';
    invitee_share_level: 'summary' | 'full';
    invite_token: string;
    invited_at: string;
    accepted_at: string | null;
    ended_at: string | null;
}

export interface PartnershipContext {
    partnership: Partnership;
    role: 'inviter' | 'invitee';
    otherUserId: string;
    /** What the OTHER user shares with the caller. */
    otherShareLevel: 'summary' | 'full';
    /** The column holding what the CALLER shares. */
    myShareColumn: 'inviter_share_level' | 'invitee_share_level';
}

/**
 * Load a partnership and verify the caller is a *linked* participant.
 * Returns null when the row doesn't exist or the caller isn't part of it —
 * the route should respond 404 either way (don't leak existence).
 */
export async function getPartnershipForUser(
    admin: SupabaseClient,
    partnershipId: string,
    userId: string,
): Promise<PartnershipContext | null> {
    const { data, error } = await admin
        .from('partnerships')
        .select('*')
        .eq('id', partnershipId)
        .maybeSingle();
    if (error || !data) return null;
    const p = data as Partnership;

    if (p.inviter_id === userId) {
        if (!p.invitee_id) return null; // not linked yet — nothing to read
        return {
            partnership: p,
            role: 'inviter',
            otherUserId: p.invitee_id,
            otherShareLevel: p.invitee_share_level,
            myShareColumn: 'inviter_share_level',
        };
    }
    if (p.invitee_id === userId) {
        return {
            partnership: p,
            role: 'invitee',
            otherUserId: p.inviter_id,
            otherShareLevel: p.inviter_share_level,
            myShareColumn: 'invitee_share_level',
        };
    }
    return null;
}

/** Best-effort transactional email via Resend (logs instead when unconfigured). */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
        console.log('[partner] No RESEND_API_KEY set — email would go to:', to, '—', subject);
        return true;
    }
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: 'Fitness Tracker <noreply@fit.nathandavie.com>',
            to: [to],
            subject,
            html,
        }),
    });
    if (!res.ok) console.error('[partner] Resend error:', await res.text());
    return res.ok;
}

/** Display name for a user: profiles.full_name first name, else email local part. */
export async function getDisplayName(admin: SupabaseClient, userId: string): Promise<string> {
    const { data: profile } = await admin
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .maybeSingle();
    return profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'Your partner';
}
