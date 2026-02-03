'use client';

import { Workout, addWorkout, deleteWorkout, updateWorkout } from '@/lib/api';
import { Loader2, Plus, Dumbbell, Clock, Trash2, Sparkles, Pencil, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

interface MovementSectionProps {
    movementCompleted: boolean | null;
    setMovementCompleted: (val: boolean) => void;
    workouts: Workout[];
    setWorkouts: (workouts: Workout[]) => void;
    dateStr: string;
    onOpenAiCoach: () => void;
    onAddWorkoutStart: () => void;
    addingWorkout: boolean;
    onDeleteWorkoutStart: () => void;
}

export function MovementSection({
    movementCompleted,
    setMovementCompleted,
    workouts,
    setWorkouts,
    dateStr,
    onOpenAiCoach,
    onAddWorkoutStart,
    addingWorkout,
    onDeleteWorkoutStart // Pass callback to notify parent if needed, effectively just state update wrappers in parent
}: MovementSectionProps) {

    const router = useRouter();
    const [newWorkout, setNewWorkout] = useState<{ activity_type: string, duration: number, intensity: 'Moderate' | 'Light' | 'Hard' }>({ activity_type: '', duration: 30, intensity: 'Moderate' });
    const [localAdding, setLocalAdding] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ activity_type: string, duration: number, intensity: 'Moderate' | 'Light' | 'Hard' }>({ activity_type: '', duration: 30, intensity: 'Moderate' });

    const workoutPresets = [
        { emoji: '🏃', label: 'Run', activity: 'Running', duration: 30 },
        { emoji: '🚴', label: 'Cycle', activity: 'Cycling', duration: 45 },
        { emoji: '🏋️', label: 'Gym', activity: 'Gym', duration: 60 },
        { emoji: '🧘', label: 'Yoga', activity: 'Yoga', duration: 30 },
        { emoji: '🏊', label: 'Swim', activity: 'Swimming', duration: 30 },
        { emoji: '🚶', label: 'Walk', activity: 'Walking', duration: 30 },
    ];

    const totalDuration = workouts.reduce((acc, w) => acc + w.duration, 0);

    async function handleAddWorkout() {
        if (!newWorkout.activity_type) return;
        setLocalAdding(true);
        onAddWorkoutStart(); // Notify parent useful for autosave triggers? Parent handles autosave via useEffect on workouts state.

        try {
            const added = await addWorkout({
                date: dateStr,
                activity_type: newWorkout.activity_type,
                duration: newWorkout.duration,
                intensity: newWorkout.intensity,
            });
            setWorkouts([...workouts, added]);
            setNewWorkout({ activity_type: '', duration: 30, intensity: 'Moderate' });
            setShowAddForm(false); // Collapse after adding
        } catch (error) {
            console.error('Error adding workout', error);
            alert('Failed to add workout');
        } finally {
            setLocalAdding(false);
        }
    }

    async function quickAddWorkout(preset: typeof workoutPresets[0]) {
        setLocalAdding(true);
        try {
            const added = await addWorkout({
                date: dateStr,
                activity_type: preset.activity,
                duration: preset.duration,
                intensity: 'Moderate',
            });
            setWorkouts([...workouts, added]);
        } catch (error) {
            console.error('Error adding workout', error);
            alert('Failed to add workout');
        } finally {
            setLocalAdding(false);
        }
    }

    async function handleDeleteWorkout(id: string) {
        if (!confirm('Delete this workout?')) return;
        onDeleteWorkoutStart();
        try {
            await deleteWorkout(id);
            setWorkouts(workouts.filter(w => w.id !== id));
        } catch (error) {
            console.error('Error deleting workout', error);
        }
    }

    function handleEditWorkout(workout: Workout) {
        setEditingId(workout.id!);
        setEditForm({
            activity_type: workout.activity_type,
            duration: workout.duration,
            intensity: workout.intensity as 'Light' | 'Moderate' | 'Hard'
        });
    }

    async function handleSaveEdit() {
        if (!editingId) return;
        try {
            await updateWorkout(editingId, {
                activity_type: editForm.activity_type,
                duration: editForm.duration,
                intensity: editForm.intensity
            });
            setWorkouts(workouts.map(w =>
                w.id === editingId
                    ? { ...w, activity_type: editForm.activity_type, duration: editForm.duration, intensity: editForm.intensity }
                    : w
            ));
            setEditingId(null);
        } catch (error) {
            console.error('Error updating workout', error);
            alert('Failed to update workout');
        }
    }

    return (
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-xl">🔥</span> Movement
            </h3>

            {/* Did you move? Toggle */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setMovementCompleted(true)}
                    className={`flex-1 py-4 rounded-xl font-bold transition-all border-2 ${movementCompleted === true
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-[1.02]'
                        : 'bg-white border-gray-100 text-gray-400 hover:border-blue-200'}`}
                >
                    Yes, I moved!
                </button>
                <button
                    onClick={() => setMovementCompleted(false)}
                    className={`flex-1 py-4 rounded-xl font-bold transition-all border-2 ${movementCompleted === false
                        ? 'bg-gray-800 border-gray-800 text-white shadow-lg scale-[1.02]'
                        : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                >
                    Rest Day
                </button>
            </div>

            {movementCompleted && (
                <div className="animate-in fade-in slide-in-from-top-4 space-y-6">

                    {/* List of Today's Workouts */}
                    {workouts.length > 0 && (
                        <div className="space-y-3">
                            {workouts.map(workout => (
                                <div key={workout.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    {editingId === workout.id ? (
                                        /* Inline Edit Form */
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={editForm.activity_type}
                                                onChange={e => setEditForm({ ...editForm, activity_type: e.target.value })}
                                                className="w-full p-2 bg-white rounded-lg border border-gray-200 font-medium"
                                                placeholder="Activity type"
                                            />
                                            <div className="flex gap-3">
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Duration (min)</label>
                                                    <input
                                                        type="number"
                                                        value={editForm.duration}
                                                        onChange={e => setEditForm({ ...editForm, duration: parseInt(e.target.value) || 0 })}
                                                        className="w-full p-2 bg-white rounded-lg border border-gray-200"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Intensity</label>
                                                    <select
                                                        value={editForm.intensity}
                                                        onChange={e => setEditForm({ ...editForm, intensity: e.target.value as any })}
                                                        className="w-full p-2 bg-white rounded-lg border border-gray-200"
                                                    >
                                                        <option>Light</option>
                                                        <option>Moderate</option>
                                                        <option>Hard</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    <X className="w-4 h-4" /> Cancel
                                                </button>
                                                <button
                                                    onClick={handleSaveEdit}
                                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                                >
                                                    <Check className="w-4 h-4" /> Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Normal Display */
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-sm">
                                                    <Dumbbell className="w-5 h-5 text-blue-500" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-gray-900">{workout.activity_type}</h4>
                                                        {workout.source === 'strava' && (
                                                            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">Strava</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {workout.duration} min</span>
                                                        {workout.distance && (
                                                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                                                                📏 {(workout.distance / 1000).toFixed(2)} km
                                                            </span>
                                                        )}
                                                        {workout.calories && (
                                                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                                                                🔥 {workout.calories} kcal
                                                            </span>
                                                        )}
                                                        {workout.average_heartrate && (
                                                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                                                                ❤️ {Math.round(workout.average_heartrate)} bpm
                                                            </span>
                                                        )}
                                                        <span className="px-2 py-0.5 bg-gray-200 rounded-full text-gray-700 font-medium">{workout.intensity}</span>
                                                    </div>
                                                    {workout.notes && <p className="text-xs text-gray-400 mt-1 italic line-clamp-1">{workout.notes}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleEditWorkout(workout)}
                                                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteWorkout(workout.id!)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div className="text-right text-sm text-gray-500 font-medium pt-2 border-t border-gray-100">
                                Total Duration: <span className="text-blue-600 font-bold">{totalDuration} min</span>
                            </div>
                        </div>
                    )}

                    {/* Quick Add Presets */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quick Add</h4>
                        <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
                            {workoutPresets.map((preset) => (
                                <div key={preset.label} className="contents">
                                    <button
                                        onClick={() => quickAddWorkout(preset)}
                                        className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-xl transition-all tap-target active:scale-95"
                                    >
                                        <span className="text-2xl mb-1">{preset.emoji}</span>
                                        <span className="text-xs font-bold text-gray-700">{preset.label}</span>
                                        <span className="text-[10px] text-gray-400">{preset.duration}m</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Custom Workout Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex-1 flex items-center justify-center gap-2 p-3 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors tap-target"
                        >
                            {showAddForm ? (
                                <>Close Form <ChevronUp className="w-4 h-4" /></>
                            ) : (
                                <>Custom Workout <ChevronDown className="w-4 h-4" /></>
                            )}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onOpenAiCoach(); }}
                            className="px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-md active:scale-95 transition-all flex items-center gap-2 tap-target"
                        >
                            <Sparkles className="w-4 h-4" /> AI Coach
                        </button>
                    </div>

                    {showAddForm && (
                        <div className="bg-blue-50/50 rounded-xl border border-blue-100 overflow-hidden p-5 space-y-4 animate-in slide-in-from-top-2">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Activity</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Cycling, Lifting, Yoga"
                                    value={newWorkout.activity_type}
                                    onChange={e => setNewWorkout({ ...newWorkout, activity_type: e.target.value })}
                                    className="w-full mt-1 p-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mins</label>
                                    <input
                                        type="number"
                                        value={newWorkout.duration}
                                        onChange={e => setNewWorkout({ ...newWorkout, duration: parseInt(e.target.value) || 0 })}
                                        className="w-full mt-1 p-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Intensity</label>
                                    <select
                                        value={newWorkout.intensity}
                                        onChange={e => setNewWorkout({ ...newWorkout, intensity: e.target.value as any })}
                                        className="w-full mt-1 p-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option>Light</option>
                                        <option>Moderate</option>
                                        <option>Hard</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={handleAddWorkout}
                                disabled={!newWorkout.activity_type || localAdding}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none tap-target"
                            >
                                {localAdding ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Add Workout'}
                            </button>
                        </div>
                    )}
                    <div className="pt-4 border-t border-gray-100">
                        <button
                            onClick={() => router.push('/workout')}
                            className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-colors"
                        >
                            <span>🏋️‍♀️</span>
                            Open Workout Hub
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
