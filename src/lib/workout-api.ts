import { supabase } from './supabase';

export interface WorkoutTemplate {
    id: string;
    user_id: string;
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
        .select(`
            *,
            exercises:template_exercises(*)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as WorkoutTemplate[];
}

export async function createTemplate(name: string, exercises: Omit<TemplateExercise, 'id' | 'template_id' | 'created_at'>[]) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // 1. Create Header
    const { data: template, error: tError } = await supabase
        .from('workout_templates')
        .insert({ user_id: session.user.id, name })
        .select()
        .single();

    if (tError) throw tError;

    // 2. Create Exercises
    if (exercises.length > 0) {
        const { error: eError } = await supabase
            .from('template_exercises')
            .insert(exercises.map((e, idx) => ({
                template_id: template.id,
                exercise_name: e.exercise_name,
                order_index: idx,
                target_sets: e.target_sets,
                target_reps: e.target_reps
            })));

        if (eError) throw eError;
    }

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

export async function deleteWorkoutExercises(workoutId: string) {
    const { error } = await supabase
        .from('workout_exercises')
        .delete()
        .eq('workout_id', workoutId);

    if (error) throw error;
}
