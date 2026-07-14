// Pure, server-safe computations for the partner feature. No Supabase client,
// no session — callers pass rows in, which keeps everything unit-testable and
// usable from both API routes and the cron dispatcher.
import { format, subDays, addDays, parseISO } from 'date-fns';

export interface SummaryLogRow {
    date: string;
    movement_completed?: boolean | null;
    nutrition_logged?: boolean | null;
    protein_grams?: number | null;
    calories?: number | null;
    sleep_quality?: number | null;
    daily_note?: string | null;
}

export interface SummaryWorkoutRow {
    date: string;
    activity_type?: string | null;
    duration?: number | null;
}

export interface PartnerSummary {
    daysLogged: number;
    workoutsCount: number;
    proteinDays: number;
    avgSleep: string;     // '—' when no data, else e.g. '3.5'
    lastNote: string;
    streak: number;
}

export const PROTEIN_GOAL_GRAMS = 100;

/**
 * Weekly stats shown to a partner (and used by the weekly summary email).
 * Mirrors the maths previously inlined in api/accountability/send-summary.
 */
export function computeWeeklySummary(
    logs: SummaryLogRow[],
    workouts: SummaryWorkoutRow[],
): Omit<PartnerSummary, 'streak'> {
    const daysLogged = logs.length;
    const workoutsCount = workouts.length;
    const proteinDays = logs.filter(l => l.protein_grams && l.protein_grams >= PROTEIN_GOAL_GRAMS).length;
    const avgSleep = logs.length > 0
        ? (logs.reduce((s, l) => s + (l.sleep_quality || 0), 0) / logs.length).toFixed(1)
        : '—';
    const lastNote = [...logs].reverse().find(l => l.daily_note)?.daily_note || '';
    return { daysLogged, workoutsCount, proteinDays, avgSleep, lastNote };
}

export type StreakType = 'any' | 'workout' | 'nutrition';

/**
 * Server-safe port of the streak loop in src/lib/api.ts getStreak().
 * `logs` should be the user's recent daily_logs (order doesn't matter);
 * `today` is injectable for tests.
 */
export function computeStreakFromLogs(
    logs: SummaryLogRow[],
    streakType: StreakType = 'any',
    today: Date = new Date(),
): number {
    if (logs.length === 0) return 0;

    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

    const loggedDates = new Set(
        logs
            .filter(d => {
                if (streakType === 'workout')   return !!d.movement_completed;
                if (streakType === 'nutrition') return d.nutrition_logged || (d.calories && d.calories > 0);
                return d.movement_completed || d.nutrition_logged || (d.calories && d.calories > 0);
            })
            .map(d => d.date)
    );

    if (!loggedDates.has(todayStr) && !loggedDates.has(yesterdayStr)) return 0;

    const anchorDateStr = loggedDates.has(todayStr) ? todayStr : yesterdayStr;

    let streak = 0;
    let curr = parseISO(anchorDateStr);
    while (loggedDates.has(format(curr, 'yyyy-MM-dd'))) {
        streak++;
        curr = subDays(curr, 1);
    }

    return streak;
}

export type ChallengeType = 'streak' | 'protein_days' | 'workout_count';

/**
 * A member's progress in a challenge over [startDate, endDate] (inclusive,
 * yyyy-MM-dd). streak = longest consecutive run of logged days in the window;
 * protein_days = days at/above the protein goal; workout_count = workouts.
 */
export function computeChallengeProgress(
    type: ChallengeType,
    logs: SummaryLogRow[],
    workouts: SummaryWorkoutRow[],
    startDate: string,
    endDate: string,
): number {
    const inWindow = (d: string) => d >= startDate && d <= endDate;

    if (type === 'workout_count') {
        return workouts.filter(w => inWindow(w.date)).length;
    }

    if (type === 'protein_days') {
        return logs.filter(l =>
            inWindow(l.date) && l.protein_grams && l.protein_grams >= PROTEIN_GOAL_GRAMS
        ).length;
    }

    // streak: longest consecutive run of "logged" days within the window
    const loggedDates = new Set(
        logs
            .filter(l => inWindow(l.date)
                && (l.movement_completed || l.nutrition_logged || (l.calories && l.calories > 0)))
            .map(l => l.date)
    );
    let best = 0;
    let curr = parseISO(startDate);
    const end = parseISO(endDate);
    let run = 0;
    while (curr <= end) {
        if (loggedDates.has(format(curr, 'yyyy-MM-dd'))) {
            run++;
            if (run > best) best = run;
        } else {
            run = 0;
        }
        curr = addDays(curr, 1);
    }
    return best;
}
