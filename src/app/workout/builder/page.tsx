'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Dumbbell, ChevronRight, Loader2 } from 'lucide-react';
import { getTemplates, createTemplate, WorkoutTemplate } from '@/lib/workout-api';

export default function WorkoutBuilderPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewModal, setShowNewModal] = useState(false);

    // New Template State
    const [newTitle, setNewTitle] = useState('');
    const [newExercises, setNewExercises] = useState<{ name: string, sets: number, reps: string }[]>([]);
    const [exerciseInput, setExerciseInput] = useState('');

    useEffect(() => {
        loadTemplates();
    }, []);

    const [error, setError] = useState<string | null>(null);

    async function loadTemplates() {
        try {
            setError(null);
            const data = await getTemplates();
            setTemplates(data || []);
        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Failed to load templates');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        if (!newTitle.trim()) return;

        try {
            await createTemplate(newTitle, newExercises.map(e => ({
                exercise_name: e.name,
                target_sets: e.sets,
                target_reps: e.reps,
                order_index: 0
            })));

            setShowNewModal(false);
            setNewTitle('');
            setNewExercises([]);
            loadTemplates();
        } catch (e) {
            alert('Failed to create template');
        }
    }

    const addExerciseToNew = () => {
        if (!exerciseInput.trim()) return;
        setNewExercises([...newExercises, { name: exerciseInput, sets: 3, reps: '10' }]);
        setExerciseInput('');
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <main className="p-6 pb-24 space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Workouts</h1>
                    <p className="text-gray-500 text-sm">Manage your templates</p>
                </div>
                <button
                    onClick={() => setShowNewModal(true)}
                    className="bg-black text-white p-3 rounded-xl shadow-lg hover:scale-105 transition-transform"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>

            <div className="grid gap-4">
                {templates.map(t => (
                    <div
                        key={t.id}
                        onClick={() => router.push(`/workout/active/new?template=${t.id}`)}
                        className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    >
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-lg group-hover:text-blue-600 transition-colors">{t.name}</h3>
                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500" />
                        </div>

                        <div className="space-y-1">
                            {t.exercises?.slice(0, 3).map((e, i) => (
                                <div key={i} className="text-sm text-gray-500 flex justify-between">
                                    <span>{e.exercise_name}</span>
                                    <span className="text-gray-400 text-xs">{e.target_sets} x {e.target_reps}</span>
                                </div>
                            ))}
                            {(t.exercises?.length || 0) > 3 && (
                                <p className="text-xs text-blue-500 font-medium pt-1">
                                    + {(t.exercises?.length || 0) - 3} more exercises
                                </p>
                            )}
                        </div>
                    </div>
                ))}

                {templates.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <Dumbbell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No templates yet</p>
                        <button onClick={() => setShowNewModal(true)} className="text-blue-600 text-sm font-bold mt-2">Create one</button>
                    </div>
                )}
            </div>

            {/* Quick Start Empty Workout */}
            <button
                onClick={() => router.push('/workout/active/new')}
                className="w-full py-4 bg-blue-50 text-blue-700 font-bold rounded-xl border border-blue-100 flex items-center justify-center gap-2"
            >
                Start Empty Workout
            </button>


            {/* Create Modal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom">
                        <h2 className="text-xl font-bold mb-4">New Template</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Workout Name</label>
                                <input
                                    className="w-full p-3 bg-gray-50 rounded-xl"
                                    placeholder="e.g. Push Day"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Add Exercises</label>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 p-3 bg-gray-50 rounded-xl"
                                        placeholder="Exercise name..."
                                        value={exerciseInput}
                                        onChange={e => setExerciseInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addExerciseToNew()}
                                    />
                                    <button onClick={addExerciseToNew} className="bg-gray-900 text-white px-4 rounded-xl">
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {newExercises.map((ex, i) => (
                                    <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                                        <div>
                                            <p className="font-bold text-sm">{ex.name}</p>
                                            <div className="flex gap-2 text-xs text-gray-500 mt-1">
                                                <label>Sets: <input className="w-8 bg-white border rounded px-1" value={ex.sets} onChange={e => {
                                                    const copy = [...newExercises];
                                                    copy[i].sets = parseInt(e.target.value) || 0;
                                                    setNewExercises(copy);
                                                }} /></label>
                                                <label>Reps: <input className="w-12 bg-white border rounded px-1" value={ex.reps} onChange={e => {
                                                    const copy = [...newExercises];
                                                    copy[i].reps = e.target.value;
                                                    setNewExercises(copy);
                                                }} /></label>
                                            </div>
                                        </div>
                                        <button onClick={() => setNewExercises(newExercises.filter((_, idx) => idx !== i))} className="text-red-400">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3 pt-4 border-t">
                                <button onClick={() => setShowNewModal(false)} className="flex-1 py-3 text-gray-500 font-bold">Cancel</button>
                                <button onClick={handleCreate} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg">Create</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
