import { supabase } from './supabase';
import { format } from 'date-fns';

export interface PlannedMeal {
    id: string;
    user_id: string;
    meal_id: string | null;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    scheduled_date: string; // YYYY-MM-DD
    slot: string;
    scheduled_time: string | null; // HH:MM:SS
    notes: string | null;
    status: 'planned' | 'logged' | 'skipped';
    skipped_reason: string | null;
    linked_food_log_id: string | null;
    actual_calories: number | null;
    actual_protein: number | null;
    actual_carbs: number | null;
    actual_fat: number | null;
    created_at: string;
    updated_at: string;
}

/**
 * Get all planned meal entries for today, in slot/time order, regardless of status.
 * Used by the dashboard's "today's meal plan" card.
 */
export async function getTodaysPlannedMeals(): Promise<PlannedMeal[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const today = format(new Date(), 'yyyy-MM-dd');

    const { data, error } = await supabase
        .from('planned_meals')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('scheduled_date', today)
        .order('scheduled_time', { ascending: true });

    if (error) {
        console.error('Error fetching today\'s planned meals:', error);
        return [];
    }
    return data || [];
}

/**
 * Convert a planned meal into an actual logged food entry — the one-tap
 * "log as planned" action. Mirrors the MCP log_food(planned_meal_id) path:
 * copies the plan's macros as defaults, applies any overrides, appends to
 * the day's food_items, and marks the planned entry logged.
 */
export async function logPlannedMealAsEaten(
    entry: PlannedMeal,
    overrides?: { name?: string; calories?: number; protein?: number; carbs?: number; fat?: number }
): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const item = {
        id:       crypto.randomUUID(),
        name:     overrides?.name     ?? entry.name,
        calories: overrides?.calories ?? entry.calories,
        protein:  overrides?.protein  ?? entry.protein,
        carbs:    overrides?.carbs    ?? entry.carbs,
        fat:      overrides?.fat      ?? entry.fat,
    };

    const { data: existing } = await supabase
        .from('daily_logs')
        .select('food_items,calories,protein_grams,carbs_grams,fat_grams')
        .eq('user_id', session.user.id)
        .eq('date', entry.scheduled_date)
        .maybeSingle();

    interface FoodItem { calories?: number; protein?: number; carbs?: number; fat?: number }

    interface Totals { calories: number; protein_grams: number; carbs_grams: number; fat_grams: number }

    const items = [...((existing?.food_items as FoodItem[]) ?? []), item];
    const totals = items.reduce<Totals>(
        (a, i) => ({
            calories:      a.calories      + (i.calories ?? 0),
            protein_grams: a.protein_grams + (i.protein  ?? 0),
            carbs_grams:   a.carbs_grams   + (i.carbs    ?? 0),
            fat_grams:     a.fat_grams     + (i.fat      ?? 0),
        }),
        { calories: 0, protein_grams: 0, carbs_grams: 0, fat_grams: 0 }
    );

    const { error: logErr } = await supabase
        .from('daily_logs')
        .upsert(
            { user_id: session.user.id, date: entry.scheduled_date, food_items: items, nutrition_logged: true, ...totals, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,date' }
        );
    if (logErr) throw logErr;

    const { error: planErr } = await supabase
        .from('planned_meals')
        .update({
            status:             'logged',
            linked_food_log_id: item.id,
            actual_calories:    item.calories,
            actual_protein:     item.protein,
            actual_carbs:       item.carbs,
            actual_fat:         item.fat,
            updated_at:         new Date().toISOString(),
        })
        .eq('id', entry.id)
        .eq('user_id', session.user.id);
    if (planErr) throw planErr;
}
