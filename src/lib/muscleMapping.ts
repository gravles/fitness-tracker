
export const MUSCLE_GROUPS = {
    CHEST: 'Chest',
    BACK: 'Back',
    SHOULDERS: 'Shoulders',
    BICEPS: 'Biceps',
    TRICEPS: 'Triceps',
    FOREARMS: 'Forearms',
    ABS: 'Abs',
    QUADS: 'Quads',
    HAMSTRINGS: 'Hamstrings',
    CALVES: 'Calves',
    GLUTES: 'Glutes',
    CARDIO: 'Cardio' // General full body / legs
} as const;

export type MuscleGroup = typeof MUSCLE_GROUPS[keyof typeof MUSCLE_GROUPS];

// Keyword mapping for auto-detection
const EXERCISE_MAPPINGS: Record<string, MuscleGroup[]> = {
    // Push
    'bench': [MUSCLE_GROUPS.CHEST, MUSCLE_GROUPS.TRICEPS, MUSCLE_GROUPS.SHOULDERS],
    'push up': [MUSCLE_GROUPS.CHEST, MUSCLE_GROUPS.TRICEPS, MUSCLE_GROUPS.ABS],
    'pushup': [MUSCLE_GROUPS.CHEST, MUSCLE_GROUPS.TRICEPS, MUSCLE_GROUPS.ABS],
    'dip': [MUSCLE_GROUPS.TRICEPS, MUSCLE_GROUPS.CHEST, MUSCLE_GROUPS.SHOULDERS],
    'overhead': [MUSCLE_GROUPS.SHOULDERS, MUSCLE_GROUPS.TRICEPS],
    'shoulder': [MUSCLE_GROUPS.SHOULDERS],
    'military': [MUSCLE_GROUPS.SHOULDERS, MUSCLE_GROUPS.TRICEPS],
    'fly': [MUSCLE_GROUPS.CHEST],
    'raise': [MUSCLE_GROUPS.SHOULDERS],

    // Pull
    'pull up': [MUSCLE_GROUPS.BACK, MUSCLE_GROUPS.BICEPS],
    'pullup': [MUSCLE_GROUPS.BACK, MUSCLE_GROUPS.BICEPS],
    'chin up': [MUSCLE_GROUPS.BACK, MUSCLE_GROUPS.BICEPS],
    'row': [MUSCLE_GROUPS.BACK, MUSCLE_GROUPS.BICEPS],
    'lat': [MUSCLE_GROUPS.BACK],
    'curl': [MUSCLE_GROUPS.BICEPS],
    'face pull': [MUSCLE_GROUPS.SHOULDERS, MUSCLE_GROUPS.BACK],

    // Legs
    'squat': [MUSCLE_GROUPS.QUADS, MUSCLE_GROUPS.GLUTES, MUSCLE_GROUPS.ABS],
    'deadlift': [MUSCLE_GROUPS.BACK, MUSCLE_GROUPS.HAMSTRINGS, MUSCLE_GROUPS.GLUTES],
    'lunge': [MUSCLE_GROUPS.QUADS, MUSCLE_GROUPS.GLUTES],
    'leg press': [MUSCLE_GROUPS.QUADS, MUSCLE_GROUPS.GLUTES],
    'extension': [MUSCLE_GROUPS.QUADS],
    'calf': [MUSCLE_GROUPS.CALVES],
    // 'raise' is duplicated, let's just keep one broad one or specialized. 
    // 'raise' matches lateral raise (shoulders) and calf raise (calves).
    // Let's rely on 'calf' for calf raise and 'raise' for shoulders generally, or 'lateral'.
    // Actually, let's make 'raise' map to Shoulders primarily, as 'calf raise' will hit 'calf' first if we check all.
    // The current logic adds ALL matches. So 'calf raise' hits 'calf'->Calves and 'raise'->Shoulders.
    // That's acceptable for a heatmap approximation.
    // 'raise': [MUSCLE_GROUPS.CALVES], // REMOVED duplicate


    // Core
    'plank': [MUSCLE_GROUPS.ABS],
    'crunch': [MUSCLE_GROUPS.ABS],
    'sit up': [MUSCLE_GROUPS.ABS],
    'leg raise': [MUSCLE_GROUPS.ABS],

    // Cardio
    'run': [MUSCLE_GROUPS.QUADS, MUSCLE_GROUPS.CALVES, MUSCLE_GROUPS.CARDIO],
    'jog': [MUSCLE_GROUPS.QUADS, MUSCLE_GROUPS.CALVES, MUSCLE_GROUPS.CARDIO],
    'cycling': [MUSCLE_GROUPS.QUADS, MUSCLE_GROUPS.CARDIO],
    'bike': [MUSCLE_GROUPS.QUADS, MUSCLE_GROUPS.CARDIO],
    'swim': [MUSCLE_GROUPS.BACK, MUSCLE_GROUPS.SHOULDERS, MUSCLE_GROUPS.CARDIO],
};

export function getMusclesForExercise(exerciseName: string): MuscleGroup[] {
    const normalize = exerciseName.toLowerCase();
    const muscles = new Set<MuscleGroup>();

    // Check strict keywords
    for (const [key, groups] of Object.entries(EXERCISE_MAPPINGS)) {
        if (normalize.includes(key)) {
            groups.forEach(g => muscles.add(g));
        }
    }

    return Array.from(muscles);
}

// Keep track of muscle volume (set count or just raw frequency)
export function calculateMuscleVolume(workouts: any[]): Record<MuscleGroup, number> {
    const volume: Record<string, number> = {};

    workouts.forEach(workout => {
        // If structured exercises exist
        if (workout.exercises && Array.isArray(workout.exercises)) {
            workout.exercises.forEach((ex: any) => {
                const muscles = getMusclesForExercise(ex.exercise_name || ex.name || '');
                const setWeight = 1; // Or use actual set count if available: ex.sets?.length || 1

                muscles.forEach(m => {
                    volume[m] = (volume[m] || 0) + setWeight;
                });
            });
        }
        // Fallback to activity type if no exercises
        else if (workout.activity_type) {
            const muscles = getMusclesForExercise(workout.activity_type);
            muscles.forEach(m => {
                volume[m] = (volume[m] || 0) + 3; // Assume ~3 sets equivalent for a full session
            });
        }
    });

    return volume;
}
