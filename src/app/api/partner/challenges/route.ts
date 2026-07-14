import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getCallerUser, getDisplayName } from '@/lib/partner-server';
import { sendPushToUser } from '@/lib/push-server';

const CHALLENGE_TYPES = ['streak', 'protein_days', 'workout_count'] as const;
const MAX_MEMBERS = 8;
const ALIASES = ['Athlete A', 'Athlete B', 'Athlete C', 'Athlete D', 'Athlete E', 'Athlete F', 'Athlete G', 'Athlete H'];

/**
 * POST /api/partner/challenges
 * { name, description?, challengeType, targetValue, startDate, endDate,
 *   isAnonymous?, partnershipIds: string[] }
 *
 * Creates a challenge, auto-joins the creator, and invites the other user of
 * each given partnership (must be the caller's active partnerships).
 */
export async function POST(req: NextRequest) {
    try {
        const admin = getSupabaseAdmin();
        const caller = await getCallerUser(req, admin);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const name = String(body?.name ?? '').trim();
        const challengeType = body?.challengeType;
        const targetValue = Number(body?.targetValue);
        const startDate = String(body?.startDate ?? '');
        const endDate = String(body?.endDate ?? '');
        const isAnonymous = body?.isAnonymous !== false;
        const partnershipIds: string[] = Array.isArray(body?.partnershipIds) ? body.partnershipIds : [];

        const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
        if (!name || !CHALLENGE_TYPES.includes(challengeType)
            || !Number.isFinite(targetValue) || targetValue <= 0
            || !DATE_RE.test(startDate) || !DATE_RE.test(endDate) || endDate < startDate) {
            return NextResponse.json({ error: 'Invalid challenge' }, { status: 400 });
        }
        if (partnershipIds.length < 1 || partnershipIds.length > MAX_MEMBERS - 1) {
            return NextResponse.json({ error: `Invite between 1 and ${MAX_MEMBERS - 1} partners` }, { status: 400 });
        }

        // Resolve invitees: each id must be one of the caller's ACTIVE partnerships
        const { data: partnerships } = await admin
            .from('partnerships')
            .select('id, inviter_id, invitee_id, status')
            .in('id', partnershipIds)
            .eq('status', 'active');

        const inviteeIds = new Set<string>();
        for (const id of partnershipIds) {
            const p = (partnerships ?? []).find(row => row.id === id);
            if (!p || (p.inviter_id !== caller.id && p.invitee_id !== caller.id) || !p.invitee_id) {
                return NextResponse.json({ error: 'Invalid partnership selection' }, { status: 400 });
            }
            inviteeIds.add(p.inviter_id === caller.id ? p.invitee_id : p.inviter_id);
        }

        const today = new Date().toISOString().slice(0, 10);
        const { data: challenge, error: challengeError } = await admin
            .from('challenges')
            .insert({
                creator_id: caller.id,
                name,
                description: body?.description ? String(body.description).slice(0, 500) : null,
                challenge_type: challengeType,
                target_value: Math.floor(targetValue),
                start_date: startDate,
                end_date: endDate,
                is_anonymous: isAnonymous,
                status: startDate <= today ? 'active' : 'upcoming',
            })
            .select()
            .single();
        if (challengeError) throw challengeError;

        const members = [
            { challenge_id: challenge.id, user_id: caller.id, display_alias: ALIASES[0], status: 'joined' },
            ...Array.from(inviteeIds).map((userId, i) => ({
                challenge_id: challenge.id,
                user_id: userId,
                display_alias: ALIASES[i + 1],
                status: 'invited',
            })),
        ];
        const { error: membersError } = await admin.from('challenge_members').insert(members);
        if (membersError) throw membersError;

        const creatorName = await getDisplayName(admin, caller.id);
        await Promise.all(Array.from(inviteeIds).map(userId =>
            sendPushToUser(admin, userId, {
                title: '🏆 Challenge invite',
                body: `${creatorName} invited you to “${name}”`,
                url: '/partner',
                tag: 'challenge-invite',
            })
        ));

        return NextResponse.json({ ok: true, challengeId: challenge.id });
    } catch (error: any) {
        console.error('Challenge create error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
