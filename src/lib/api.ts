import { supabase } from './supabase';
import { subDays, format, parseISO } from 'date-fns';

export interface DailyLog {
    id?: string;
    user_id?: string;
    date: string; // YYYY-MM-DD
    movement_completed?: boolean;
    movement_type?: string | null; // Deprecated in favor of workouts table
    movement_duration?: number | null; // Deprecated
    movement_intensity?: string | null; // Deprecated
    movement_notes?: string | null;
    eating_window_start?: string | null;
    eating_window_end?: string | null;
    nutrition_logged?: boolean;
    protein_grams?: number | null;
    carbs_grams?: number | null;
    fat_grams?: number | null;
    calories?: number | null;
    alcohol_drinks?: number | null;
    alcohol_time?: string | null;
    sleep_quality?: number | null;
    energy_level?: number | null;
    motivation_level?: number | null;
    stress_level?: number | null;
    daily_note?: string | null;
    notes?: string | null;  // Alias for subjective note 
    habits?: string[] | null;
    habits_completed?: string[] | null;
    available_habits?: string[] | null;
    xp_earned?: number | null;
    food_items?: any[] | null; // { name, calories, protein, carbs, fat }
    menstrual_flow?: string | null;
    created_at?: string;
    updated_at?: string;
}


export interface Workout {
    id?: string;
    user_id?: string;
    date: string;
    activity_type: string;
    duration: number; // minutes
    intensity: 'Light' | 'Moderate' | 'Hard';
    notes?: string;
    distance?: number; // meters
    calories?: number;
    average_heartrate?: number;
    max_heartrate?: number;
    elevation_gain?: number; // meters
    average_speed?: number; // m/s
    external_id?: string;
    source?: 'manual' | 'strava';
    created_at?: string;
}

export interface BodyMetrics {
    id?: string;
    user_id?: string;
    date: string;
    weight?: number | null;
    photo_url?: string | null;
    measurements?: Record<string, number> | null;
    created_at?: string;
}

export async function getDailyLog(date: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', date)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
    }

    return data as DailyLog | null;
}

export async function getWorkoutByDate(date: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', date)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Workout | null;
}

