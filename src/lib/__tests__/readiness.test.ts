import { describe, it, expect } from 'vitest';
import { computeReadiness } from '../readiness';

const TODAY = '2026-07-18';

describe('computeReadiness', () => {
    it('starts at 100 with no data at all', () => {
        const r = computeReadiness([], [], TODAY);
        expect(r.score).toBe(100);
        expect(r.label).toBe('primed');
        expect(r.components).toHaveLength(0);
    });

    it('rewards great sleep and high energy', () => {
        const r = computeReadiness(
            [
                { date: TODAY, sleep_quality: 5 },
                { date: '2026-07-17', energy_level: 5, alcohol_drinks: 0 },
            ],
            [],
            TODAY,
        );
        expect(r.score).toBe(100); // clamped at 100
        expect(r.components.map(c => c.name)).toEqual(['sleep', 'energy']);
    });

    it('penalizes bad sleep, low energy, and alcohol', () => {
        const r = computeReadiness(
            [
                { date: TODAY, sleep_quality: 1 },                                  // -20
                { date: '2026-07-17', energy_level: 1, alcohol_drinks: 2 },         // -8, -14
            ],
            [],
            TODAY,
        );
        expect(r.score).toBe(100 - 20 - 8 - 14);
        expect(r.label).toBe('steady');
    });

    it('caps the alcohol penalty at 21', () => {
        const r = computeReadiness(
            [{ date: '2026-07-17', alcohol_drinks: 10 }],
            [],
            TODAY,
        );
        expect(r.score).toBe(79);
    });

    it('flags an acute training-load spike', () => {
        // Chronic: one moderate 60-min session weekly for 4 weeks; acute: 3 hard days in a row
        const workouts = [
            { date: '2026-06-24', duration: 60, intensity: 'Moderate' },
            { date: '2026-07-01', duration: 60, intensity: 'Moderate' },
            { date: '2026-07-08', duration: 60, intensity: 'Moderate' },
            { date: '2026-07-16', duration: 90, intensity: 'Hard' },
            { date: '2026-07-17', duration: 90, intensity: 'Hard' },
            { date: TODAY, duration: 90, intensity: 'Hard' },
        ];
        const r = computeReadiness([], workouts, TODAY);
        const load = r.components.find(c => c.name === 'load');
        expect(load?.delta).toBe(-15);
        expect(r.score).toBe(85);
    });

    it('gives a small bonus when well rested against an established norm', () => {
        // Regular training for weeks, then 3+ days off
        const workouts = [
            { date: '2026-06-24', duration: 60, intensity: 'Hard' },
            { date: '2026-06-28', duration: 60, intensity: 'Hard' },
            { date: '2026-07-02', duration: 60, intensity: 'Hard' },
            { date: '2026-07-06', duration: 60, intensity: 'Hard' },
            { date: '2026-07-10', duration: 60, intensity: 'Hard' },
            { date: '2026-07-13', duration: 60, intensity: 'Hard' },
        ];
        const r = computeReadiness([], workouts, TODAY);
        const load = r.components.find(c => c.name === 'load');
        expect(load?.delta).toBe(5);
    });

    it('prefers a tracked sleep record over the manual rating', () => {
        const r = computeReadiness(
            [{ date: TODAY, sleep_quality: 1 }], // manual says terrible…
            [],
            TODAY,
            { duration_minutes: 8 * 60 + 10 },    // …but the watch tracked 8h10m
        );
        const sleep = r.components.find(c => c.name === 'sleep');
        expect(sleep?.delta).toBe(20); // 8h10m → 5/5
        expect(sleep?.detail).toBe('slept 8h 10m');
        expect(r.score).toBe(100);
    });

    it('penalizes tracked short sleep', () => {
        const r = computeReadiness([], [], TODAY, { duration_minutes: 5 * 60 + 30 });
        const sleep = r.components.find(c => c.name === 'sleep');
        expect(sleep?.delta).toBe(-10); // 5.5h → 2/5
        expect(r.score).toBe(90);
    });

    it('lands in recovery with everything stacked against it', () => {
        const r = computeReadiness(
            [
                { date: TODAY, sleep_quality: 1 },
                { date: '2026-07-17', energy_level: 1, alcohol_drinks: 3 },
            ],
            [
                { date: '2026-07-10', duration: 60, intensity: 'Moderate' },
                { date: '2026-07-16', duration: 90, intensity: 'Hard' },
                { date: '2026-07-17', duration: 90, intensity: 'Hard' },
                { date: TODAY, duration: 90, intensity: 'Hard' },
            ],
            TODAY,
        );
        expect(r.score).toBeLessThan(40);
        expect(r.label).toBe('recovery');
        expect(r.recommendation).toContain('Recovery');
    });
});
