'use client';

import { Workout, addWorkout, deleteWorkout } from '@/lib/api';
import { Loader2, Plus, Dumbbell, Clock, Trash2, Sparkles } from 'lucide-react';
import { useState } from 'react';

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

    const [newWorkout, setNewWorkout] = useState<{ activity_type: string, duration: number, intensity: 'Moderate' | 'Light' | 'Hard' }>({ activity_type: '', duration: 30, intensity: 'Moderate' });
    const [localAdding, setLocalAdding] = useState(false);

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
                                <div key={workout.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-sm">
                                            <Dumbbell className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">{workout.activity_type}</h4>
                                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {workout.duration} min</span>
                                                <span className="px-2 py-0.5 bg-gray-200 rounded-full text-gray-700 font-medium">{workout.intensity}</span>
                                            </div>
                                            {workout.notes && <p className="text-xs text-gray-500 mt-1 italic">{workout.notes}</p>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteWorkout(workout.id!)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <div className="text-right text-sm text-gray-500 font-medium pt-2 border-t border-gray-100">
                                Total Duration: <span className="text-blue-600 font-bold">{totalDuration} min</span>
                            </div>
                        </div>
                    )}

                    {/* Add New Workout Form */}
                    <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                        <h4 className="text-sm font-bold text-blue-900 mb-3 uppercase tracking-wider flex items-center justify-between">
                            <span className="flex items-center gap-2"><Plus className="w-4 h-4" /> Add Workout</span>
                            <button
                                onClick={onOpenAiCoach}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1"
                            >
                                <Sparkles className="w-3 h-3" /> AI Coach
                            </button>
                        </h4>
                        <div className="space-y-4">
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
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                            >
                                {localAdding ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Add Workout'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
