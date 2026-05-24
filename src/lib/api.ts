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
    source?: string | null;
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

    // A day counts toward the streak if the user logged anything at all:
    // nutrition (nutrition_logged = true OR calories > 0) OR movement logged.
    // Fetch the date of every row — filtering is done client-side.
    const { data } = await supabase
        .from('daily_logs')
        .select('date, movement_completed, nutrition_logged, calories')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(100);

    if (!data || data.length === 0) return 0;

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

    // A day counts if movement OR nutrition was recorded
    const loggedDates = new Set(
        data
            .filter(d => d.movement_completed || d.nutrition_logged || (d.calories && d.calories > 0))
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
    // Nutrition
    nutrition_prefs?: NutritionPrefs | null;
    // Profile
    display_name?: string | null;
    date_of_birth?: string | null;   // ISO date "YYYY-MM-DD"
    height_cm?: number | null;
    fitness_goal?: string | null;    // 'lose_weight' | 'build_muscle' | 'maintain' | 'improve_fitness'
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

/** Exponential XP curve: each level requires 15% more XP than the last.
 *  Level 1→2: 100 XP, Level 2→3: 115 XP, Level 10→11: ~405 XP, etc.
 *  Formula: level = floor(log(1 + xp * 0.15 / 100) / log(1.15)) + 1
 */
export function levelFromXP(xp: number): number {
    if (xp <= 0) return 1;
    return Math.floor(Math.log(1 + xp * 0.15 / 100) / Math.log(1.15)) + 1;
}

/** XP required to reach a given level (cumulative from 0) */
export function xpForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.round(100 * (Math.pow(1.15, level - 1) - 1) / 0.15);
}

export async function updateUserXP(xpToAdd: number) {
    const settings = await getSettings();
    if (!settings) return;

    const currentXP = settings.total_xp || 0;
    const newXP = currentXP + xpToAdd;
    const newLevel = levelFromXP(newXP);

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

// ─── Saved Meals ──────────────────────────────────────────────────────────────

export interface SavedMeal {
    id: string;
    user_id?: string;
    name: string;
    food_items: any[];
    total_calories: number;
    total_protein: number;
    total_carbs: number;
    total_fat: number;
    use_count: number;
    created_at?: string;
}

export async function getSavedMeals(): Promise<SavedMeal[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
        .from('saved_meals')
        .select('*')
        .eq('user_id', session.user.id)
        .order('use_count', { ascending: false });
    if (error) throw error;
    return data as SavedMeal[];
}

export async function createSavedMeal(name: string, foodItems: any[]): Promise<SavedMeal> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const totals = foodItems.reduce((acc, f) => ({
        calories: acc.calories + Math.round(f.calories || 0),
        protein: acc.protein + Math.round(f.protein || 0),
        carbs: acc.carbs + Math.round(f.carbs || 0),
        fat: acc.fat + Math.round(f.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    const { data, error } = await supabase
        .from('saved_meals')
        .insert({ user_id: session.user.id, name, food_items: foodItems, ...totals })
        .select().single();
    if (error) throw error;
    return data as SavedMeal;
}

export async function deleteSavedMeal(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('saved_meals').delete()
        .eq('id', id).eq('user_id', session.user.id);
    if (error) throw error;
}

export async function incrementSavedMealUseCount(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
        await supabase.rpc('increment_saved_meal_use_count', { meal_id: id });
    } catch {
        // Fallback: fetch current count and update
        const { data } = await supabase.from('saved_meals').select('use_count').eq('id', id).single();
        if (data) {
            await supabase.from('saved_meals').update({ use_count: (data.use_count || 0) + 1 }).eq('id', id);
        }
    }
}

// ─── Coach Messages ───────────────────────────────────────────────────────────

export interface CoachMessage {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    suggested_workout?: any;
    created_at?: string;
}

export async function getCoachMessages(): Promise<CoachMessage[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })
        .limit(200);
    if (error) throw error;
    return data as CoachMessage[];
}

export async function saveCoachMessage(msg: Omit<CoachMessage, 'id' | 'created_at'>): Promise<CoachMessage> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const { data, error } = await supabase
        .from('coach_messages')
        .insert({ ...msg, user_id: session.user.id })
        .select().single();
    if (error) throw error;
    return data as CoachMessage;
}

export async function clearCoachMessages(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('coach_messages').delete()
        .eq('user_id', session.user.id);
    if (error) throw error;
}

// ─── Accountability Partners ──────────────────────────────────────────────────

