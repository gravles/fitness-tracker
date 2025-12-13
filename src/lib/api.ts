import { supabase } from './supabase';

export interface DailyLog {
    id?: string;
    user_id?: string;
    date: string; // YYYY-MM-DD
    movement_completed: boolean;
    movement_type?: string;
    movement_duration?: number;
    movement_intensity?: string;
    movement_notes?: string;
    eating_window_start?: string;
    eating_window_end?: string;
    protein_grams?: number;
    carbs_grams?: number;
    fat_grams?: number;
    calories?: number;
    alcohol_drinks?: number;
    alcohol_time?: string;
    sleep_quality?: number;
    energy_level?: number;
    motivation_level?: number;
    stress_level?: number;
    daily_note?: string;
    created_at?: string;
    updated_at?: string;
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

export async function getStreak() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 0;

    // improved query could be a stored procedure, for now detailed query might be heavy
    // simple approximate: check last 7 days? Or just rely on client calc for MVP
    // For MVP, let's fetch last 30 days and calc locally
    const { data } = await supabase
        .from('daily_logs')
        .select('date, movement_completed')
        .eq('user_id', session.user.id)
        .eq('movement_completed', true)
        .order('date', { ascending: false })
        .limit(100);

    if (!data || data.length === 0) return 0;

    // Logic to calculate streak would go here
    // This is a placeholder for the Dashboard
    return 0; // TODO impl streak logic
}
