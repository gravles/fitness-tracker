import { supabase } from './supabase';
import { format } from 'date-fns';

export interface ScheduledWorkout {
    id: string;
    user_id: string;
    template_id: string | null;
    scheduled_date: string; // YYYY-MM-DD
    scheduled_time: string; // HH:MM:SS
    title: string;
    notes: string | null;
    status: 'scheduled' | 'completed' | 'skipped' | 'rescheduled';
    completed_workout_id: string | null;
    reminder_sent: boolean;
    remind_minutes: number | null;
    created_at: string;
    updated_at: string;
    // Joined data
    template?: {
        id: string;
        name: string;
        exercises: any[];
    };
}

/**
 * Get scheduled workouts for a date range
 */
export async function getScheduledWorkouts(startDate: string, endDate: string): Promise<ScheduledWorkout[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('scheduled_workouts')
        .select(`
            *,
            template:workout_templates(id, name, exercises)
        `)
        .eq('user_id', session.user.id)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * Get upcoming workouts (for dashboard)
 */
export async function getUpcomingWorkouts(limit = 5): Promise<ScheduledWorkout[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const today = format(new Date(), 'yyyy-MM-dd');

    const { data, error } = await supabase
        .from('scheduled_workouts')
        .select(`
            *,
            template:workout_templates(id, name, exercises)
        `)
        .eq('user_id', session.user.id)
        .gte('scheduled_date', today)
        .eq('status', 'scheduled')
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(limit);

    if (error) throw error;
    return data || [];
}

/**
 * Get workouts for today (for notifications)
 */
export async function getTodaysScheduledWorkouts(): Promise<ScheduledWorkout[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const today = format(new Date(), 'yyyy-MM-dd');

    const { data, error } = await supabase
        .from('scheduled_workouts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('scheduled_date', today)
        .eq('status', 'scheduled');

    if (error) {
        console.error('Error fetching today\'s workouts:', error);
        return [];
    }
    return data || [];
}

/**
 * Schedule a new workout
 */
export async function scheduleWorkout(workout: {
    templateId?: string;
    date: string;
    time: string;
    title: string;
    notes?: string;
    remindMinutes?: number;
}): Promise<ScheduledWorkout> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('scheduled_workouts')
        .insert({
            user_id: session.user.id,
            template_id: workout.templateId || null,
            scheduled_date: workout.date,
            scheduled_time: workout.time,
            title: workout.title,
            notes: workout.notes || null,
            status: 'scheduled',
            remind_minutes: workout.remindMinutes ?? 15,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update a scheduled workout
 */
export async function updateScheduledWorkout(
    id: string,
    updates: {
        date?: string;
        time?: string;
        title?: string;
        notes?: string;
        status?: 'scheduled' | 'completed' | 'skipped' | 'rescheduled';
        completedWorkoutId?: string;
        reminderSent?: boolean;
    }
): Promise<ScheduledWorkout> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (updates.date) updateData.scheduled_date = updates.date;
    if (updates.time) updateData.scheduled_time = updates.time;
    if (updates.title) updateData.title = updates.title;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.status) updateData.status = updates.status;
    if (updates.completedWorkoutId) updateData.completed_workout_id = updates.completedWorkoutId;
    if (updates.reminderSent !== undefined) updateData.reminder_sent = updates.reminderSent;

    const { data, error } = await supabase
        .from('scheduled_workouts')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', session.user.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete a scheduled workout
 */
export async function deleteScheduledWorkout(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('scheduled_workouts')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);

    if (error) throw error;
}

/**
 * Mark a scheduled workout as completed
 */
export async function markWorkoutCompleted(
    scheduleId: string,
    workoutId: string
): Promise<ScheduledWorkout> {
    return updateScheduledWorkout(scheduleId, {
        status: 'completed',
        completedWorkoutId: workoutId,
    });
}

/**
 * Skip a scheduled workout
 */
export async function skipScheduledWorkout(id: string): Promise<ScheduledWorkout> {
    return updateScheduledWorkout(id, { status: 'skipped' });
}

// Note: scheduleProgramToCalendar and getProgramStats have been moved to
// src/lib/program-api.ts — use scheduleProgramSessions and getProgramStats from there.
