import { supabase } from './supabase';

export interface ExerciseStats {
    date: string;
    weight: number;
    reps: number;
    estimated_1rm: number;
    volume: number;
}

export interface PersonalRecord {
    exercise_name: string;
    max_weight: number;
    date: string;
}

// Epley Formula: 1RM = weight * (1 + reps/30)
export function calculateOneRepMax(weight: number, reps: number): number {
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30));
}

export async function getUniqueExercises() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Get distinct exercise names from workout_exercises
    const { data, error } = await supabase
        .from('workout_exercises')
        .select('exercise_name')
        .order('exercise_name');

    if (error) throw error;

    // Deduplicate names (case insensitive ideally, but doing it simply here)
    const unique = Array.from(new Set(data.map(d => d.exercise_name)));
    return unique.sort();
}

export async function getExerciseHistory(exerciseName: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Join workout_exercises -> workouts to get the DATE
    // Join workout_exercises -> workout_sets to get the DATA

    // Step 1: Get all instances of this exercise
    const { data: exercises, error } = await supabase
        .from('workout_exercises')
        .select(`
            id,
            exercise_name,
            workouts (
                date
            ),
            workout_sets (
                weight,
                reps,
                completed
            )
        `)
        // Filter by user via the joined workouts table policies (RLS handles this generally, but supabase join filtering can be tricky)
        // Actually, RLS on workout_exercises checks exists(workouts where properties...) which is good.
        // But we want to filter by exercise name specifically.
        .eq('exercise_name', exerciseName)
        .not('workouts', 'is', null) // Ensure parent workout exists
        .order('created_at', { ascending: true }); // chronological

    if (error) throw error;
    if (!exercises) return [];

    // Step 2: Flatten and Transform
    const history: ExerciseStats[] = [];

    exercises.forEach((ex: any) => {
        if (!ex.workouts || !ex.workout_sets) return;
        const date = ex.workouts.date;

        // We want the "Best Set" of the day for the chart? 
        // Or specific sets? Usually charts show the Max Weight or Max 1RM achieved that day.

        // Let's find the max 1RM set for this session
        let max1RM = 0;
        let maxWeight = 0;
        let maxReps = 0;
        let totalVolume = 0;

        ex.workout_sets.forEach((set: any) => {
            if (!set.completed || !set.weight || !set.reps) return;

            const w = Number(set.weight);
            const r = Number(set.reps);

            totalVolume += w * r;

            const rm = calculateOneRepMax(w, r);
            if (rm > max1RM) {
                max1RM = rm;
                maxWeight = w;
                maxReps = r;
            }
        });

        if (max1RM > 0) {
            history.push({
                date,
                weight: maxWeight,
                reps: maxReps,
                estimated_1rm: max1RM,
                volume: totalVolume
            });
        }
    });

    // Sort by date just in case
    return history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function getPersonalRecords() {
    // This could be heavy, so we might want to cache or optimize later.
    // Ideally, we fetch all exercises and crunch in JS for MVP since unique exercises count is low (<100 likely).

    const exercises = await getUniqueExercises();
    const records: PersonalRecord[] = [];

    // Parallel fetch is risky for rate limits if too many, but for MVP let's batch partially or just serial.
    // Actually, SQL aggregation would be better but requires complex query.
    // Let's iterate for now (MVP).

    for (const name of exercises) {
        const history = await getExerciseHistory(name);
        if (history.length === 0) continue;

        // Find max weight
        const maxLift = history.reduce((max, curr) => curr.weight > max.weight ? curr : max, history[0]);

        records.push({
            exercise_name: name,
            max_weight: maxLift.weight,
            date: maxLift.date
        });
    }

    return records.sort((a, b) => b.max_weight - a.max_weight); // Sort by weight? Or name? Let's do Name for list.
}
