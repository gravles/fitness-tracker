import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

// Create Supabase client (server-side)
function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

/**
 * Widget API - Returns compact data for native widgets
 * Supports: daily stats, streak, XP summary
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const widgetType = searchParams.get('type') || 'daily';
        const userId = searchParams.get('user_id');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const supabase = getSupabaseClient();
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');

        switch (widgetType) {
            case 'daily': {
                // Get today's log
                const { data: log } = await supabase
                    .from('daily_logs')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('date', todayStr)
                    .single();

                // Get today's workouts
                const { data: workouts } = await supabase
                    .from('workouts')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('date', todayStr);

                const workoutMinutes = workouts?.reduce((acc: number, w: { duration?: number }) => acc + (w.duration || 0), 0) || 0;

                return NextResponse.json({
                    type: 'daily',
                    date: todayStr,
                    data: {
                        moved: log?.movement_completed || false,
                        nutrition: log?.nutrition_logged || false,
                        workoutMinutes,
                        workoutCount: workouts?.length || 0,
                        sleep: log?.sleep_hours || null,
                        water: log?.water_glasses || null,
                        mood: log?.mood || null,
                    },
                    updatedAt: new Date().toISOString(),
                });
            }

            case 'streak': {
                // Calculate current streak
                const { data: logs } = await supabase
                    .from('daily_logs')
                    .select('date, movement_completed')
                    .eq('user_id', userId)
                    .order('date', { ascending: false })
                    .limit(90);

                let streak = 0;
                if (logs) {
                    for (const log of logs) {
                        if (log.movement_completed) {
                            streak++;
                        } else {
                            break;
                        }
                    }
                }

                return NextResponse.json({
                    type: 'streak',
                    data: {
                        current: streak,
                        emoji: streak >= 7 ? '🔥' : streak >= 3 ? '💪' : '✨',
                        message: streak >= 7 ? 'On Fire!' : streak >= 3 ? 'Keep Going!' : 'Start Strong!',
                    },
                    updatedAt: new Date().toISOString(),
                });
            }

            case 'xp': {
                // Get XP and level
                const { data: xpData } = await supabase
                    .from('xp_events')
                    .select('xp_amount')
                    .eq('user_id', userId);

                const totalXP = xpData?.reduce((acc: number, e: { xp_amount: number }) => acc + e.xp_amount, 0) || 0;
                const level = Math.floor(Math.sqrt(totalXP / 100)) + 1;
                const xpForNextLevel = Math.pow(level, 2) * 100;
                const xpForCurrentLevel = Math.pow(level - 1, 2) * 100;
                const progress = ((totalXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;

                return NextResponse.json({
                    type: 'xp',
                    data: {
                        level,
                        totalXP,
                        progress: Math.round(progress),
                        xpToNext: xpForNextLevel - totalXP,
                    },
                    updatedAt: new Date().toISOString(),
                });
            }

            case 'summary': {
                // Quick summary for lock screen widget
                const { data: log } = await supabase
                    .from('daily_logs')
                    .select('movement_completed, nutrition_logged')
                    .eq('user_id', userId)
                    .eq('date', todayStr)
                    .single();

                const { data: workouts } = await supabase
                    .from('workouts')
                    .select('duration')
                    .eq('user_id', userId)
                    .eq('date', todayStr);

                const completedTasks = [
                    log?.movement_completed,
                    log?.nutrition_logged,
                    (workouts?.length || 0) > 0,
                ].filter(Boolean).length;

                return NextResponse.json({
                    type: 'summary',
                    data: {
                        completed: completedTasks,
                        total: 3,
                        emoji: completedTasks === 3 ? '🎉' : completedTasks >= 2 ? '💪' : '📋',
                        label: `${completedTasks}/3 Complete`,
                    },
                    updatedAt: new Date().toISOString(),
                });
            }

            default:
                return NextResponse.json({ error: 'Unknown widget type' }, { status: 400 });
        }
    } catch (error) {
        console.error('Widget API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
