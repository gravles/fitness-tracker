// Pure helpers for sharing already-logged meals and activities between
// partners. No Supabase here — partner-api.ts does the reads and writes.
import type { FoodItem, Workout } from './api';

export interface LoggedMealPayload {
    name: string;
    /** yyyy-MM-dd the sender ate it — the recipient logs to the same day by default */
    date: string;
    food_items: FoodItem[];
}

export interface LoggedActivityPayload {
    name: string;
    date: string;
    activity_type: string;
    duration: number;
    intensity: Workout['intensity'];
    distance?: number;        // meters
    elevation_gain?: number;  // meters
    notes?: string;
}

// Per-sender capture metadata that shouldn't follow the food to someone else's log
const SENDER_ONLY_FOOD_FIELDS = ['id', 'logged_at', 'source'];

export function buildMealPayload(items: FoodItem[], date: string): LoggedMealPayload {
    const food_items = items.map(item => {
        const copy: FoodItem = { ...item };
        for (const key of SENDER_ONLY_FOOD_FIELDS) delete copy[key];
        return copy;
    });
    const name = items.length === 1
        ? items[0].name
        : `${items[0].name} + ${items.length - 1} more`;
    return { name, date, food_items };
}

/**
 * Heart rate, calories burned, speed and Strava ids are the sender's own
 * physiology or account — only what both people did together is copied.
 */
export function buildActivityPayload(workout: Workout): LoggedActivityPayload {
    return {
        name: workout.activity_type,
        date: workout.date,
        activity_type: workout.activity_type,
        duration: workout.duration,
        intensity: workout.intensity,
        ...(workout.distance ? { distance: workout.distance } : {}),
        ...(workout.elevation_gain ? { elevation_gain: workout.elevation_gain } : {}),
        ...(workout.notes ? { notes: workout.notes } : {}),
    };
}

const baseQuantity = (item: FoodItem) => {
    const q = parseFloat(String(item.quantity ?? 1));
    return isNaN(q) || q <= 0 ? 1 : q;
};

/** Apply the recipient's share of the meal via the existing quantity multiplier. */
export function scaleFoodItems(items: FoodItem[], portion: number): FoodItem[] {
    return items.map(item => ({
        ...item,
        quantity: Math.round(baseQuantity(item) * portion * 100) / 100,
    }));
}

export function mealTotals(items: FoodItem[]): { calories: number; protein: number } {
    return items.reduce((acc, item) => {
        const q = baseQuantity(item);
        return {
            calories: acc.calories + (item.calories || 0) * q,
            protein: acc.protein + (item.protein || 0) * q,
        };
    }, { calories: 0, protein: 0 });
}

// Manual presets say "Cycling", Strava says "Ride"/"VirtualRide" — compare by family
const ACTIVITY_FAMILIES: Record<string, string[]> = {
    cycling: ['cycling', 'cycle', 'ride', 'bike', 'biking', 'virtualride', 'ebikeride', 'mountainbikeride', 'gravelride'],
    running: ['running', 'run', 'jog', 'jogging', 'trailrun', 'virtualrun'],
    walking: ['walking', 'walk'],
    hiking: ['hiking', 'hike'],
    swimming: ['swimming', 'swim'],
};

export function activityFamily(activityType: string): string {
    const key = activityType.toLowerCase().replace(/[^a-z]/g, '');
    for (const [family, aliases] of Object.entries(ACTIVITY_FAMILIES)) {
        if (aliases.includes(key)) return family;
    }
    return key;
}

/** A same-day workout of the same kind — likely already synced (e.g. both on Strava). */
export function findLikelyDuplicate(existing: Workout[], payload: LoggedActivityPayload): Workout | null {
    const family = activityFamily(payload.activity_type);
    return existing.find(w => w.date === payload.date && activityFamily(w.activity_type) === family) ?? null;
}
