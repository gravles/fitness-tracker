import { NextRequest, NextResponse } from 'next/server';
import { subDays, format } from 'date-fns';
import { getSupabaseAdmin, getCallerUser, getPartnershipForUser } from '@/lib/partner-server';
import { computeWeeklySummary, computeStreakFromLogs, StreakType } from '@/lib/partner-summary';

/**
 * GET /api/partner/summary?partnershipId=...
 *
 * THE cross-user read path for the partner feature. Every field returned here
 * is explicitly whitelisted — never spread raw DB rows into the response.
 * What the caller may see is governed by the OTHER user's share level:
 *   'summary' → 7-day aggregates + streak only
 *   'full'    → aggregates + recent workouts and recent nutrition days
 */
export async function GET(req: NextRequest) {
    try {
        const admin = getSupabaseAdmin();
        const caller = await getCallerUser(req, admin);
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const partnershipId = req.nextUrl.searchParams.get('partnershipId');
        if (!partnershipId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

        const ctx = await getPartnershipForUser(admin, partnershipId, caller.id);
        if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const { partnership: p, otherUserId, otherShareLevel, myShareColumn } = ctx;

        if (!['active', 'paused'].includes(p.status)) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const base = {
            partnership: {
                id: p.id,
                status: p.status,
                since: p.accepted_at,
                myShareLevel: p[myShareColumn],
                theirShareLevel: otherShareLevel,
            },
        };

        const { data: profile } = await admin
            .from('profiles')
            .select('full_name')
            .eq('id', otherUserId)
            .maybeSingle();
        const partnerName = profile?.full_name || null;

        if (p.status === 'paused') {
            return NextResponse.json({ ...base, partner: { name: partnerName }, paused: true });
        }

        const today = new Date();
        const weekAgoStr = format(subDays(today, 7), 'yyyy-MM-dd');
        const todayStr = format(today, 'yyyy-MM-dd');
        const streakWindowStr = format(subDays(today, 100), 'yyyy-MM-dd');

        const [{ data: weekLogs }, { data: weekWorkouts }, { data: streakLogs }, { data: settings }] =
            await Promise.all([
                admin.from('daily_logs')
                    .select('date, movement_completed, nutrition_logged, protein_grams, calories, sleep_quality, daily_note')
                    .eq('user_id', otherUserId)
                    .gte('date', weekAgoStr)
                    .lte('date', todayStr)
                    .order('date', { ascending: true }),
                admin.from('workouts')
                    .select('date')
                    .eq('user_id', otherUserId)
                    .gte('date', weekAgoStr)
                    .lte('date', todayStr),
                admin.from('daily_logs')
                    .select('date, movement_completed, nutrition_logged, calories')
                    .eq('user_id', otherUserId)
                    .gte('date', streakWindowStr)
                    .order('date', { ascending: false })
                    .limit(100),
                admin.from('user_settings')
                    .select('streak_type, current_level')
                    .eq('user_id', otherUserId)
                    .maybeSingle(),
            ]);

        const weekly = computeWeeklySummary(weekLogs ?? [], (weekWorkouts ?? []) as { date: string }[]);
        const streak = computeStreakFromLogs(
            streakLogs ?? [],
            ((settings?.streak_type as StreakType) || 'any'),
            today,
        );

        const summary = {
            ...weekly,
            streak,
            level: settings?.current_level ?? null,
        };

        if (otherShareLevel !== 'full') {
            return NextResponse.json({ ...base, partner: { name: partnerName }, summary });
        }

        // 'full' — recent activity, explicitly whitelisted field by field
        const [{ data: recentWorkoutRows }, { data: recentLogRows }] = await Promise.all([
            admin.from('workouts')
                .select('id, date, activity_type, duration, intensity, workout_exercises(name)')
                .eq('user_id', otherUserId)
                .order('date', { ascending: false })
                .limit(10),
            admin.from('daily_logs')
                .select('date, calories, protein_grams, carbs_grams, fat_grams, movement_type, movement_duration')
                .eq('user_id', otherUserId)
                .gte('date', weekAgoStr)
                .lte('date', todayStr)
                .order('date', { ascending: false }),
        ]);

        const recentWorkouts = (recentWorkoutRows ?? []).map((w: any) => ({
            date: w.date,
            activityType: w.activity_type ?? null,
            duration: w.duration ?? null,
            intensity: w.intensity ?? null,
            exercises: (w.workout_exercises ?? []).map((e: any) => e.name),
        }));

        const recentLogs = (recentLogRows ?? []).map((l: any) => ({
            date: l.date,
            calories: l.calories ?? null,
            proteinGrams: l.protein_grams ?? null,
            carbsGrams: l.carbs_grams ?? null,
            fatGrams: l.fat_grams ?? null,
            movementType: l.movement_type ?? null,
            movementDuration: l.movement_duration ?? null,
        }));

        return NextResponse.json({
            ...base,
            partner: { name: partnerName },
            summary,
            full: { recentWorkouts, recentLogs },
        });
    } catch (error: any) {
        console.error('Partner summary error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
