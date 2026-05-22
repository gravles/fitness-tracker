/**
 * program-api.ts
 * All logic for the 12-week program feature: sessions, 1RM tracking, scheduling.
 */

import { supabase } from './supabase';
import { format, addDays } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionType   = 'strength' | 'cardio' | 'mobility';
export type SessionStatus = 'upcoming' | 'completed' | 'skipped' | 'modified' | 'rescheduled';

export interface StrengthExercise {
    name:      string;
    sets:      number;
    reps:      string;   // "8-10", "6", "12-15"
    load_pct:  number;   // % of 1RM
    // Runtime-computed from 1RM table, not stored in DB:
    target_weight?: number;
}

export interface CardioExercise {
    name:         string;
    duration_min: number;
    zone?:        number;   // 1–5 HR zone
    intensity?:   string;   // "easy", "moderate", "hard", "intervals"
}

export type ProgramExercise = StrengthExercise | CardioExercise;

export interface ProgramSession {
    id:                   string;
    program_id:           string;
    user_id:              string;
    week_number:          number;
    day_number:           number;
    day_label:            string;
    session_type:         SessionType;
    scheduled_date:       string;   // YYYY-MM-DD
    exercises:            ProgramExercise[];
    original_exercises?:  ProgramExercise[] | null;
    status:               SessionStatus;
    completed_workout_id?: string | null;
    notes?:               string | null;
    created_at?:          string;
    updated_at?:          string;
}

export interface ProgramStats {
    total:     number;
    completed: number;
    skipped:   number;
    upcoming:  number;
    adherence: number;   // completed / (completed + skipped) * 100, or 0
}

// ─── 1RM Utilities ────────────────────────────────────────────────────────────

/** Epley formula: estimate 1RM from any set */
export function epley1RM(weight: number, reps: number): number {
    if (reps <= 1) return weight;
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Convert a load percentage to an actual weight, rounded to nearest 2.5 kg */
export function pctToWeight(oneRM: number, pct: number): number {
    const raw = oneRM * (pct / 100);
    return Math.round(raw / 2.5) * 2.5;
}

/**
 * Get the most recent estimated 1RM for every exercise the user has logged.
 * Returns a map: exercise_name → estimated_1rm (kg)
 */
export async function getAll1RMs(): Promise<Record<string, number>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return {};

    const { data } = await supabase
        .from('exercise_records')
        .select('exercise_name, estimated_1rm, recorded_at')
        .eq('user_id', session.user.id)
        .order('recorded_at', { ascending: false });

    if (!data) return {};

    // One entry per exercise — first occurrence is the most recent (ORDER BY desc above)
    const result: Record<string, number> = {};
    for (const row of data) {
        if (!result[row.exercise_name]) {
            result[row.exercise_name] = Number(row.estimated_1rm);
        }
    }
    return result;
}

/**
 * Scan the last 90 days of logged workout sets and compute Epley 1RM estimates
 * for each exercise. Used to seed the 1RM table when scheduling a fresh program.
 */
export async function estimate1RMsFromHistory(): Promise<Record<string, number>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return {};

    const since = format(addDays(new Date(), -90), 'yyyy-MM-dd');

    const { data: workouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', session.user.id)
        .gte('date', since);

    if (!workouts?.length) return {};

    const { data: exercises } = await supabase
        .from('workout_exercises')
        .select('exercise_name, workout_sets(weight, reps, completed)')
        .in('workout_id', workouts.map(w => w.id));

    if (!exercises) return {};

    const best: Record<string, number> = {};
    for (const ex of exercises) {
        for (const s of (ex.workout_sets as any[] || [])) {
            if (!s.completed || !s.weight || !s.reps) continue;
            const est = epley1RM(Number(s.weight), Number(s.reps));
            if (!best[ex.exercise_name] || est > best[ex.exercise_name]) {
                best[ex.exercise_name] = est;
            }
        }
    }
    return best;
}

/**
 * Save a 1RM estimate (called after each workout to keep estimates fresh).
 */
export async function saveExercise1RM(
    exerciseName: string,
    estimatedOnerm: number,
    actualWeight: number,
    actualReps: number,
    source: 'calculated' | 'manual' = 'calculated'
): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('exercise_records').insert({
        user_id:       session.user.id,
        exercise_name: exerciseName,
        estimated_1rm: estimatedOnerm,
        actual_weight: actualWeight,
        actual_reps:   actualReps,
        source,
    });
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

/**
 * Bulk-create program_sessions from the program's weeks array.
 * Deletes any existing sessions for this program first (supports re-scheduling).
 * Returns the number of sessions created.
 */
