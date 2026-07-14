import { describe, it, expect } from 'vitest';
import { format, subDays } from 'date-fns';
import {
    computeWeeklySummary,
    computeStreakFromLogs,
    computeChallengeProgress,
    PROTEIN_GOAL_GRAMS,
} from '../partner-summary';

const TODAY = new Date('2026-07-14T12:00:00Z');
const day = (offset: number) => format(subDays(TODAY, offset), 'yyyy-MM-dd');

describe('computeWeeklySummary', () => {
    it('returns zeroed stats for an empty week', () => {
        const s = computeWeeklySummary([], []);
        expect(s).toEqual({
            daysLogged: 0,
            workoutsCount: 0,
            proteinDays: 0,
            avgSleep: '—',
            lastNote: '',
        });
    });

    it('counts protein days only at or above the goal', () => {
        const logs = [
            { date: day(1), protein_grams: PROTEIN_GOAL_GRAMS },
            { date: day(2), protein_grams: PROTEIN_GOAL_GRAMS - 1 },
            { date: day(3), protein_grams: 150 },
            { date: day(4), protein_grams: null },
        ];
        expect(computeWeeklySummary(logs, []).proteinDays).toBe(2);
    });

    it('averages sleep across all logged days (missing counts as 0, matching the email)', () => {
        const logs = [
            { date: day(1), sleep_quality: 4 },
            { date: day(2), sleep_quality: null },
        ];
        expect(computeWeeklySummary(logs, []).avgSleep).toBe('2.0');
    });

    it('uses the most recent note', () => {
        const logs = [
            { date: day(3), daily_note: 'older note' },
            { date: day(1), daily_note: 'newest note' },
            { date: day(0), daily_note: null },
        ];
        expect(computeWeeklySummary(logs, []).lastNote).toBe('newest note');
    });

    it('counts workouts', () => {
        expect(computeWeeklySummary([], [{ date: day(1) }, { date: day(2) }]).workoutsCount).toBe(2);
    });
});

describe('computeStreakFromLogs', () => {
    const logged = (offset: number) => ({ date: day(offset), movement_completed: true });

    it('returns 0 with no logs', () => {
        expect(computeStreakFromLogs([], 'any', TODAY)).toBe(0);
    });

    it('counts consecutive days anchored on today', () => {
        expect(computeStreakFromLogs([logged(0), logged(1), logged(2)], 'any', TODAY)).toBe(3);
    });

    it('still counts a streak anchored on yesterday (not broken until midnight)', () => {
        expect(computeStreakFromLogs([logged(1), logged(2)], 'any', TODAY)).toBe(2);
    });

    it('returns 0 when neither today nor yesterday is logged', () => {
        expect(computeStreakFromLogs([logged(2), logged(3)], 'any', TODAY)).toBe(0);
    });

    it('breaks on a gap', () => {
        expect(computeStreakFromLogs([logged(0), logged(2), logged(3)], 'any', TODAY)).toBe(1);
    });

    it('respects the workout streak type', () => {
        const logs = [
            { date: day(0), movement_completed: true },
            { date: day(1), movement_completed: false, nutrition_logged: true },
            { date: day(2), movement_completed: true },
        ];
        expect(computeStreakFromLogs(logs, 'workout', TODAY)).toBe(1);
        expect(computeStreakFromLogs(logs, 'any', TODAY)).toBe(3);
    });

    it('counts calories > 0 as nutrition logging', () => {
        const logs = [{ date: day(0), calories: 1800 }];
        expect(computeStreakFromLogs(logs, 'nutrition', TODAY)).toBe(1);
    });
});

describe('computeChallengeProgress', () => {
    const start = day(10);
    const end = day(0);

    it('workout_count counts workouts inside the window only', () => {
        const workouts = [
            { date: day(5) },
            { date: day(0) },
            { date: day(11) },  // before window
        ];
        expect(computeChallengeProgress('workout_count', [], workouts, start, end)).toBe(2);
    });

    it('protein_days counts qualifying days inside the window', () => {
        const logs = [
            { date: day(5), protein_grams: PROTEIN_GOAL_GRAMS },
            { date: day(4), protein_grams: 20 },
            { date: day(12), protein_grams: 200 },  // before window
        ];
        expect(computeChallengeProgress('protein_days', logs, [], start, end)).toBe(1);
    });

    it('streak finds the longest consecutive run within the window', () => {
        const logs = [
            { date: day(9), movement_completed: true },
            { date: day(8), movement_completed: true },
            { date: day(7), movement_completed: true },
            // gap at day(6)
            { date: day(5), nutrition_logged: true },
            { date: day(4), calories: 1500 },
        ];
        expect(computeChallengeProgress('streak', logs, [], start, end)).toBe(3);
    });

    it('streak is 0 with no qualifying days', () => {
        expect(computeChallengeProgress('streak', [], [], start, end)).toBe(0);
    });
});
