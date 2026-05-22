import { supabase } from './supabase';
import { format, addDays } from 'date-fns';

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
    created_at: string;
    updated_at: string;
    program_id?: string | null;
    program_week?: number | null;
    exercises?: any[] | null;
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

/**
 * Bulk-schedule all training days of a program to the calendar.
 * Returns the number of sessions created.
 */
export async function scheduleProgramToCalendar(
    programId: string,
    weeks: any[],
    startDate: Date
): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Remove any existing scheduled workouts for this program (re-schedule)
    await supabase
        .from('scheduled_workouts')
        .delete()
        .eq('user_id', session.user.id)
        .eq('program_id', programId);

    const inserts: any[] = [];

    for (const week of weeks) {
        for (const day of week.days || []) {
            if (!day.exercises || day.exercises.length === 0) continue; // skip rest days

            const dayOffset = (week.week - 1) * 7 + (day.day - 1);
            const date = format(addDays(startDate, dayOffset), 'yyyy-MM-dd');
            const exerciseSummary = day.exercises
                .slice(0, 3)
                .map((e: any) => `${e.name} ${e.sets}×${e.reps}`)
                .join(', ');
            const moreCount = day.exercises.length - 3;

            inserts.push({
                user_id: session.user.id,
                program_id: programId,
                program_week: week.week,
                scheduled_date: date,
                scheduled_time: '07:00:00',
                title: `Week ${week.week} · ${day.label}`,
                notes: exerciseSummary + (moreCount > 0 ? ` +${moreCount} more` : ''),
                exercises: day.exercises,
                status: 'scheduled',
            });
        }
    }

    // Insert in batches of 50 to avoid request size limits
    for (let i = 0; i < inserts.length; i += 50) {
        const { error } = await supabase
            .from('scheduled_workouts')
            .insert(inserts.slice(i, i + 50));
        if (error) throw error;
    }

    return inserts.length;
}

/**
 * Get completion stats for a program
 */
export async function getProgramStats(programId: string): Promise<{ total: number; completed: number }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { total: 0, completed: 0 };

    const { data } = await supabase
        .from('scheduled_workouts')
        .select('status')
        .eq('user_id', session.user.id)
        .eq('program_id', programId);

    const all = data || [];
    return {
        total: all.length,
        completed: all.filter((w: any) => w.status === 'completed').length,
    };
}
