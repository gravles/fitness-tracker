'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { Loader2, Plus, Check, Clock, Play, Pause, Trash2, History, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getTemplates, getWorkoutDetails, createWorkoutExercise, logSet, getLastSetsForExercise, WorkoutTemplate } from '@/lib/workout-api';
import { useTemplate as useTemplateAction, WorkoutTemplate as FeaturesTemplate } from '@/lib/features';
import { upsertDailyLog, addWorkout, deleteWorkout } from '@/lib/api';
import { WorkoutSpotter } from '@/components/WorkoutSpotter';
import { RestTimer } from '@/components/RestTimer';
import { ExercisePicker } from '@/components/ExercisePicker';
import { ExerciseHistoryModal } from '@/components/ExerciseHistoryModal';

const DRAFT_KEY = 'workout_active_draft';

interface ActiveSet {
    id?: string;
    weight: string;
    reps: string;
    completed: boolean;
}

interface ActiveExercise {
    id?: string;
    name: string;
    sets: ActiveSet[];
}

export default function ActiveWorkoutPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const templateId = searchParams.get('template');

    const [loading, setLoading] = useState(true);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [title, setTitle] = useState('New Workout');
    const [exercises, setExercises] = useState<ActiveExercise[]>([]);
    const [showExercisePicker, setShowExercisePicker] = useState(false);
    const [historyExercise, setHistoryExercise] = useState<string | null>(null);
    const [lastSets, setLastSets] = useState<Record<string, { date: string; sets: any[] } | null>>({});
    const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!isPaused) setElapsedSeconds(s => s + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [isPaused]);

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

    useEffect(() => {
        async function init() {
            setLoading(true);
            try {
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
                    } catch { /* ignore malformed draft */ }
                }

                if (templateId) {
                    try {
                        const template = await useTemplateAction(templateId);
                        if (template) {
                            setTitle(template.name);
                            setExercises(template.exercises?.map(e => ({
                                name: e.name,
                                sets: Array(e.sets).fill(0).map(() => ({
                                    weight: '', reps: e.reps, completed: false
                                }))
                            })) || []);
                        }
                    } catch {
                        const templates = await getTemplates();
                        const template = templates.find((t: WorkoutTemplate) => t.id === templateId);
                        if (template) {
                            setTitle(template.name);
                            setExercises(template.exercises?.map((e: any) => ({
                                name: e.name || e.exercise_name,
                                sets: Array(e.sets || e.target_sets || 3).fill(0).map(() => ({
                                    weight: '', reps: e.reps || e.target_reps || '10', completed: false
                                }))
                            })) || []);
                        }
                    }
                } else if (params.id && params.id !== 'new') {
                    const workout = await getWorkoutDetails(params.id as string);
                    if (workout) {
                        setTitle(workout.activity_type);
                        setElapsedSeconds(workout.duration * 60);
                        setIsPaused(true);
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
                console.error('Failed to load workout', e);
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
        setConfirmModal({
            message: 'Remove this exercise?',
            onConfirm: () => {
                const copy = [...exercises];
                copy.splice(index, 1);
                setExercises(copy);
                setConfirmModal(null);
            }
        });
    };

    const finishWorkout = async () => {
        const completedExercises = exercises.filter(e => e.sets.some(s => s.completed));
        if (completedExercises.length === 0) {
            toast.error('No exercises completed. Mark at least one set as done.');
            return;
        }
        const isUpdate = params.id && params.id !== 'new';
        const actionLabel = isUpdate ? 'Update' : 'Finish and log';
        setConfirmModal({
            message: `${actionLabel} this workout?`,
            onConfirm: async () => {
                setConfirmModal(null);
                await _doFinishWorkout(isUpdate as boolean, completedExercises);
            }
        });
    };

    const _doFinishWorkout = async (isUpdate: boolean, completedExercises: ActiveExercise[]) => {
        if (isPaused) setIsPaused(false);
        setLoading(true);

        try {
            const settings = await import('@/lib/api').then(m => m.getSettings());
            const weightLbs = settings?.target_weight || 160;
            const weightKg = weightLbs * 0.453592;
            const durationHrs = elapsedSeconds / 3600;
            const caloriesBurned = Math.round(5.0 * weightKg * durationHrs);

            const workoutData = {
                date: format(new Date(), 'yyyy-MM-dd'),
                activity_type: title,
                duration: Math.floor(elapsedSeconds / 60),
                intensity: 'Moderate' as const,
                calories: caloriesBurned,
                notes: `Calories Burned: ~${caloriesBurned} kcal\n\nDetailed Log:\n${completedExercises.map(e =>
                    `${e.name}: ${e.sets.filter(s => s.completed).map(s => `${s.weight}lbs x ${s.reps}`).join(' | ')}`
                ).join('\n')}`
            };

            let workoutId = params.id as string;

            if (isUpdate) {
                const { updateWorkout } = await import('@/lib/api');
                await updateWorkout(workoutId, workoutData);
                const { deleteWorkoutExercises } = await import('@/lib/workout-api');
                await deleteWorkoutExercises(workoutId);
            } else {
                const savedWorkout = await addWorkout(workoutData);
                if (savedWorkout) workoutId = savedWorkout.id!;
            }

            if (workoutId) {
                for (let i = 0; i < completedExercises.length; i++) {
                    const exData = completedExercises[i];
                    const savedEx = await createWorkoutExercise(workoutId, exData.name, i);
                    if (savedEx && savedEx.id) {
                        const validSets = exData.sets.filter(s => s.completed);
                        for (let j = 0; j < validSets.length; j++) {
                            const s = validSets[j];
                            await logSet(savedEx.id, j + 1, parseFloat(s.weight) || 0, parseFloat(s.reps) || 0, true);
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
                calories: (await import('@/lib/api').then(m => m.getDailyLog(workoutData.date)))?.calories
            });

            localStorage.removeItem(DRAFT_KEY);
            router.push('/');
        } catch (e) {
            console.error(e);
            toast.error('Error saving workout');
            setLoading(false);
        }
    };

    const handleDeleteWorkout = () => {
        setConfirmModal({
            message: 'Delete this workout? This cannot be undone.',
            onConfirm: async () => {
                setConfirmModal(null);
                setLoading(true);
                try {
                    await deleteWorkout(params.id as string);
                    localStorage.removeItem(DRAFT_KEY);
                    router.push('/');
                } catch (e) {
                    console.error(e);
                    toast.error('Error deleting workout');
                    setLoading(false);
                }
            }
        });
    };

    const handleSetDetected = (data: { exercise?: string, reps: number, weight: number, weight_unit: string }) => {
        setExercises(prev => {
            const copy = [...prev];
            let targetExIndex = data.exercise
                ? copy.findIndex(e => e.name.toLowerCase().includes(data.exercise!.toLowerCase()))
                : -1;
            if (targetExIndex === -1) targetExIndex = copy.findIndex(e => e.sets.some(s => !s.completed));
            if (targetExIndex === -1 && copy.length > 0) targetExIndex = copy.length - 1;
            if (targetExIndex === -1) return prev;

            const ex = copy[targetExIndex];
            let setIndex = ex.sets.findIndex(s => !s.completed);
            if (setIndex === -1) {
                ex.sets.push({ weight: '', reps: '', completed: false });
                setIndex = ex.sets.length - 1;
            }
            copy[targetExIndex].sets[setIndex] = {
                ...copy[targetExIndex].sets[setIndex],
                weight: data.weight.toString(),
                reps: data.reps.toString(),
                completed: true
            };
            return copy;
        });
    };

    if (loading) return (
        <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin w-8 h-8" style={{ color: 'var(--color-primary)' }} />
        </div>
    );

    return (
        <main className="h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
            {/* Header */}
            <div
                className="p-4 border-b flex justify-between items-center sticky top-0 z-10 shadow-sm"
                style={{
                    background: 'var(--color-surface-elevated)',
                    borderColor: 'var(--color-border)',
                }}
            >
                <div className="flex-1">
                    <input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="font-bold text-xl bg-transparent outline-none w-full"
                        style={{ color: 'var(--color-text)' }}
                    />
                    <div
                        className="flex items-center gap-2 font-mono text-sm transition-colors"
                        style={{ color: isPaused ? '#f97316' : 'var(--color-primary)' }}
                    >
                        <Clock className="w-3 h-3" />
                        {formatTime(elapsedSeconds)}
                        {isPaused && (
                            <span
                                className="text-xs font-bold uppercase border px-1 rounded"
                                style={{ borderColor: '#fed7aa', background: '#fff7ed', color: '#f97316' }}
                            >
                                Paused
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className="p-2 rounded-full transition-colors"
                        style={
                            isPaused
                                ? { background: '#fff7ed', color: '#f97316' }
                                : { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }
                        }
                    >
                        {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
                    </button>
                    <RestTimer />
                    <WorkoutSpotter onSetDetected={handleSetDetected} />
                    {params.id && params.id !== 'new' && (
                        <button
                            onClick={handleDeleteWorkout}
                            className="p-2 rounded-full transition-colors"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}
                            title="Delete Workout"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={finishWorkout}
                        className="px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all active:scale-[0.98]"
                        style={{ background: 'var(--color-primary)', color: 'white' }}
                    >
                        Finish
                    </button>
                </div>
            </div>

            {/* Exercise List */}
            <div
                className={`flex-1 overflow-y-auto p-4 space-y-6 pb-32 transition-opacity ${isPaused ? 'opacity-50 grayscale-[50%]' : ''}`}
            >
                {exercises.map((ex, i) => {
                    const prev = lastSets[ex.name];
                    return (
                        <div key={i}>
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>{ex.name}</h3>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setHistoryExercise(ex.name)}
                                        className="p-2 rounded-full transition-colors"
                                        style={{ color: 'var(--color-text-muted)' }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = 'rgba(29,95,168,0.1)';
                                            e.currentTarget.style.color = 'var(--color-primary)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = '';
                                            e.currentTarget.style.color = 'var(--color-text-muted)';
                                        }}
                                        title="Exercise History"
                                    >
                                        <History className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteExercise(i)}
                                        className="p-2 rounded-full transition-colors"
                                        style={{ color: 'var(--color-text-muted)' }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                                            e.currentTarget.style.color = '#ef4444';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = '';
                                            e.currentTarget.style.color = 'var(--color-text-muted)';
                                        }}
                                        title="Delete Exercise"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {prev && prev.sets.length > 0 && (
                                <div
                                    className="mb-2 px-2 py-1.5 rounded-lg"
                                    style={{ background: 'rgba(29,95,168,0.08)' }}
                                >
                                    <p
                                        className="text-[10px] font-bold uppercase tracking-wide mb-0.5"
                                        style={{ color: 'var(--color-primary)' }}
                                    >
                                        Last session
                                    </p>
                                    <p className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                                        {prev.sets.map((s: any) => `${s.weight}×${s.reps}`).join(' | ')}
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <div
                                    className="grid grid-cols-10 gap-2 text-xs font-bold uppercase tracking-wider text-center mb-1 px-1"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    <div className="col-span-1">Set</div>
                                    <div className="col-span-3">Lbs</div>
                                    <div className="col-span-3">Reps</div>
                                    <div className="col-span-3">Done</div>
                                </div>

                                {ex.sets.map((set, si) => {
                                    const prevSet = prev?.sets[si];
                                    return (
                                        <div
                                            key={si}
                                            className="grid grid-cols-10 gap-2 items-center p-1 rounded-lg transition-colors"
                                            style={{
                                                background: set.completed
                                                    ? 'rgba(29,95,168,0.08)'
                                                    : 'var(--color-bg-subtle)',
                                            }}
                                        >
                                            <div
                                                className="col-span-1 text-center font-bold"
                                                style={{ color: 'var(--color-text-muted)' }}
                                            >
                                                {si + 1}
                                            </div>
                                            <div className="col-span-3">
                                                <input
                                                    type="tel"
                                                    placeholder={prevSet ? String(prevSet.weight) : '0'}
                                                    value={set.weight}
                                                    onChange={e => updateSet(i, si, 'weight', e.target.value)}
                                                    className="w-full text-center p-2 rounded-md outline-none"
                                                    style={{
                                                        background: 'var(--color-surface-elevated)',
                                                        border: '1px solid var(--color-border)',
                                                        color: 'var(--color-text)',
                                                    }}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input
                                                    type="tel"
                                                    placeholder={prevSet ? String(prevSet.reps) : '0'}
                                                    value={set.reps}
                                                    onChange={e => updateSet(i, si, 'reps', e.target.value)}
                                                    className="w-full text-center p-2 rounded-md outline-none"
                                                    style={{
                                                        background: 'var(--color-surface-elevated)',
                                                        border: '1px solid var(--color-border)',
                                                        color: 'var(--color-text)',
                                                    }}
                                                />
                                            </div>
                                            <div className="col-span-3 flex justify-center">
                                                <button
                                                    onClick={() => toggleSet(i, si)}
                                                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                                                    style={
                                                        set.completed
                                                            ? {
                                                                background: 'var(--color-primary)',
                                                                color: 'white',
                                                                boxShadow: '0 4px 12px rgba(29,95,168,0.35)',
                                                            }
                                                            : {
                                                                background: 'var(--color-bg-subtle)',
                                                                color: 'var(--color-text-muted)',
                                                            }
                                                    }
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
                                    className="w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all"
                                    style={{
                                        background: 'var(--color-bg-subtle)',
                                        color: 'var(--color-text-muted)',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'var(--color-gold-muted)';
                                        e.currentTarget.style.color = 'var(--color-gold)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'var(--color-bg-subtle)';
                                        e.currentTarget.style.color = 'var(--color-text-muted)';
                                    }}
                                >
                                    <Plus className="w-3 h-3" /> Add Set
                                </button>
                            </div>
                        </div>
                    );
                })}

                <button
                    onClick={() => setShowExercisePicker(true)}
                    className="w-full py-4 border-2 border-dashed rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                    style={{
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-muted)',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--color-primary)';
                        e.currentTarget.style.color = 'var(--color-primary)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.color = 'var(--color-text-muted)';
                    }}
                >
                    <Plus className="w-5 h-5" /> Add Exercise
                </button>
            </div>

            {showExercisePicker && (
                <ExercisePicker
                    onSelect={name => {
                        setExercises([...exercises, { name, sets: [{ weight: '', reps: '', completed: false }] }]);
                    }}
                    onClose={() => setShowExercisePicker(false)}
                />
            )}

            {historyExercise && (
                <ExerciseHistoryModal
                    exerciseName={historyExercise}
                    onClose={() => setHistoryExercise(null)}
                />
            )}

            {/* Inline confirm modal */}
            {confirmModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center px-6"
                    style={{ background: 'rgba(0,0,0,0.5)' }}
                    onClick={() => setConfirmModal(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-xl"
                        style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-light)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <p className="font-semibold text-center" style={{ color: 'var(--color-text)' }}>
                            {confirmModal.message}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                                style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                                style={{ background: 'var(--color-primary)', color: 'white' }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
