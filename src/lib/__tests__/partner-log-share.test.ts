import { describe, it, expect } from 'vitest';
import {
    buildMealPayload, buildActivityPayload, scaleFoodItems, mealTotals,
    activityFamily, findLikelyDuplicate,
} from '../partner-log-share';
import type { FoodItem, Workout } from '../api';

describe('buildMealPayload', () => {
    it('strips the sender’s capture metadata but keeps nutrition', () => {
        const items: FoodItem[] = [{
            id: 'abc', name: 'Pizza', calories: 800, protein: 30, quantity: 2,
            logged_at: '2026-10-13T19:00:00Z', source: 'photo', portion_estimate: '1 pie',
        }];
        const payload = buildMealPayload(items, '2026-10-13');
        expect(payload).toEqual({
            name: 'Pizza',
            date: '2026-10-13',
            food_items: [{ name: 'Pizza', calories: 800, protein: 30, quantity: 2, portion_estimate: '1 pie' }],
        });
        expect(items[0].id).toBe('abc'); // input not mutated
    });

    it('names multi-item meals after the first item', () => {
        const payload = buildMealPayload([{ name: 'Burger' }, { name: 'Fries' }, { name: 'Shake' }], '2026-10-13');
        expect(payload.name).toBe('Burger + 2 more');
    });
});

describe('buildActivityPayload', () => {
    it('copies what was done together and drops personal metrics', () => {
        const workout: Workout = {
            id: 'w1', user_id: 'u1', date: '2026-10-12', activity_type: 'Ride', duration: 95,
            intensity: 'Moderate', distance: 42000, elevation_gain: 380, notes: 'Lake loop',
            calories: 1100, average_heartrate: 142, max_heartrate: 171, average_speed: 7.4,
            external_id: 'strava-1', source: 'strava',
        };
        expect(buildActivityPayload(workout)).toEqual({
            name: 'Ride', date: '2026-10-12', activity_type: 'Ride', duration: 95,
            intensity: 'Moderate', distance: 42000, elevation_gain: 380, notes: 'Lake loop',
        });
    });

    it('omits empty optional fields', () => {
        const payload = buildActivityPayload({ date: '2026-10-12', activity_type: 'Hiking', duration: 120, intensity: 'Hard' });
        expect(payload).not.toHaveProperty('distance');
        expect(payload).not.toHaveProperty('notes');
    });
});

describe('scaleFoodItems / mealTotals', () => {
    it('applies the portion through the quantity multiplier', () => {
        const scaled = scaleFoodItems([
            { name: 'Pizza', calories: 800, protein: 30, quantity: 2 },
            { name: 'Salad', calories: 150, protein: 4, quantity: '1' },
            { name: 'Soda', calories: 140 },
        ], 0.5);
        expect(scaled.map(i => i.quantity)).toEqual([1, 0.5, 0.5]);
        expect(mealTotals(scaled)).toEqual({ calories: 800 + 75 + 70, protein: 30 + 2 });
    });

    it('rounds awkward portions to two decimals', () => {
        expect(scaleFoodItems([{ name: 'Cake', calories: 300 }], 1 / 3)[0].quantity).toBe(0.33);
    });
});

describe('activity matching', () => {
    it('groups Strava and manual names into one family', () => {
        expect(activityFamily('Ride')).toBe('cycling');
        expect(activityFamily('VirtualRide')).toBe('cycling');
        expect(activityFamily('Cycling')).toBe('cycling');
        expect(activityFamily('Hike')).toBe(activityFamily('Hiking'));
        expect(activityFamily('Rock Climbing')).toBe('rockclimbing');
    });

    const existing: Workout[] = [
        { id: 'a', date: '2026-10-12', activity_type: 'Ride', duration: 90, intensity: 'Moderate' },
        { id: 'b', date: '2026-10-12', activity_type: 'Yoga', duration: 30, intensity: 'Light' },
    ];
    const shared = { name: 'Cycling', date: '2026-10-12', activity_type: 'Cycling', duration: 95, intensity: 'Moderate' as const };

    it('flags a same-day workout of the same kind', () => {
        expect(findLikelyDuplicate(existing, shared)?.id).toBe('a');
    });

    it('ignores other days and other activities', () => {
        expect(findLikelyDuplicate(existing, { ...shared, date: '2026-10-13' })).toBeNull();
        expect(findLikelyDuplicate(existing, { ...shared, activity_type: 'Running' })).toBeNull();
    });
});
