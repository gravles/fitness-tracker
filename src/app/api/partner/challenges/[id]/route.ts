import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getCallerUser } from '@/lib/partner-server';
import { computeChallengeProgress, ChallengeType } from '@/lib/partner-summary';

/**
 * GET /api/partner/challenges/:id — challenge detail + leaderboard.
 * Progress for joined members is recomputed on read (refresh-on-load model);
 * the daily cron also keeps it fresh for pushes. Real names appear only when
 * the challenge is not anonymous; otherwise members see aliases (own row is
 * flagged with isMe).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const admin = getSupabaseAdmin();
        const caller = await getCallerUser(req, admin);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: challenge } = await admin
            .from('challenges')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (!challenge) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const { data: memberRows } = await admin
            .from('challenge_members')
            .select('*')
            .eq('challenge_id', id)
            .in('status', ['invited', 'joined']);
        const members = memberRows ?? [];

        const me = members.find(m => m.user_id === caller.id);
        if (!me) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // Recompute progress for joined members while the challenge is running
        const joined = members.filter(m => m.status === 'joined');
        if (['active', 'completed'].includes(challenge.status) && joined.length > 0) {
            const joinedIds = joined.map(m => m.user_id);
            const [{ data: logs }, { data: workouts }] = await Promise.all([
                admin.from('daily_logs')
                    .select('user_id, date, movement_completed, nutrition_logged, protein_grams, calories')
                    .in('user_id', joinedIds)
                    .gte('date', challenge.start_date)
                    .lte('date', challenge.end_date),
                admin.from('workouts')
                    .select('user_id, date')
                    .in('user_id', joinedIds)
                    .gte('date', challenge.start_date)
                    .lte('date', challenge.end_date),
            ]);

            await Promise.all(joined.map(async m => {
                const progress = computeChallengeProgress(
                    challenge.challenge_type as ChallengeType,
                    (logs ?? []).filter(l => l.user_id === m.user_id),
                    (workouts ?? []).filter(w => w.user_id === m.user_id),
                    challenge.start_date,
                    challenge.end_date,
                );
                if (progress !== m.progress) {
                    m.progress = progress;
                    await admin.from('challenge_members')
                        .update({ progress, progress_updated_at: new Date().toISOString() })
                        .eq('challenge_id', id)
                        .eq('user_id', m.user_id);
                }
            }));
        }

        // Names only for non-anonymous challenges
        const namesById: Record<string, string | null> = {};
        if (!challenge.is_anonymous) {
            const { data: profiles } = await admin
                .from('profiles')
                .select('id, full_name')
                .in('id', members.map(m => m.user_id));
            for (const p of (profiles ?? [])) namesById[p.id] = p.full_name;
        }

        const leaderboard = members
            .map(m => ({
                alias: m.display_alias,
                name: challenge.is_anonymous ? null : (namesById[m.user_id] ?? null),
                isMe: m.user_id === caller.id,
                progress: m.progress ?? 0,
                status: m.status,
            }))
            .sort((a, b) => b.progress - a.progress);

        return NextResponse.json({
            challenge: {
                id: challenge.id,
                name: challenge.name,
                description: challenge.description,
                challengeType: challenge.challenge_type,
                targetValue: challenge.target_value,
                startDate: challenge.start_date,
                endDate: challenge.end_date,
                isAnonymous: challenge.is_anonymous,
                status: challenge.status,
                isCreator: challenge.creator_id === caller.id,
            },
            myStatus: me.status,
            leaderboard,
        });
    } catch (error: any) {
        console.error('Challenge detail error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/partner/challenges/:id  { action: 'join' | 'decline' | 'leave' | 'cancel' }
 * 'cancel' is creator-only and cancels the whole challenge.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const admin = getSupabaseAdmin();
        const caller = await getCallerUser(req, admin);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { action } = await req.json();
        if (!['join', 'decline', 'leave', 'cancel'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const { data: challenge } = await admin
            .from('challenges')
            .select('id, creator_id, status')
            .eq('id', id)
            .maybeSingle();
        if (!challenge) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (action === 'cancel') {
            if (challenge.creator_id !== caller.id) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
            await admin.from('challenges').update({ status: 'cancelled' }).eq('id', id);
            return NextResponse.json({ ok: true });
        }

        const { data: membership } = await admin
            .from('challenge_members')
            .select('status')
            .eq('challenge_id', id)
            .eq('user_id', caller.id)
            .maybeSingle();
        if (!membership) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (action === 'join' || action === 'decline') {
            if (membership.status !== 'invited') {
                return NextResponse.json({ error: 'No pending invite' }, { status: 409 });
            }
            await admin.from('challenge_members')
                .update({ status: action === 'join' ? 'joined' : 'declined', joined_at: new Date().toISOString() })
                .eq('challenge_id', id)
                .eq('user_id', caller.id);
            return NextResponse.json({ ok: true });
        }

        // leave
        if (membership.status !== 'joined') {
            return NextResponse.json({ error: 'Not a member' }, { status: 409 });
        }
        await admin.from('challenge_members')
            .update({ status: 'left' })
            .eq('challenge_id', id)
            .eq('user_id', caller.id);
        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Challenge respond error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
