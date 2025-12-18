import { supabase } from './supabase';
import { subDays, format, parseISO } from 'date-fns';

export interface DailyLog {
    id?: string;
    user_id?: string;
    date: string; // YYYY-MM-DD
    movement_completed: boolean;
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
    habits?: string[] | null;
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

export async function upsertDailyLog(log: Partial<DailyLog>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('daily_logs')
        .upsert({
            ...log,
            user_id: session.user.id,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,date' })
        .select()
        .single();

    if (error) throw error;
    return data as DailyLog;
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

export async function addWorkout(workout: Omit<Workout, 'id' | 'user_id' | 'created_at'>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

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
