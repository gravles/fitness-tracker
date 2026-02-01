import { supabase } from './supabase';

// =====================================================
// PROGRESS PHOTOS
// =====================================================

export interface ProgressPhoto {
    id: string;
    user_id: string;
    photo_url: string;
    thumbnail_url?: string;
    weight_at_capture?: number;
    body_fat_at_capture?: number;
    notes?: string;
    created_at: string;
}

/**
 * Upload a progress photo to Supabase Storage and create a record
 */
export async function uploadProgressPhoto(
    file: File,
    metadata: {
        weight?: number;
        bodyFat?: number;
        notes?: string;
    }
): Promise<ProgressPhoto> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `${user.id}/${Date.now()}.${ext}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(filename, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('progress-photos')
        .getPublicUrl(filename);

    // Create database record
    const { data, error } = await supabase
        .from('progress_photos')
        .insert({
            user_id: user.id,
            photo_url: urlData.publicUrl,
            weight_at_capture: metadata.weight || null,
            body_fat_at_capture: metadata.bodyFat || null,
            notes: metadata.notes || null,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Get all progress photos for the current user
 */
export async function getProgressPhotos(): Promise<ProgressPhoto[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Delete a progress photo
 */
export async function deleteProgressPhoto(id: string): Promise<void> {
    const { error } = await supabase
        .from('progress_photos')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// =====================================================
// USER GOALS
// =====================================================

export type GoalType = 'lose_weight' | 'build_muscle' | 'maintain' | 'improve_fitness' | 'custom';

export interface UserGoal {
    id: string;
    user_id: string;
    goal_type: GoalType;
    title: string;
    description?: string;
    target_value?: number;
    target_unit?: string;
    current_value?: number;
    target_date?: string;
    ai_recommendations?: {
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
        weekly_workouts?: number;
        advice?: string;
    };
    is_active: boolean;
    completed_at?: string;
    created_at: string;
    updated_at: string;
}

/**
 * Get the user's active goal
 */
export async function getActiveGoal(): Promise<UserGoal | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data || null;
}

/**
 * Create a new goal
 */
export async function createGoal(goal: Partial<UserGoal>): Promise<UserGoal> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Deactivate any existing active goals
    await supabase
        .from('user_goals')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

    const { data, error } = await supabase
        .from('user_goals')
        .insert({
            ...goal,
            user_id: user.id,
            is_active: true,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Update goal progress
 */
export async function updateGoalProgress(id: string, currentValue: number): Promise<UserGoal> {
    const { data, error } = await supabase
        .from('user_goals')
        .update({
            current_value: currentValue,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Complete a goal
 */
export async function completeGoal(id: string): Promise<void> {
    const { error } = await supabase
        .from('user_goals')
        .update({
            is_active: false,
            completed_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) throw error;
}

// =====================================================
// WORKOUT TEMPLATES
// =====================================================

export type WorkoutCategory = 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'custom';
export type WorkoutDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface TemplateExercise {
    name: string;
    sets: number;
    reps: string;
    rest?: number;
    notes?: string;
}

export interface WorkoutTemplate {
    id: string;
    name: string;
    description?: string;
    category?: WorkoutCategory;
    difficulty?: WorkoutDifficulty;
    exercises: TemplateExercise[];
    estimated_duration?: number;
    is_public: boolean;
    is_featured: boolean;
    author_id?: string;
    use_count: number;
    created_at: string;
}

/**
 * Get all public workout templates
 */
export async function getPublicTemplates(category?: WorkoutCategory): Promise<WorkoutTemplate[]> {
    let query = supabase
        .from('workout_templates')
        .select('*')
        .eq('is_public', true)
        .order('is_featured', { ascending: false })
        .order('use_count', { ascending: false });

    if (category) {
        query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/**
 * Get user's saved templates
 */
export async function getUserTemplates(): Promise<WorkoutTemplate[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Save a workout as a template
 */
export async function saveAsTemplate(
    name: string,
    exercises: TemplateExercise[],
    options: {
        description?: string;
        category?: WorkoutCategory;
        difficulty?: WorkoutDifficulty;
        estimatedDuration?: number;
        isPublic?: boolean;
    } = {}
): Promise<WorkoutTemplate> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('workout_templates')
        .insert({
            name,
            exercises,
            description: options.description,
            category: options.category || 'custom',
            difficulty: options.difficulty || 'intermediate',
            estimated_duration: options.estimatedDuration,
            is_public: options.isPublic || false,
            author_id: user.id,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Use a template (increment use count)
 */
export async function useTemplate(id: string): Promise<WorkoutTemplate> {
    const { data, error } = await supabase.rpc('increment_template_use', { template_id: id });

    // Fallback if RPC doesn't exist
    if (error) {
        const { data: template } = await supabase
            .from('workout_templates')
            .select('*')
            .eq('id', id)
            .single();
        return template;
    }
    return data;
}

// =====================================================
// SOCIAL SHARING
// =====================================================

export interface SharedAchievement {
    id: string;
    user_id: string;
    achievement_type: 'badge' | 'pr' | 'streak' | 'goal' | 'level';
    achievement_data: Record<string, any>;
    share_token: string;
    view_count: number;
    expires_at: string;
    created_at: string;
}

/**
 * Share an achievement and get a share link
 */
export async function shareAchievement(
    type: SharedAchievement['achievement_type'],
    data: Record<string, any>
): Promise<{ shareUrl: string; token: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: share, error } = await supabase
        .from('shared_achievements')
        .insert({
            user_id: user.id,
            achievement_type: type,
            achievement_data: data,
        })
        .select()
        .single();

    if (error) throw error;

    const shareUrl = `${window.location.origin}/share/${share.share_token}`;
    return { shareUrl, token: share.share_token };
}

/**
 * Get a shared achievement by token
 */
export async function getSharedAchievement(token: string): Promise<SharedAchievement | null> {
    const { data, error } = await supabase
        .from('shared_achievements')
        .select('*')
        .eq('share_token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

    if (error) return null;

    // Increment view count
    await supabase
        .from('shared_achievements')
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq('id', data.id);

    return data;
}
