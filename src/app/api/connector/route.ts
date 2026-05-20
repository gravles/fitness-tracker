import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { subDays, format } from 'date-fns';

function authenticate(req: NextRequest): boolean {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return false;
    return authHeader.slice(7) === process.env.CONNECTOR_API_KEY;
}

function avg(arr: Record<string, unknown>[] | null, field: string): number | null {
    if (!arr?.length) return null;
    const values = arr.map(r => r[field]).filter((v): v is number => typeof v === 'number');
    if (!values.length) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export async function GET(req: NextRequest) {
    if (!authenticate(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = process.env.CONNECTOR_USER_ID;
    if (!userId) {
        return NextResponse.json({ error: 'CONNECTOR_USER_ID not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 365);
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');

    const [logsResult, workoutsResult, metricsResult, settingsResult] = await Promise.all([
        supabaseAdmin
            .from('daily_logs')
            .select('date,movement_completed,eating_window_start,eating_window_end,nutrition_logged,protein_grams,carbs_grams,fat_grams,calories,alcohol_drinks,sleep_quality,energy_level,motivation_level,stress_level,daily_note,habits,food_items')
            .eq('user_id', userId)
            .gte('date', startDate)
            .lte('date', today)
            .order('date', { ascending: false }),

        supabaseAdmin
            .from('workouts')
            .select('date,activity_type,duration,intensity,notes')
            .eq('user_id', userId)
            .gte('date', startDate)
            .lte('date', today)
            .order('date', { ascending: false }),

        supabaseAdmin
            .from('body_metrics')
            .select('date,weight,measurements')
            .eq('user_id', userId)
            .gte('date', startDate)
            .lte('date', today)
            .order('date', { ascending: false }),

        supabaseAdmin
            .from('user_settings')
            .select('target_calories,target_protein,target_weight,total_xp,current_level')
            .eq('user_id', userId)
            .maybeSingle(),
    ]);

    const logs = logsResult.data ?? [];
    const workouts = workoutsResult.data ?? [];
    const metrics = metricsResult.data ?? [];
    const settings = settingsResult.data;

    return NextResponse.json({
        fetched_at: new Date().toISOString(),
        date_range: { start: startDate, end: today, days },
        user_goals: settings
            ? {
                  target_calories: settings.target_calories,
                  target_protein_grams: settings.target_protein,
                  target_weight: settings.target_weight,
                  current_level: settings.current_level,
                  total_xp: settings.total_xp,
              }
            : null,
        summary: {
            days_logged: logs.length,
            days_with_movement: logs.filter(l => l.movement_completed).length,
            total_workouts: workouts.length,
            avg_calories: avg(logs, 'calories'),
            avg_protein_grams: avg(logs, 'protein_grams'),
            avg_sleep_quality: avg(logs, 'sleep_quality'),
            avg_energy_level: avg(logs, 'energy_level'),
            avg_stress_level: avg(logs, 'stress_level'),
            latest_weight: metrics[0]?.weight ?? null,
            latest_weight_date: metrics[0]?.date ?? null,
        },
        daily_logs: logs,
        workouts,
        body_metrics: metrics,
    });
}
