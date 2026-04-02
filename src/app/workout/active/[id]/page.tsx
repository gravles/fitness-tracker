'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { Loader2, Plus, Check, Clock, Save, MoreVertical, X, Play, Pause, Trash2, History } from 'lucide-react';
import { format } from 'date-fns';
import { getTemplates, getWorkoutDetails, createWorkoutExercise, logSet, getLastSetsForExercise, WorkoutTemplate } from '@/lib/workout-api';
import { useTemplate as useTemplateAction, WorkoutTemplate as FeaturesTemplate } from '@/lib/features';
import { upsertDailyLog, addWorkout, deleteWorkout } from '@/lib/api';
import { WorkoutSpotter } from '@/components/WorkoutSpotter';
import { RestTimer } from '@/components/RestTimer';
import { ExercisePicker } from '@/components/ExercisePicker';
import { ExerciseHistoryModal } from '@/components/ExerciseHistoryModal';

const DRAFT_KEY = 'workout_active_draft';

// Types for local state
interface ActiveSet {
    id?: string; // DB ID if saved
    weight: string;
    reps: string;
    completed: boolean;
}

interface ActiveExercise {
    id?: string; // DB ID if saved
    name: string;
    sets: ActiveSet[];
}

export default function ActiveWorkoutPage() {
    const router = useRouter();
    const params = useParams(); // [id] might be 'new' or an existing workout ID if resuming
    const searchParams = useSearchParams();
    const templateId = searchParams.get('template');

    const [loading, setLoading] = useState(true);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [title, setTitle] = useState('New Workout');
    const [exercises, setExercises] = useState<ActiveExercise[]>([]);
    const [showExercisePicker, setShowExercisePicker] = useState(false);
    const [historyExercise, setHistoryExercise] = useState<string | null>(null);
    // Map of exercise name → { date, sets } from last session
    const [lastSets, setLastSets] = useState<Record<string, { date: string; sets: any[] } | null>>({});

    // Timer
    useEffect(() => {
        const interval = setInterval(() => {
            if (!isPaused) {
                setElapsedSeconds(s => s + 1);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [isPaused]);

    // Fetch previous sets for any exercise not yet in lastSets
    useEffect(() => {
        if (loading) return;
        for (const ex of exercises) {
            if (ex.name && !(ex.name in lastSets)) {
                getLastSetsForExercise(ex.name)
                    .then(data => setLastSets(prev => ({ ...prev, [ex.name]: data })))
                    .catch(() => setLastSets(prev => ({ ...prev, [ex.name]: null })));
            }
        }
    }, [exercises, loading]);

    // Auto-save draft to localStorage whenever workout state changes
    useEffect(() => {
        if (loading) return;
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            workoutId: params.id,
            title,
            exercises,
            elapsedSeconds,
            savedAt: Date.now()
        }));
    }, [exercises, title, elapsedSeconds, loading]);

    // Initial Load
    useEffect(() => {
        async function init() {
            setLoading(true);
            try {
                // Restore draft if available and no fresh template is being loaded
                if (!templateId) {
                    try {
                        const raw = localStorage.getItem(DRAFT_KEY);
                        if (raw) {
                            const draft = JSON.parse(raw);
                            const isRecent = Date.now() - draft.savedAt < 24 * 60 * 60 * 1000;
                            if (isRecent && draft.workoutId === params.id) {
                                setTitle(draft.title);
                                setExercises(draft.exercises);
                                setElapsedSeconds(draft.elapsedSeconds);
                                setLoading(false);
                                return;
                            }
                        }
                    } catch {
                        // ignore malformed draft
                    }
                }

                if (templateId) {
                    // Load from public/user template via features lib
                    try {
                        const template = await useTemplateAction(templateId);
                        if (template) {
                            setTitle(template.name);
                            // Features templates have exercises as: { name, sets, reps }
                            setExercises(template.exercises?.map(e => ({
                                name: e.name,
                                sets: Array(e.sets).fill(0).map(() => ({
                                    weight: '',
                                    reps: e.reps,
                                    completed: false
                                }))
                            })) || []);
                        }
                    } catch {
                        // Fallback: try user's workout-api templates
                        const templates = await getTemplates();
                        const template = templates.find((t: WorkoutTemplate) => t.id === templateId);
                        if (template) {
                            setTitle(template.name);
                            setExercises(template.exercises?.map((e: any) => ({
                                name: e.name || e.exercise_name,
                                sets: Array(e.sets || e.target_sets || 3).fill(0).map(() => ({
                                    weight: '',
                                    reps: e.reps || e.target_reps || '10',
                                    completed: false
                                }))
                            })) || []);
                        }
                    }
                } else if (params.id && params.id !== 'new') {
                    // Load existing workout for EDITING
                    const workout = await getWorkoutDetails(params.id as string);
                    if (workout) {
                        setTitle(workout.activity_type);
                        setElapsedSeconds(workout.duration * 60);
                        setIsPaused(true); // Default to paused when re-opening

                        if (workout.exercises) {
                            setExercises(workout.exercises.map((e: any) => ({
                                id: e.id,
                                name: e.exercise_name,
                                sets: e.sets?.map((s: any) => ({
                                    id: s.id,
                                    weight: s.weight?.toString() || '',
                                    reps: s.reps?.toString() || '',
                                    completed: s.completed
                                })) || []
                            })));
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load workout", e);
            } finally {
                setLoading(false);
            }
        }
        init();
    }, [templateId, params.id]);

    const formatTime = (secs: number) => {
        const mins = Math.floor(secs / 60);
        const s = secs % 60;
        return `${mins}:${s.toString().padStart(2, '0')}`;
    };

    const toggleSet = (exIndex: number, setIndex: number) => {
        const copy = [...exercises];
        copy[exIndex].sets[setIndex].completed = !copy[exIndex].sets[setIndex].completed;
        setExercises(copy);
    };

    const updateSet = (exIndex: number, setIndex: number, field: 'weight' | 'reps', val: string) => {
        const copy = [...exercises];
        copy[exIndex].sets[setIndex] = { ...copy[exIndex].sets[setIndex], [field]: val };
        setExercises(copy);
    };

    const deleteExercise = (index: number) => {
        if (confirm('Delete this exercise?')) {
            const copy = [...exercises];
            copy.splice(index, 1);
            setExercises(copy);
        }
    };

    const finishWorkout = async () => {
        // 1. Filter: Only keep exercises with at least one completed set
        const completedExercises = exercises.filter(e => e.sets.some(s => s.completed));

        if (completedExercises.length === 0) {
            alert('No exercises completed! Please mark at least one set as done.');
            return;
        }

        if (isPaused) setIsPaused(false); // Resume for a second just in case logic depends on it, but mostly just semantic

        const isUpdate = params.id && params.id !== 'new';
        const actionLabel = isUpdate ? 'Update' : 'Finish and log';

        if (!confirm(`${actionLabel} this workout?`)) return;
        setLoading(true);

        try {
            // 2. Calorie Estimation
            // METs: Moderate Weight Lifting ~ 5.0
            // Formula: Calories = MET * Weight(kg) * Duration(hr)
            const settings = await import('@/lib/api').then(m => m.getSettings());
            const weightLbs = settings?.target_weight || 160; // Default to 160 if unknown
            const weightKg = weightLbs * 0.453592;
            const durationHrs = elapsedSeconds / 3600;
            const met = 5.0; // Moderate intensity
            const caloriesBurned = Math.round(met * weightKg * durationHrs);

            // 3. Construct Log - Structured Data
            const summary = completedExercises.map(e => `${e.sets.filter(s => s.completed).length} x ${e.name}`).join(', ');

            // ... inside the component ...

            const workoutData = {
                date: format(new Date(), 'yyyy-MM-dd'),
                activity_type: title,
                duration: Math.floor(elapsedSeconds / 60),
                intensity: 'Moderate' as const,
                calories: caloriesBurned,
                // KEEPING LEGACY NOTES for backward compatibility & easy reading
                notes: `Calories Burned: ~${caloriesBurned} kcal\n\nDetailed Log:\n${completedExercises.map(e =>
                    `${e.name}: ${e.sets.filter(s => s.completed).map(s => `${s.weight}lbs x ${s.reps}`).join(' | ')}`
                ).join('\n')}`
            };

            let workoutId = params.id as string;

            if (isUpdate) {
                // Update Header
                const { updateWorkout } = await import('@/lib/api');
                await updateWorkout(workoutId, workoutData);

                // DELETE OLD STRUCTURE
                const { deleteWorkoutExercises } = await import('@/lib/workout-api');
                await deleteWorkoutExercises(workoutId);
            } else {
                // Create New
                const savedWorkout = await addWorkout(workoutData);
                if (savedWorkout) workoutId = savedWorkout.id!;
            }

            if (workoutId) {
                // B. Save Structured Exercises & Sets
                for (let i = 0; i < completedExercises.length; i++) {
                    const exData = completedExercises[i];
                    // Create Exercise
                    const savedEx = await createWorkoutExercise(workoutId, exData.name, i);

                    if (savedEx && savedEx.id) {
                        // Create Sets
                        const validSets = exData.sets.filter(s => s.completed);
                        for (let j = 0; j < validSets.length; j++) {
                            const s = validSets[j];
                            await logSet(
                                savedEx.id,
                                j + 1, // set number (1-based)
                                parseFloat(s.weight) || 0,
                                parseFloat(s.reps) || 0,
                                true
                            );
                        }
                    }
                }
            }

            await upsertDailyLog({
                date: workoutData.date,
                movement_completed: true,
                movement_duration: workoutData.duration,
                movement_type: workoutData.activity_type,
                movement_intensity: workoutData.intensity,
                movement_notes: workoutData.notes,
                calories: (await import('@/lib/api').then(m => m.getDailyLog(workoutData.date)))?.calories // Preserve existing calories if possible, but nutrition log generally handles this
            });

            localStorage.removeItem(DRAFT_KEY);
            router.push('/');

        } catch (e) {
            console.error(e);
            alert('Error saving workout');
            setLoading(false);
        }
    };

    const handleDeleteWorkout = async () => {
        if (!confirm('Delete this workout? This cannot be undone.')) return;
        setLoading(true);
        try {
            await deleteWorkout(params.id as string);
            localStorage.removeItem(DRAFT_KEY);
            router.push('/');
        } catch (e) {
            console.error(e);
            alert('Error deleting workout');
            setLoading(false);
        }
    };

    const handleSetDetected = (data: { exercise?: string, reps: number, weight: number, weight_unit: string }) => {
        setExercises(prev => {
            const copy = [...prev];
            let targetExIndex = -1;

            // 1. Try to match by name
            if (data.exercise) {
                targetExIndex = copy.findIndex(e => e.name.toLowerCase().includes(data.exercise!.toLowerCase()));
            }

            // 2. If no name or no match, find first exercise with incomplete sets
            if (targetExIndex === -1) {
                targetExIndex = copy.findIndex(e => e.sets.some(s => !s.completed));
            }

            // 3. Fallback to last exercise if everything is done (to add a set)
            if (targetExIndex === -1 && copy.length > 0) {
                targetExIndex = copy.length - 1;
            }

            if (targetExIndex === -1) return prev; // No exercises

            // Find first incomplete set
            const ex = copy[targetExIndex];
            let setIndex = ex.sets.findIndex(s => !s.completed);

            if (setIndex === -1) {
                // All sets done, add a new one
                ex.sets.push({ weight: '', reps: '', completed: false });
                setIndex = ex.sets.length - 1;
            }

            // Update the set
            copy[targetExIndex].sets[setIndex] = {
                ...copy[targetExIndex].sets[setIndex],
                weight: data.weight.toString(),
                reps: data.reps.toString(),
                completed: true
            };

            return copy;
        });
    };

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <main className="h-screen flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
                <div className="flex-1">
                    <input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="font-bold text-xl text-gray-900 bg-transparent outline-none w-full"
                    />
                    <div className={`flex items-center gap-2 font-mono text-sm transition-colors ${isPaused ? 'text-orange-500 animate-pulse' : 'text-blue-600'}`}>
                        <Clock className="w-3 h-3" />
                        {formatTime(elapsedSeconds)}
                        {isPaused && <span className="text-xs font-bold uppercase border border-orange-200 bg-orange-50 px-1 rounded">Paused</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={`p-2 rounded-full transition-colors ${isPaused ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}
                    >
                        {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
                    </button>
                    <RestTimer />
                    <WorkoutSpotter onSetDetected={handleSetDetected} />
                    {params.id && params.id !== 'new' && (
                        <button
                            onClick={handleDeleteWorkout}
                            className="p-2 rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                            title="Delete Workout"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={finishWorkout} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-green-700">
                        Finish
                    </button>
                </div>
            </div>

            {/* List */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-6 pb-32 transition-opacity ${isPaused ? 'opacity-50 grayscale-[50%]' : ''}`}>
                {exercises.map((ex, i) => {
                    const prev = lastSets[ex.name];
                    return (
                        <div key={i}>
                            {/* Exercise header */}
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="font-bold text-lg">{ex.name}</h3>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setHistoryExercise(ex.name)}
                                        className="text-gray-400 p-2 hover:bg-blue-50 hover:text-blue-500 rounded-full transition-colors"
                                        title="Exercise History"
                                    >
                                        <History className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteExercise(i)}
                                        className="text-gray-400 p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
                                        title="Delete Exercise"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Previous session summary */}
                            {prev && prev.sets.length > 0 && (
                                <div className="mb-2 px-2 py-1.5 bg-blue-50 rounded-lg">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-0.5">Last session</p>
                                    <p className="text-xs text-blue-700 font-medium">
                                        {prev.sets.map((s: any) => `${s.weight}×${s.reps}`).join(' | ')}
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="grid grid-cols-10 gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-1 px-1">
                                    <div className="col-span-1">Set</div>
                                    <div className="col-span-3">Lbs</div>
                                    <div className="col-span-3">Reps</div>
                                    <div className="col-span-3">Done</div>
                                </div>

                                {ex.sets.map((set, si) => {
                                    const prevSet = prev?.sets[si];
                                    return (
                                        <div key={si} className={`grid grid-cols-10 gap-2 items-center p-1 rounded-lg transition-colors ${set.completed ? 'bg-green-50' : 'bg-gray-50'}`}>
                                            <div className="col-span-1 text-center font-bold text-gray-500">{si + 1}</div>
                                            <div className="col-span-3">
                                                <input
                                                    type="tel"
                                                    placeholder={prevSet ? String(prevSet.weight) : '0'}
                                                    value={set.weight}
                                                    onChange={e => updateSet(i, si, 'weight', e.target.value)}
                                                    className="w-full text-center p-2 rounded-md border border-gray-200 bg-white"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input
                                                    type="tel"
                                                    placeholder={prevSet ? String(prevSet.reps) : '0'}
                                                    value={set.reps}
                                                    onChange={e => updateSet(i, si, 'reps', e.target.value)}
                                                    className="w-full text-center p-2 rounded-md border border-gray-200 bg-white"
                                                />
                                            </div>
                                            <div className="col-span-3 flex justify-center">
                                                <button
                                                    onClick={() => toggleSet(i, si)}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${set.completed ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-gray-200 text-gray-400'
                                                        }`}
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <button
                                    onClick={() => {
                                        const copy = [...exercises];
                                        const lastSet = copy[i].sets[copy[i].sets.length - 1];
                                        copy[i].sets.push({ weight: lastSet?.weight || '', reps: lastSet?.reps || '', completed: false });
                                        setExercises(copy);
                                    }}
                                    className="w-full py-2 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-200 flex items-center justify-center gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Add Set
                                </button>
                            </div>
                        </div>
                    );
                })}

                <button
                    onClick={() => setShowExercisePicker(true)}
                    className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Add Exercise
                </button>
            </div>

            {/* Exercise picker modal */}
            {showExercisePicker && (
                <ExercisePicker
                    onSelect={name => {
                        setExercises([...exercises, { name, sets: [{ weight: '', reps: '', completed: false }] }]);
                    }}
                    onClose={() => setShowExercisePicker(false)}
                />
            )}

            {/* Exercise history modal */}
            {historyExercise && (
                <ExerciseHistoryModal
                    exerciseName={historyExercise}
                    onClose={() => setHistoryExercise(null)}
                />
            )}
        </main>
    );
}
