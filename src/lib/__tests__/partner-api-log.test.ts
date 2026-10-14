import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api', () => ({
    createSavedMeal: vi.fn(),
    addFavoriteFood: vi.fn(),
    appendFoodItems: vi.fn().mockResolvedValue(undefined),
    addWorkout: vi.fn().mockResolvedValue({ id: 'new' }),
    upsertDailyLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../features', () => ({ saveAsTemplate: vi.fn() }));

const statusUpdate = vi.fn();
vi.mock('../supabase', () => {
    const chain = {
        update: (patch: unknown) => { statusUpdate(patch); return chain; },
        eq: () => chain,
        then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
    };
    return {
        supabase: {
            auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } } }) },
            from: () => chain,
        },
    };
});

import { logSharedItem, saveSharedItem, isLoggedShare, SharedItem } from '../partner-api';
import { appendFoodItems, addWorkout, upsertDailyLog } from '../api';

const base = {
    id: 'share-1', partnership_id: 'p1', from_user_id: 'friend', to_user_id: 'me',
    message: null, status: 'new' as const, created_at: '2026-10-13T20:00:00Z',
};

describe('logSharedItem', () => {
    beforeEach(() => vi.clearAllMocks());

    it('logs my portion of a shared meal to the chosen day', async () => {
        const item: SharedItem = {
            ...base,
            item_type: 'logged_meal',
            payload: { name: 'Pizza', date: '2026-10-13', food_items: [{ name: 'Pizza', calories: 800, quantity: 1 }] },
        };
        await logSharedItem(item, { date: '2026-10-13', portion: 0.5 });

        expect(appendFoodItems).toHaveBeenCalledWith('2026-10-13', [
            { name: 'Pizza', calories: 800, quantity: 0.5, source: 'partner' },
        ]);
        expect(statusUpdate).toHaveBeenCalledWith({ status: 'saved' });
    });

    it('logs a shared activity with my own duration and calories, and marks movement', async () => {
        const item: SharedItem = {
            ...base,
            item_type: 'logged_activity',
            payload: {
                name: 'Hike', date: '2026-10-12', activity_type: 'Hike', duration: 120,
                intensity: 'Hard', distance: 9000, elevation_gain: 600,
            },
        };
        await logSharedItem(item, { date: '2026-10-12', duration: 110, calories: 700 });

        expect(addWorkout).toHaveBeenCalledWith({
            date: '2026-10-12', activity_type: 'Hike', duration: 110, intensity: 'Hard',
            source: 'manual', distance: 9000, elevation_gain: 600, calories: 700,
        });
        expect(upsertDailyLog).toHaveBeenCalledWith({ date: '2026-10-12', movement_completed: true });
        expect(statusUpdate).toHaveBeenCalledWith({ status: 'saved' });
    });

    it('leaves calories empty when I don’t enter my own', async () => {
        const item: SharedItem = {
            ...base,
            item_type: 'logged_activity',
            payload: { name: 'Ride', date: '2026-10-12', activity_type: 'Ride', duration: 60, intensity: 'Moderate' },
        };
        await logSharedItem(item, { date: '2026-10-12', duration: 60 });
        expect(vi.mocked(addWorkout).mock.calls[0][0]).not.toHaveProperty('calories');
    });

    it('refuses library-type shares, and save refuses logged types', async () => {
        const template: SharedItem = { ...base, item_type: 'favorite_food', payload: { name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5 } };
        await expect(logSharedItem(template, { date: '2026-10-12', portion: 1 })).rejects.toThrow();

        const meal: SharedItem = { ...base, item_type: 'logged_meal', payload: { name: 'X', date: '2026-10-12', food_items: [] } };
        await expect(saveSharedItem(meal)).rejects.toThrow(/logSharedItem/);
        expect(statusUpdate).not.toHaveBeenCalled();
    });

    it('classifies share types', () => {
        expect(isLoggedShare('logged_meal')).toBe(true);
        expect(isLoggedShare('logged_activity')).toBe(true);
        expect(isLoggedShare('saved_meal')).toBe(false);
    });
});