export async function updateWorkout(id: string, updates: Partial<Workout>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('workouts')
        .update(updates)
        .eq('id', id)
        .eq('user_id', session.user.id) // Security
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function upsertDailyLog(log: Partial<DailyLog>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    try {
        const { data, error } = await supabase
            .from('daily_logs')
            .upsert({
                ...log,
                user_id: session.user.id,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,date' })
            .select()
            .single();

        if (error) {
            console.error('\n\n\n[SUPABASE UPSERT ERROR]', error, '\n\n\n');
            throw error;
        }
        return data as DailyLog;
    } catch (error: any) {
        console.error('\n\n\n[SUPABASE CATCH BLOCK ERROR]', error, '\n\n\n');
        // Simple offline check: if fetch failed or specifically network error
        if (typeof window !== 'undefined' && (!navigator.onLine || error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError'))) {
            console.log('Offline: Queuing daily log update');
            const { MutationQueue } = await import('./queue');

            // Queue it
            MutationQueue.enqueue('LOG_DAILY', { ...log, user_id: session.user.id });

            // Return optimistic data
            return {
                ...log,
                user_id: session.user.id,
                updated_at: new Date().toISOString()
            } as DailyLog;
        }
        throw error;
    }
}


export async function getMonthlyLogs(startDate: string, endDate: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    if (error) throw error;
    return data as DailyLog[];
}

export async function getStreak() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 0;

    // Fetch last 100 days of history to calculate streak
    const { data } = await supabase
        .from('daily_logs')
        .select('date, movement_completed')
        .eq('user_id', session.user.id)
        .eq('movement_completed', true)
        .order('date', { ascending: false })
        .limit(100);

    if (!data || data.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    // Normalize today to YYYY-MM-DD to avoid time issues
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

    // Check if the most recent log is today or yesterday. 
    // If the most recent log is older than yesterday, streak is broken (0).
    const lastLogDate = data[0].date;

    if (lastLogDate !== todayStr && lastLogDate !== yesterdayStr) {
        return 0;
    }

    // Let's create a Set of dates for easy lookup
    const loggedDates = new Set(data.map(d => d.date));

    const anchorDateStr = loggedDates.has(todayStr) ? todayStr : (loggedDates.has(yesterdayStr) ? yesterdayStr : null);
    if (!anchorDateStr) return 0;

    streak = 0;
    let curr = parseISO(anchorDateStr);

    while (loggedDates.has(format(curr, 'yyyy-MM-dd'))) {
        streak++;
        curr = subDays(curr, 1);
    }

    return streak;
}

export async function upsertBodyMetrics(metrics: Partial<BodyMetrics>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('body_metrics')
        .upsert({
            ...metrics,
            user_id: session.user.id,
        }, { onConflict: 'user_id,date' })
        .select()
        .single();

    if (error) throw error;
    return data as BodyMetrics;
}

export async function getBodyMetricsHistory(startDate: string, endDate: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('body_metrics')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    if (error) throw error;
    return data as BodyMetrics[];
}

export interface UserSettings {
    user_id?: string;
    target_weight?: number | null;
    target_calories?: number | null;
    target_protein?: number | null;
    enable_cycle_tracking?: boolean;
    custom_habits?: string[];
    available_equipment?: string[];
    // Gamification
    total_xp?: number;
    current_level?: number;
}

export async function getSettings() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

    // It's okay if no settings exist yet, return defaults or null
    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;

    return data as UserSettings;
}

export async function updateSettings(settings: Partial<UserSettings>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    try {
        const { data, error } = await supabase
            .from('user_settings')
            .upsert({
                ...settings,
                user_id: session.user.id,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data as UserSettings;
    } catch (error: any) {
        if (typeof window !== 'undefined' && (!navigator.onLine || error.message?.includes('Failed to fetch'))) {
            console.log('Offline: Queuing settings update');
            const { MutationQueue } = await import('./queue');

            MutationQueue.enqueue('UPDATE_SETTINGS', { ...settings, user_id: session.user.id });

            return {
                ...settings,
                user_id: session.user.id,
            } as UserSettings;
        }
        throw error;
    }
}

// Workout API
export async function getWorkouts(date: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', date)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data as Workout[];
}

export async function getWorkoutsRange(startDate: string, endDate: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data as Workout[];
}

export async function addWorkout(workout: Omit<Workout, 'id' | 'user_id' | 'created_at'>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    try {
        const { data, error } = await supabase
            .from('workouts')
            .insert({
                ...workout,
                user_id: session.user.id
            })
            .select()
            .single();

        if (error) throw error;
        return data as Workout;
    } catch (error: any) {
        if (typeof window !== 'undefined' && (!navigator.onLine || error.message?.includes('Failed to fetch'))) {
            console.log('Offline: Queuing workout addition');
            const { MutationQueue } = await import('./queue');

            MutationQueue.enqueue('ADD_WORKOUT', { ...workout, user_id: session.user.id });

            // Optimistic return
            return {
                ...workout,
                id: `temp-${Date.now()}`,
                user_id: session.user.id,
                created_at: new Date().toISOString()
            } as Workout;
        }
        throw error;
    }
}

export async function deleteWorkout(id: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);

    if (error) throw error;
}

// Gamification API
export interface UserBadge {
    id?: string;
    badge_id: string;
    earned_at: string;
    metadata?: any;
}

export async function getUserBadges() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', session.user.id);

    if (error) {
        console.error('Error fetching badges:', error);
        return [];
    }
    return data as UserBadge[];
}

export async function awardBadge(badgeId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: existing } = await supabase
        .from('user_badges')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('badge_id', badgeId)
        .single();

    if (existing) return;

    const { error } = await supabase
        .from('user_badges')
        .insert({
            user_id: session.user.id,
            badge_id: badgeId
        });

    if (error) console.error('Error awarding badge:', error);
}

export async function getLifetimeLogCount(): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 0;
    const { count } = await supabase
        .from('daily_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id);
    return count || 0;
}

export async function updateUserXP(xpToAdd: number) {
    const settings = await getSettings();
    if (!settings) return;

    const currentXP = settings.total_xp || 0;
    const newXP = currentXP + xpToAdd;
    const newLevel = Math.floor(newXP / 100) + 1;

    await updateSettings({
        ...settings,
        total_xp: newXP,
        current_level: newLevel
    });

    return { newXP, newLevel, leveledUp: newLevel > (settings.current_level || 1) };
}

export async function recalculateTotalXP() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // 1. Fetch History (Last 365 days max for now)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 365);

    // Use getMonthlyLogs to fetch range
    const logs = await getMonthlyLogs(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
    const settings = await getSettings();
    if (!settings) return null;

    // 2. Calculate Total
    const { calculateXP } = await import('./gamification');

    const targets = {
        daily_protein: settings.target_protein || 0,
        daily_calories: settings.target_calories || 0
    };

    let totalXP = 0;
    logs.forEach(log => {
        totalXP += calculateXP(log, targets);
    });

    // 3. Update Settings
    const newLevel = Math.floor(totalXP / 100) + 1;

    await updateSettings({
        ...settings,
        total_xp: totalXP,
        current_level: newLevel
    });

    return { totalXP, newLevel };
}

// Favorites & History API

export interface FavoriteFood {
    id: string;
    user_id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    portion_estimate?: string;
    created_at: string;
}

export async function getFavoriteFoods() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('favorite_foods')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name', { ascending: true });

    if (error) throw error;
    return data as FavoriteFood[];
}

export async function addFavoriteFood(item: Omit<FavoriteFood, 'id' | 'user_id' | 'created_at'>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('favorite_foods')
        .insert({
            ...item,
            user_id: session.user.id
        })
        .select()
        .single();

    if (error) throw error;
    return data as FavoriteFood;
}

export async function deleteFavoriteFood(id: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('favorite_foods')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);

    if (error) throw error;
}