export interface AccountabilityPartner {
    id: string;
    partner_email: string;
    partner_name?: string | null;
    status: 'active' | 'paused';
    created_at?: string;
}

export async function getAccountabilityPartners(): Promise<AccountabilityPartner[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
        .from('accountability_partners')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data as AccountabilityPartner[];
}

export async function addAccountabilityPartner(email: string, name?: string): Promise<AccountabilityPartner> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const { data, error } = await supabase
        .from('accountability_partners')
        .insert({ user_id: session.user.id, partner_email: email.toLowerCase().trim(), partner_name: name || null })
        .select().single();
    if (error) throw error;
    return data as AccountabilityPartner;
}

export async function deleteAccountabilityPartner(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('accountability_partners').delete()
        .eq('id', id).eq('user_id', session.user.id);
    if (error) throw error;
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export interface Integration {
    id?: string;
    provider: string;
    access_token?: string | null;
    refresh_token?: string | null;
    token_expires_at?: string | null;
    provider_user_id?: string | null;
    metadata?: Record<string, any> | null;
    created_at?: string;
    updated_at?: string;
}

export async function getIntegrations(): Promise<Integration[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', session.user.id);
    if (error) throw error;
    return data as Integration[];
}

export async function getIntegration(provider: string): Promise<Integration | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('provider', provider)
        .maybeSingle();
    return data as Integration | null;
}

export async function upsertIntegration(provider: string, updates: Partial<Integration>): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const { error } = await supabase.from('integrations').upsert(
        { ...updates, user_id: session.user.id, provider, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,provider' }
    );
    if (error) throw error;
}

export async function deleteIntegration(provider: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('integrations').delete()
        .eq('user_id', session.user.id).eq('provider', provider);
    if (error) throw error;
}

// ─── Training Programs ────────────────────────────────────────────────────────

export interface ProgramWeek {
    week: number;
    phase: string;
    volume_modifier: number; // 1.0 = normal, 0.5 = deload
    days: {
        day: number;
        label: string; // 'Upper A', 'Lower A', 'Rest', etc.
        exercises: { name: string; sets: number; reps: string; load_pct?: number }[];
    }[];
}

export interface TrainingProgram {
    id: string;
    name: string;
    goal: 'strength' | 'hypertrophy' | 'endurance' | 'athletic';
    duration_weeks: number;
    days_per_week?: number | null;
    phases: { name: string; weeks: string; description: string }[];
    weeks: ProgramWeek[];
    status: 'draft' | 'active' | 'paused' | 'completed';
    start_date?: string | null;
    paused_at?: string | null;
    completed_at?: string | null;
    created_at?: string;
}

export async function getTrainingPrograms(): Promise<TrainingProgram[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data as TrainingProgram[];
}

export async function getActiveProgram(): Promise<TrainingProgram | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data } = await supabase
        .from('training_programs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle();
    return data as TrainingProgram | null;
}

export async function createTrainingProgram(program: Omit<TrainingProgram, 'id' | 'created_at'>): Promise<TrainingProgram> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    // Pause any existing active program first
    if (program.status === 'active') {
        await supabase.from('training_programs')
            .update({ status: 'paused' })
            .eq('user_id', session.user.id)
            .eq('status', 'active');
    }
    const { data, error } = await supabase
        .from('training_programs')
        .insert({ ...program, user_id: session.user.id })
        .select().single();
    if (error) throw error;
    return data as TrainingProgram;
}

export async function updateTrainingProgram(id: string, updates: Partial<TrainingProgram>): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('training_programs')
        .update(updates).eq('id', id).eq('user_id', session.user.id);
    if (error) throw error;
}

export async function deleteTrainingProgram(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('training_programs').delete()
        .eq('id', id).eq('user_id', session.user.id);
    if (error) throw error;
}

export async function getExerciseRecords(exerciseName?: string): Promise<any[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    let q = supabase.from('exercise_records').select('*').eq('user_id', session.user.id);
    if (exerciseName) q = q.eq('exercise_name', exerciseName);
    const { data, error } = await q.order('recorded_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function recordExercisePR(exerciseName: string, weight: number, reps: number): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const estimated1rm = Math.round(weight * (1 + reps / 30));
    const { error } = await supabase.from('exercise_records').insert({
        user_id: session.user.id,
        exercise_name: exerciseName,
        estimated_1rm: estimated1rm,
        actual_weight: weight,
        actual_reps: reps,
    });
    if (error) console.error('PR record error', error);
}
