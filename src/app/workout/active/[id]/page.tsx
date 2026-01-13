'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { Loader2, Plus, Check, Clock, Save, MoreVertical, X } from 'lucide-react';
import { getTemplates, getWorkoutDetails, createWorkoutExercise, logSet, WorkoutTemplate } from '@/lib/workout-api';
import { upsertDailyLog, addWorkout } from '@/lib/api';

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
    const [title, setTitle] = useState('New Workout');
    const [exercises, setExercises] = useState<ActiveExercise[]>([]);

    // Timer
    useEffect(() => {
        const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    // Initial Load
    useEffect(() => {
        async function init() {
            if (templateId) {
                // Load from template
                const templates = await getTemplates();
                const template = templates.find((t: WorkoutTemplate) => t.id === templateId);
                if (template) {
                    setTitle(template.name);
                    setExercises(template.exercises?.map(e => ({
                        name: e.exercise_name,
                        sets: Array(e.target_sets).fill(0).map(() => ({ weight: '', reps: e.target_reps, completed: false }))
                    })) || []);
                }
            }
            setLoading(false);
        }
        init();
    }, [templateId]);

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

    const finishWorkout = async () => {
        if (!confirm('Finish and log this workout?')) return;
        setLoading(true);

        try {
            // 1. Create Workout Entry (Using existing API for now to log to `workouts` table)
            // Note: In the future we should use the new `active_workouts` table if we want pause/resume, 
            // but for now we follow the "Finish" = "Log" pattern.
            // We'll log to the old `workouts` table for summary, and maybe eventually the new detailed tables.
            // For MVP: Log to `workouts` table so it shows up in history.

            const summary = exercises.map(e => `${e.sets.filter(s => s.completed).length} x ${e.name}`).join(', ');

            // Format for `workouts` table
            const workoutData = {
                date: new Date().toISOString().split('T')[0],
                activity_type: title,
                duration: Math.floor(elapsedSeconds / 60),
                intensity: 'Moderate' as const, // User can edit later
                notes: `Detailed Log:\n${exercises.map(e =>
                    `${e.name}: ${e.sets.map(s => `${s.weight}lbs x ${s.reps}`).join(' | ')}`
                ).join('\n')}`
            };

            await addWorkout(workoutData);

            // Also update Daily Log movement status
            await upsertDailyLog({
                date: workoutData.date,
                movement_completed: true,
                movement_duration: workoutData.duration // This might overwrite sum, but simple for now
            });

            router.push('/');

        } catch (e) {
            console.error(e);
            alert('Error saving workout');
            setLoading(false);
        }
    };

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <main className="h-screen flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <div>
                    <input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="font-bold text-xl text-gray-900 bg-transparent outline-none w-full"
                    />
                    <div className="flex items-center gap-1 text-blue-600 font-mono text-sm">
                        <Clock className="w-3 h-3" />
                        {formatTime(elapsedSeconds)}
                    </div>
                </div>
                <button onClick={finishWorkout} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-green-700">
                    Finish
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                {exercises.map((ex, i) => (
                    <div key={i}>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-lg">{ex.name}</h3>
                            <button className="text-gray-400 p-1"><MoreVertical className="w-4 h-4" /></button>
                        </div>

                        <div className="space-y-2">
                            <div className="grid grid-cols-10 gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-1 px-1">
                                <div className="col-span-1">Set</div>
                                <div className="col-span-3">Lbs</div>
                                <div className="col-span-3">Reps</div>
                                <div className="col-span-3">Done</div>
                            </div>

                            {ex.sets.map((set, si) => (
                                <div key={si} className={`grid grid-cols-10 gap-2 items-center p-1 rounded-lg transition-colors ${set.completed ? 'bg-green-50' : 'bg-gray-50'}`}>
                                    <div className="col-span-1 text-center font-bold text-gray-500">{si + 1}</div>
                                    <div className="col-span-3">
                                        <input
                                            type="tel"
                                            placeholder="0"
                                            value={set.weight}
                                            onChange={e => updateSet(i, si, 'weight', e.target.value)}
                                            className="w-full text-center p-2 rounded-md border border-gray-200 bg-white"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <input
                                            type="tel"
                                            placeholder="0"
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
                            ))}
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
                ))}

                <button
                    onClick={() => {
                        const name = prompt('Exercise Name:');
                        if (name) setExercises([...exercises, { name, sets: [{ weight: '', reps: '', completed: false }] }]);
                    }}
                    className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Add Exercise
                </button>
            </div>
        </main>
    );
}