// ─── Nutrition Planner ──────────────────────────────────────────────────────

export interface PantryItem {
    id: string;
    user_id?: string;
    name: string;
    category: 'Protein' | 'Carbs' | 'Vegetables' | 'Dairy' | 'Fats' | 'Other';
    prep_time: 'no-prep' | 'quick' | 'standard' | 'extended';
    calories_per_100g?: number | null;
    protein_per_100g?: number | null;
    carbs_per_100g?: number | null;
    fat_per_100g?: number | null;
    notes?: string | null;
    created_at?: string;
}

export interface PlannedMeal {
    name: string;
    prep_time_min: number;
    ingredients: string[];
    instructions?: string;
    macros: { calories: number; protein: number; carbs: number; fat: number };
}

export interface MealPlan {
    id?: string;
    week_start: string;
    meals: Record<string, PlannedMeal | null>; // key: "2026-05-21_breakfast"
}

export interface NutritionPrefs {
    breakfast_prep_min: number;
    lunch_prep_min: number;
    dinner_prep_min: number;
    dietary_notes: string;
}

export const DEFAULT_NUTRITION_PREFS: NutritionPrefs = {
    breakfast_prep_min: 10,
    lunch_prep_min: 15,
    dinner_prep_min: 30,
    dietary_notes: '',
};

export async function getPantryItems(): Promise<PantryItem[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', session.user.id)
        .order('category')
        .order('name');
    if (error) throw error;
    return data as PantryItem[];
}

export async function addPantryItem(item: Omit<PantryItem, 'id' | 'user_id' | 'created_at'>): Promise<PantryItem> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const { data, error } = await supabase
        .from('pantry_items')
        .insert({ ...item, user_id: session.user.id })
        .select()
        .single();
    if (error) throw error;
    return data as PantryItem;
}

export async function deletePantryItem(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);
    if (error) throw error;
}

export async function getMealPlan(weekStart: string): Promise<MealPlan | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('week_start', weekStart)
        .maybeSingle();
    return data as MealPlan | null;
}

export async function saveMealPlan(weekStart: string, meals: MealPlan['meals']): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase
        .from('meal_plans')
        .upsert(
            { user_id: session.user.id, week_start: weekStart, meals, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,week_start' }
        );
    if (error) throw error;
}

export async function getNutritionPrefs(): Promise<NutritionPrefs> {
    const settings = await getSettings();
    const prefs = settings?.nutrition_prefs;
    if (!prefs || Object.keys(prefs).length === 0) return DEFAULT_NUTRITION_PREFS;
    return { ...DEFAULT_NUTRITION_PREFS, ...prefs } as NutritionPrefs;
}

export async function saveNutritionPrefs(prefs: NutritionPrefs): Promise<void> {
    await updateSettings({ nutrition_prefs: prefs } as any);
}

export async function getRecentFoods(limit = 1000) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Fetch last 90 days of logs
    const today = new Date();
    const startDate = subDays(today, 90).toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('daily_logs')
        .select('food_items')
        .eq('user_id', session.user.id)
        .gte('date', startDate)
        .not('food_items', 'is', null)
        .order('date', { ascending: false });

    if (error) throw error;

    // Flatten and deduplicate
    const allItems: any[] = [];
    const seenNames = new Set<string>();

    data?.forEach(log => {
        if (Array.isArray(log.food_items)) {
            log.food_items.forEach((item: any) => {
                const normName = item.name.trim().toLowerCase();
                if (!seenNames.has(normName)) {
                    seenNames.add(normName);
                    allItems.push(item);
                }
            });
        }
    });

    return allItems.slice(0, limit);
}
