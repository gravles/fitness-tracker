'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Dumbbell, ChevronRight, Loader2, Edit2, MoreVertical } from 'lucide-react';
import { getTemplates, createTemplate, deleteTemplate, updateTemplate, WorkoutTemplate } from '@/lib/workout-api';
import { haptics } from '@/lib/haptics';

type WorkoutCategory = 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'custom';

const CATEGORIES: { value: WorkoutCategory; label: string; icon: string }[] = [
    { value: 'strength', label: 'Strength', icon: '💪' },
    { value: 'cardio', label: 'Cardio', icon: '🏃' },
    { value: 'hiit', label: 'HIIT', icon: '🔥' },
    { value: 'flexibility', label: 'Flexibility', icon: '🧘' },
    { value: 'custom', label: 'Custom', icon: '⚡' },
];

interface ExerciseItem {
    name: string;
    sets: number;
    reps: string;
}

export default function WorkoutBuilderPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);

    // Form State
    const [formTitle, setFormTitle] = useState('');
    const [formCategory, setFormCategory] = useState<WorkoutCategory>('custom');
    const [formExercises, setFormExercises] = useState<ExerciseItem[]>([]);
    const [exerciseInput, setExerciseInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

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

    function openCreateModal() {
        setEditingTemplate(null);
        setFormTitle('');
        setFormCategory('custom');
        setFormExercises([]);
        setShowModal(true);
    }

    function openEditModal(template: WorkoutTemplate) {
        setEditingTemplate(template);
        setFormTitle(template.name);
        setFormCategory((template as any).category || 'custom');
        // Handle both old schema (exercise_name) and new schema (name)
        const exercises = (template.exercises || []).map((e: any) => ({
            name: e.name || e.exercise_name || '',
            sets: e.sets || e.target_sets || 3,
            reps: e.reps || e.target_reps || '10'
        }));
        setFormExercises(exercises);
        setShowModal(true);
        setMenuOpen(null);
    }

    async function handleSave() {
        if (!formTitle.trim()) return;
        haptics.tap();

        try {
            const exercisesData = formExercises.map(e => ({
                exercise_name: e.name,
                target_sets: e.sets,
                target_reps: e.reps,
                order_index: 0
            }));

            if (editingTemplate) {
                // Update existing
                await updateTemplate(editingTemplate.id, {
                    name: formTitle,
                    exercises: formExercises,
                    category: formCategory
                });
            } else {
                // Create new
                await createTemplate(formTitle, exercisesData);
            }

            setShowModal(false);
            setEditingTemplate(null);
            loadTemplates();
            haptics.success();
        } catch (e) {
            alert('Failed to save template');
            haptics.error();
        }
    }

    async function handleDelete(templateId: string) {
        if (!confirm('Delete this template? This cannot be undone.')) return;
        haptics.tap();

        try {
            await deleteTemplate(templateId);
            loadTemplates();
            setMenuOpen(null);
            haptics.success();
        } catch (e) {
            alert('Failed to delete template');
        }
    }

    const addExercise = () => {
        if (!exerciseInput.trim()) return;
        setFormExercises([...formExercises, { name: exerciseInput, sets: 3, reps: '10' }]);
        setExerciseInput('');
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <main className="p-6 pb-24 space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">My Templates</h1>
                    <p className="text-gray-500 text-sm">
                        Create and manage your routines •{' '}
                        <button
                            onClick={() => router.push('/workout/templates')}
                            className="text-blue-600 hover:underline"
                        >
                            Browse Pre-Built
                        </button>
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-black text-white p-3 rounded-xl shadow-lg hover:scale-105 transition-transform"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {error}
                </div>
            )}

            <div className="grid gap-4">
                {templates.map(t => (
                    <div
                        key={t.id}
                        className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div
                                className="flex-1 cursor-pointer"
                                onClick={() => router.push(`/workout/active/new?template=${t.id}`)}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-lg hover:text-blue-600 transition-colors">{t.name}</h3>
                                    {(t as any).category && (
                                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                            {CATEGORIES.find(c => c.value === (t as any).category)?.icon} {(t as any).category}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpen(menuOpen === t.id ? null : t.id);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <MoreVertical className="w-5 h-5 text-gray-400" />
                                </button>
                                {menuOpen === t.id && (
                                    <div className="absolute right-0 top-10 bg-white shadow-xl rounded-xl border border-gray-100 py-2 z-10 min-w-[140px]">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditModal(t);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <Edit2 className="w-4 h-4" /> Edit
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(t.id);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div
                            className="space-y-1 cursor-pointer"
                            onClick={() => router.push(`/workout/active/new?template=${t.id}`)}
                        >
                            {(t.exercises || []).slice(0, 3).map((e: any, i) => (
                                <div key={i} className="text-sm text-gray-500 flex justify-between">
                                    <span>{e.name || e.exercise_name}</span>
                                    <span className="text-gray-400 text-xs">
                                        {e.sets || e.target_sets} × {e.reps || e.target_reps}
                                    </span>
                                </div>
                            ))}
                            {(t.exercises?.length || 0) > 3 && (
                                <p className="text-xs text-blue-500 font-medium pt-1">
                                    + {(t.exercises?.length || 0) - 3} more exercises
                                </p>
                            )}
                        </div>

                        <button
                            onClick={() => router.push(`/workout/active/new?template=${t.id}`)}
                            className="mt-4 w-full py-2 bg-blue-50 text-blue-700 font-bold rounded-xl text-sm flex items-center justify-center gap-1 hover:bg-blue-100 transition-colors"
                        >
                            Start Workout <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                ))}

                {templates.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <Dumbbell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No templates yet</p>
                        <p className="text-gray-400 text-sm mt-1">Create your own or use AI Coach</p>
                        <button onClick={openCreateModal} className="text-blue-600 text-sm font-bold mt-3">
                            Create Template
                        </button>
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

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom">
                        <h2 className="text-xl font-bold mb-4">
                            {editingTemplate ? 'Edit Template' : 'New Template'}
                        </h2>

                        <div className="space-y-4">
                            {/* Workout Name */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Workout Name</label>
                                <input
                                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200"
                                    placeholder="e.g. Push Day"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat.value}
                                            type="button"
                                            onClick={() => setFormCategory(cat.value)}
                                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${formCategory === cat.value
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {cat.icon} {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Add Exercise */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Exercises</label>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-200"
                                        placeholder="Add exercise name..."
                                        value={exerciseInput}
                                        onChange={e => setExerciseInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addExercise()}
                                    />
                                    <button onClick={addExercise} className="bg-gray-900 text-white px-4 rounded-xl">
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Exercise List */}
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {formExercises.map((ex, i) => (
                                    <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-bold text-sm">{ex.name}</p>
                                            <div className="flex gap-4 text-xs text-gray-500 mt-1">
                                                <label className="flex items-center gap-1">
                                                    Sets:
                                                    <input
                                                        type="number"
                                                        className="w-12 bg-white border rounded px-2 py-1"
                                                        value={ex.sets}
                                                        onChange={e => {
                                                            const copy = [...formExercises];
                                                            copy[i].sets = parseInt(e.target.value) || 0;
                                                            setFormExercises(copy);
                                                        }}
                                                    />
                                                </label>
                                                <label className="flex items-center gap-1">
                                                    Reps:
                                                    <input
                                                        type="text"
                                                        className="w-16 bg-white border rounded px-2 py-1"
                                                        value={ex.reps}
                                                        onChange={e => {
                                                            const copy = [...formExercises];
                                                            copy[i].reps = e.target.value;
                                                            setFormExercises(copy);
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setFormExercises(formExercises.filter((_, idx) => idx !== i))}
                                            className="text-red-400 p-2 hover:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {formExercises.length === 0 && (
                                    <p className="text-gray-400 text-sm text-center py-4">
                                        No exercises added yet
                                    </p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t">
                                <button
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingTemplate(null);
                                    }}
                                    className="flex-1 py-3 text-gray-500 font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!formTitle.trim()}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-50"
                                >
                                    {editingTemplate ? 'Save Changes' : 'Create Template'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Click outside to close menu */}
            {menuOpen && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={() => setMenuOpen(null)}
                />
            )}
        </main>
    );
}
