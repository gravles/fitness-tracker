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
