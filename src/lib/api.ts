import { supabase } from './supabase';

export interface DailyLog {
    id?: string;
    user_id?: string;
    date: string; // YYYY-MM-DD
    movement_completed: boolean;
    movement_type?: string | null;
    movement_duration?: number | null;
    movement_intensity?: string | null;
    movement_notes?: string | null;
    eating_window_start?: string | null;
    eating_window_end?: string | null;
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

// ... imports ...
import { subDays, format, differenceInCalendarDays, parseISO } from 'date-fns';

// ... existing code ...

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
    // Ideally this should be a stored procedure for performance, but client-side is fine for MVP
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

    // Now count backwards
    // We need to iterate and check for gaps
    // Since data is ordered desc, we can just checking difference

    // We can't just iterate the array because there might be multiple entries (unlikely due to unique constraint)
    // or gaps.

    // Let's create a Set of dates for easy lookup
    const loggedDates = new Set(data.map(d => d.date));

    // Check today
    if (loggedDates.has(todayStr)) {
        streak++;
    }

    // Check yesterday and backwards
    let currentCheck = subDays(today, loggedDates.has(todayStr) ? 1 : 0); // If we logged today, verify yesterday. If we NOT logged today, we start verifying from yesterday (streak might be active if we moved yesterday). Wait, if we didn't log today, streak is maintained if we logged yesterday.

    // Re-logic:
    // If today is logged, current streak = 1 + ...
    // If today is NOT logged, but yesterday IS, current streak = ... (starts from yesterday)

    let checkDate = today;
    if (!loggedDates.has(todayStr)) {
        checkDate = subDays(today, 1);
        if (!loggedDates.has(yesterdayStr)) return 0; // neither today nor yesterday
    }

    while (true) {
        const checkStr = format(checkDate, 'yyyy-MM-dd');
        if (loggedDates.has(checkStr)) {
            // Only increment if we didn't already count it (i.e. if we started with today)
            // Actually, simpler loop:
            // start from "most recent valid streak day" and go back 1 day at a time
        } else {
            break;
        }
        checkDate = subDays(checkDate, 1);
    }

    // Alternative Simple Logic using the sorted array:
    // 1. Determine "Anchor Day" (Today or Yesterday). If neither, 0.
    // 2. Count consecutive days backwards from Anchor Day.

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