export async function scheduleProgramSessions(
    programId: string,
    weeks:      any[],
    startDate:  Date
): Promise<number> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Remove stale sessions if user is re-scheduling
    await supabase
        .from('program_sessions')
        .delete()
        .eq('program_id', programId)
        .eq('user_id', session.user.id);

    const inserts: any[] = [];

    for (const week of weeks) {
        for (const day of week.days || []) {
            const sessionType: SessionType = day.session_type || 'strength';
            // Skip pure rest days
            if (!day.exercises || day.exercises.length === 0) continue;

            const dayOffset = (week.week - 1) * 7 + (day.day - 1);
            const date      = format(addDays(startDate, dayOffset), 'yyyy-MM-dd');

            inserts.push({
                program_id:     programId,
                user_id:        session.user.id,
                week_number:    week.week,
                day_number:     day.day,
                day_label:      day.label,
                session_type:   sessionType,
                scheduled_date: date,
                exercises:      day.exercises,
                status:         'upcoming',
            });
        }
    }

    for (let i = 0; i < inserts.length; i += 50) {
        const { error } = await supabase
            .from('program_sessions')
            .insert(inserts.slice(i, i + 50));
        if (error) throw error;
    }

    return inserts.length;
}

// ─── Querying ─────────────────────────────────────────────────────────────────

/** Sessions within a date range — used by the calendar week view */
export async function getProgramSessionsForRange(
    startDate: string,
    endDate:   string
): Promise<ProgramSession[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
        .from('program_sessions')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true })
        .order('day_number',     { ascending: true });

    if (error) throw error;
    return (data || []) as ProgramSession[];
}

/** Single session by ID — used by the workout logger */
export async function getProgramSession(id: string): Promise<ProgramSession | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data } = await supabase
        .from('program_sessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', session.user.id)
        .maybeSingle();
    return data as ProgramSession | null;
}

/** All sessions for a program — used by the program detail / hub view */
export async function getProgramSessions(programId: string): Promise<ProgramSession[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
        .from('program_sessions')
        .select('*')
        .eq('program_id', programId)
        .eq('user_id',    session.user.id)
        .order('week_number', { ascending: true })
        .order('day_number',  { ascending: true });

    if (error) throw error;
    return (data || []) as ProgramSession[];
}

/** Completion stats for a program */
export async function getProgramStats(programId: string): Promise<ProgramStats> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { total: 0, completed: 0, skipped: 0, upcoming: 0, adherence: 0 };

    const { data } = await supabase
        .from('program_sessions')
        .select('status')
        .eq('program_id', programId)
        .eq('user_id',    session.user.id);

    const all       = data || [];
    const completed = all.filter(s => s.status === 'completed').length;
    const skipped   = all.filter(s => s.status === 'skipped').length;
    const done      = completed + skipped;
    return {
        total:     all.length,
        completed,
        skipped,
        upcoming:  all.filter(s => s.status === 'upcoming' || s.status === 'rescheduled').length,
        adherence: done > 0 ? Math.round((completed / done) * 100) : 0,
    };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function updateProgramSession(
    id:      string,
    updates: Partial<Pick<ProgramSession,
        'status' | 'scheduled_date' | 'exercises' |
        'notes'  | 'completed_workout_id' | 'original_exercises'>>
): Promise<ProgramSession> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('program_sessions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id',      id)
        .eq('user_id', session.user.id)
        .select()
        .single();

    if (error) throw error;
    return data as ProgramSession;
}

/**
 * Skip a session.
 * cascade=true: push every later upcoming session in the program back by 1 day.
 */
export async function skipProgramSession(id: string, cascade = false): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data: sess, error: fetchErr } = await supabase
        .from('program_sessions')
        .select('*')
        .eq('id', id)
        .single();
    if (fetchErr || !sess) throw new Error('Session not found');

    await supabase.from('program_sessions')
        .update({ status: 'skipped', updated_at: new Date().toISOString() })
        .eq('id', id);

    if (cascade) {
        const { data: future } = await supabase
            .from('program_sessions')
            .select('id, scheduled_date')
            .eq('program_id', sess.program_id)
            .eq('user_id',    session.user.id)
            .in('status',     ['upcoming', 'rescheduled'])
            .gt('scheduled_date', sess.scheduled_date)
            .order('scheduled_date', { ascending: true });

        for (const s of (future || [])) {
            const shifted = format(
                addDays(new Date(s.scheduled_date + 'T00:00:00'), 1),
                'yyyy-MM-dd'
            );
            await supabase.from('program_sessions')
                .update({ scheduled_date: shifted, status: 'rescheduled', updated_at: new Date().toISOString() })
                .eq('id', s.id);
        }
    }
}

/** Mark a session complete and link it to a workout log entry */
export async function completeProgramSession(
    sessionId:         string,
    completedWorkoutId: string
): Promise<void> {
    await updateProgramSession(sessionId, {
        status:               'completed',
        completed_workout_id: completedWorkoutId,
    });
}
