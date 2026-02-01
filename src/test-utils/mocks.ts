import { vi } from 'vitest';

/**
 * Mock Supabase client for testing
 */
export const mockSupabaseClient = {
    from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
        getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'test-user-id' } },
            error: null
        }),
        getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'test-user-id' } } },
            error: null
        }),
    },
};

/**
 * Helper to set up Supabase mock responses
 */
export function mockSupabaseResponse<T>(data: T, error: Error | null = null) {
    return vi.fn().mockResolvedValue({ data, error });
}

/**
 * Helper to create a mock daily log
 */
export function createMockDailyLog(overrides: Record<string, unknown> = {}) {
    return {
        id: 'test-log-id',
        user_id: 'test-user-id',
        date: '2026-01-31',
        movement_completed: false,
        movement_type: null,
        movement_duration: null,
        movement_intensity: null,
        calories: null,
        protein_grams: null,
        habits: [],
        food_items: [],
        created_at: '2026-01-31T00:00:00Z',
        updated_at: '2026-01-31T00:00:00Z',
        ...overrides,
    };
}

/**
 * Helper to create a mock workout
 */
export function createMockWorkout(overrides: Record<string, unknown> = {}) {
    return {
        id: 'test-workout-id',
        user_id: 'test-user-id',
        date: '2026-01-31',
        activity_type: 'Strength Training',
        duration: 60,
        intensity: 'Moderate' as const,
        notes: '',
        source: 'manual' as const,
        created_at: '2026-01-31T00:00:00Z',
        ...overrides,
    };
}

/**
 * Helper to create mock user settings
 */
export function createMockUserSettings(overrides: Record<string, unknown> = {}) {
    return {
        user_id: 'test-user-id',
        target_weight: 70,
        target_calories: 2000,
        target_protein: 150,
        enable_cycle_tracking: false,
        custom_habits: ['Drink Water', 'Sleep 8 Hours'],
        available_equipment: ['Dumbbells', 'Barbell'],
        total_xp: 100,
        current_level: 2,
        ...overrides,
    };
}
