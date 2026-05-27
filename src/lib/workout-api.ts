import { supabase } from './supabase';

export interface WorkoutTemplate {
    id: string;
    author_id: string;
    name: string;
    created_at: string;
    exercises?: TemplateExercise[];
}

export interface TemplateExercise {
    id: string;
    template_id: string;
    exercise_name: string;
    order_index: number;
    target_sets: number;
    target_reps: string;
}

export interface WorkoutSet {
    id: string;
    exercise_id: string;
    set_number: number;
    weight: number | null;
    reps: number | null;
    completed: boolean;
}

export interface WorkoutExercise {
    id: string;
    workout_id: string;
    exercise_name: string;
    order_index: number;
    sets?: WorkoutSet[];
}

// --- Templates ---

export async function getTemplates() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('author_id', session.user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function createTemplate(name: string, exercises: Omit<TemplateExercise, 'id' | 'template_id' | 'created_at'>[]) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Convert to JSONB format expected by new schema
    const exercisesJson = exercises.map((e, idx) => ({
        name: e.exercise_name,
        sets: e.target_sets,
        reps: e.target_reps,
        order: idx
    }));

    const { data: template, error } = await supabase
        .from('workout_templates')
        .insert({
            author_id: session.user.id,
            name,
            exercises: exercisesJson,
            is_public: false,
            category: 'custom'
        })
        .select()
        .single();

    if (error) throw error;
    return template;
}

// --- Active Workout Logging ---

export async function createWorkoutExercise(workoutId: string, name: string, order: number) {
    const { data, error } = await supabase
        .from('workout_exercises')
        .insert({
            workout_id: workoutId,
            exercise_name: name,
            order_index: order
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function logSet(exerciseId: string, setNumber: number, weight: number, reps: number, completed = true) {
    const { data, error } = await supabase
        .from('workout_sets')
        .insert({
            exercise_id: exerciseId,
            set_number: setNumber,
            weight,
            reps,
            completed
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Insert or update a set. Uses existingId if provided; otherwise checks for
 * an existing row with the same (exercise_id, set_number) before inserting.
 */
export async function upsertWorkoutSet(
    exerciseId: string,
    setNumber: number,
    weight: number,
    reps: number,
    completed: boolean,
    existingId?: string
): Promise<WorkoutSet> {
    if (existingId) {
        const { data, error } = await supabase
            .from('workout_sets')
            .update({ weight, reps, completed })
            .eq('id', existingId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    // Check for an existing row with the same exercise + set number
    const { data: existing } = await supabase
        .from('workout_sets')
        .select('id')
        .eq('exercise_id', exerciseId)
        .eq('set_number', setNumber)
        .maybeSingle();

    if (existing) {
        const { data, error } = await supabase
            .from('workout_sets')
            .update({ weight, reps, completed })
            .eq('id', existing.id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    const { data, error } = await supabase
        .from('workout_sets')
        .insert({ exercise_id: exerciseId, set_number: setNumber, weight, reps, completed })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function getWorkoutDetails(workoutId: string) {
    const { data, error } = await supabase
        .from('workouts') // The parent logs table
        .select(`
            *,
            exercises:workout_exercises(
                *,
                sets:workout_sets(*)
            )
        `)
        .eq('id', workoutId)
        .single();

    if (error) throw error;

    // Sort correctly
    if (data.exercises) {
        data.exercises.sort((a: any, b: any) => a.order_index - b.order_index);
        data.exercises.forEach((ex: any) => {
            if (ex.sets) ex.sets.sort((a: any, b: any) => a.set_number - b.set_number);
        });
    }

    return data;
}

export async function getLastSetsForExercise(exerciseName: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    // Scan last 30 workouts for the most recent occurrence of this exercise
    const { data, error } = await supabase
        .from('workouts')
        .select(`id, date, exercises:workout_exercises(exercise_name, sets:workout_sets(set_number, weight, reps, completed))`)
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(30);

    if (error || !data) return null;

    for (const workout of data) {
        const match = workout.exercises?.find(
            (e: any) => e.exercise_name.toLowerCase() === exerciseName.toLowerCase()
        );
        if (match?.sets?.length) {
            const completed = match.sets
                .filter((s: any) => s.completed)
                .sort((a: any, b: any) => a.set_number - b.set_number);
            if (completed.length) return { date: workout.date, sets: completed };
        }
    }
    return null;
}

export async function getRecentExerciseNames(limit = 40): Promise<string[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
        .from('workouts')
        .select('exercises:workout_exercises(exercise_name)')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(20);

    if (error || !data) return [];

    const seen = new Set<string>();
    const names: string[] = [];
    for (const w of data) {
        for (const ex of (w.exercises as any[]) || []) {
            const key = ex.exercise_name.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                names.push(ex.exercise_name);
            }
        }
        if (names.length >= limit) break;
    }
    return names;
}

export async function getExerciseHistory(exerciseName: string, limit = 10) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
        .from('workouts')
        .select(`date, exercises:workout_exercises(exercise_name, sets:workout_sets(set_number, weight, reps, completed))`)
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(50);

    if (error || !data) return [];

    const history: { date: string; sets: any[] }[] = [];
    for (const workout of data) {
        const match = workout.exercises?.find(
            (e: any) => e.exercise_name.toLowerCase() === exerciseName.toLowerCase()
        );
        if (match?.sets?.length) {
            const completedSets = match.sets
                .filter((s: any) => s.completed && s.weight && s.reps)
                .sort((a: any, b: any) => a.set_number - b.set_number);
            if (completedSets.length) {
                history.push({ date: workout.date, sets: completedSets });
                if (history.length >= limit) break;
            }
        }
    }
    return history;
}

export async function deleteWorkoutExercises(workoutId: string) {
    const { error } = await supabase
        .from('workout_exercises')
        .delete()
        .eq('workout_id', workoutId);

    if (error) throw error;
}

// --- Template Management ---

export async function deleteTemplate(templateId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', templateId)
        .eq('author_id', session.user.id); // Only delete own templates

    if (error) throw error;
}

export async function updateTemplate(
    templateId: string,
    updates: {
        name?: string;
        exercises?: { name: string; sets: number; reps: string }[];
        category?: 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'custom';
        description?: string;
    }
) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const updateData: Record<string, unknown> = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.exercises) updateData.exercises = updates.exercises;
    if (updates.category) updateData.category = updates.category;
    if (updates.description !== undefined) updateData.description = updates.description;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('workout_templates')
        .update(updateData)
        .eq('id', templateId)
        .eq('author_id', session.user.id) // Only update own templates
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getTemplateById(templateId: string) {
    const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('id', templateId)
        .single();

    if (error) throw error;
    return data;
}
