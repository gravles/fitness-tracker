'use client';

import { useState, useEffect } from 'react';
import { getDailyLog, upsertDailyLog, getWorkouts, addWorkout, deleteWorkout, Workout } from '@/lib/api';
import { Loader2, Plus, Minus, Moon, Zap, Activity, Brain, Trash2, Clock, Dumbbell } from 'lucide-react';

interface DailyLogFormProps {
    date: Date;
}

export function DailyLogForm({ date }: DailyLogFormProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [movementCompleted, setMovementCompleted] = useState<boolean | null>(null);
    const [workouts, setWorkouts] = useState<Workout[]>([]);

    // New Workout Form State
    const [newWorkout, setNewWorkout] = useState({
        activity_type: '',
        duration: 30,
        intensity: 'Moderate' as 'Light' | 'Moderate' | 'Hard'
    });
    const [addingWorkout, setAddingWorkout] = useState(false);

    const [nutrition, setNutrition] = useState({
        protein: 0, carbs: 0, fat: 0, calories: 0,
        windowStart: '', windowEnd: '', logged: true
    });

    const [alcohol, setAlcohol] = useState(0);

    const [subjective, setSubjective] = useState({
        sleep: 3, energy: 3, motivation: 3, stress: 3, note: ''
    });

    const [habits, setHabits] = useState<string[]>([]);
    const [menstrualFlow, setMenstrualFlow] = useState<string | null>(null);

    useEffect(() => {
        fetchLog();
    }, [date]);

    async function fetchLog() {
        setLoading(true);
        // Ensure local date string YYYY-MM-DD
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        const dateStr = offsetDate.toISOString().split('T')[0];

        try {
            const [logData, workoutData] = await Promise.all([
                getDailyLog(dateStr),
                getWorkouts(dateStr)
            ]);

            if (logData) {
                // If workouts exist, we can assume movement was completed even if the flag says false (legacy)
                setMovementCompleted(logData.movement_completed || (workoutData && workoutData.length > 0));

                setNutrition({
                    protein: logData.protein_grams || 0,
                    carbs: logData.carbs_grams || 0,
                    fat: logData.fat_grams || 0,
                    calories: logData.calories || 0,
                    windowStart: logData.eating_window_start || '',
                    windowEnd: logData.eating_window_end || '',
                    logged: logData.protein_grams !== null || logData.calories !== null
                });
                setAlcohol(logData.alcohol_drinks || 0);
                setSubjective({
                    sleep: logData.sleep_quality || 3,
                    energy: logData.energy_level || 3,
                    motivation: logData.motivation_level || 3,
                    stress: logData.stress_level || 3,
                    note: logData.daily_note || ''
                });
                setHabits(logData.habits || []);
                setMenstrualFlow(logData.menstrual_flow || null);
            } else {
                // Reset form for fresh day
                setMovementCompleted(null);
                setNutrition({ protein: 0, carbs: 0, fat: 0, calories: 0, windowStart: '', windowEnd: '', logged: true });
                setAlcohol(0);
                setSubjective({ sleep: 3, energy: 3, motivation: 3, stress: 3, note: '' });
                setHabits([]);
                setMenstrualFlow(null);
            }
            setWorkouts(workoutData || []);

        } catch (error) {
            console.error('Error fetching log:', error);
        } finally {
            setLoading(false);
        }
    }

    // Settings State
    const [settings, setSettings] = useState<{ cycle: boolean, habits: string[] }>({ cycle: true, habits: [] });

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        // Load user settings for habits/cycle preference
        const s = await import('@/lib/api').then(m => m.getSettings());
        if (s) {
            setSettings({
                cycle: s.enable_cycle_tracking ?? true,
                habits: s.custom_habits && s.custom_habits.length > 0 ? s.custom_habits : ['Meditation', 'Cold Plunge', 'Reading', 'Stretching', 'No Sugar']
            });
        } else {
            // Defaults if no settings found
            setSettings({
                cycle: true,
                habits: ['Meditation', 'Cold Plunge', 'Reading', 'Stretching', 'No Sugar']
            });
        }
    }

    async function handleAddWorkout() {
        if (!newWorkout.activity_type) return;
        setAddingWorkout(true);
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        const dateStr = offsetDate.toISOString().split('T')[0];

        try {
            const added = await addWorkout({
                date: dateStr,
                activity_type: newWorkout.activity_type,
                duration: newWorkout.duration,
                intensity: newWorkout.intensity,
            });
            setWorkouts([...workouts, added]);
            setNewWorkout({ activity_type: '', duration: 30, intensity: 'Moderate' }); // Reset form
        } catch (error) {
            console.error('Error adding workout', error);
            alert('Failed to add workout');
        } finally {
            setAddingWorkout(false);
        }
    }

    async function handleDeleteWorkout(id: string) {
        if (!confirm('Delete this workout?')) return;
        try {
            await deleteWorkout(id);
            setWorkouts(workouts.filter(w => w.id !== id));
        } catch (error) {
            console.error('Error deleting workout', error);
        }
    }

    async function handleSave() {
        setSaving(true);
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        const dateStr = offsetDate.toISOString().split('T')[0];

        try {
            await upsertDailyLog({
                date: dateStr,
                // If user says "No" explicitly, movement_completed is false.
                // If user says "Yes" (or has workouts), it is true.
                movement_completed: movementCompleted === false ? false : (movementCompleted === true || workouts.length > 0),
                eating_window_start: nutrition.windowStart || null,
                eating_window_end: nutrition.windowEnd || null,
                protein_grams: nutrition.protein === 0 && !nutrition.logged ? null : nutrition.protein,
                carbs_grams: nutrition.carbs,
                fat_grams: nutrition.fat,
                calories: nutrition.calories === 0 && !nutrition.logged ? null : nutrition.calories,
                alcohol_drinks: alcohol,
                sleep_quality: subjective.sleep,
                energy_level: subjective.energy,
                motivation_level: subjective.motivation,
                stress_level: subjective.stress,
                daily_note: subjective.note,
                habits: habits,
                menstrual_flow: menstrualFlow,
            });

            // --- GAMIFICATION LOGIC START ---
            let xpGained = 0;
            const logForCalc: any = {
                movement_completed: movementCompleted === false ? false : (movementCompleted === true || workouts.length > 0),
                movement_duration: totalDuration, // Use aggregated duration
                movement_intensity: workouts.length > 0 ? workouts[0].intensity : 'Moderate', // simplify for MVP
                protein_grams: nutrition.protein,
                eating_window_start: nutrition.windowStart,
                eating_window_end: nutrition.windowEnd,
                habits: habits,
                date: dateStr
            };

            // Calculate base XP
            const { calculateXP } = await import('@/lib/gamification');
            xpGained = calculateXP(logForCalc);

            // Update XP in DB
            const { updateUserXP } = await import('@/lib/api');
            const result = await updateUserXP(xpGained);

            // TODO: In a real app we would check for badges here too using badge definitions
            // --- GAMIFICATION LOGIC END ---

            // Visual feedback
            alert(`Saved! You earned +${xpGained} XP! ${result?.leveledUp ? 'LEVEL UP! 🎉' : ''}`);
        } catch (error) {
            console.error('Error saving:', error);
            alert('Failed to save');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-gray-400" /></div>;

    // Calculate daily total duration
    const totalDuration = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);

    return (
        <div className="space-y-8 pb-24">
            {/* Movement Section */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" /> Movement
                </h3>

                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setMovementCompleted(true)}
                        className={`flex-1 py-4 rounded-xl font-medium transition-all ${movementCompleted === true ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    >
                        Yes, I moved
                    </button>
                    <button
                        onClick={() => setMovementCompleted(false)}
                        className={`flex-1 py-4 rounded-xl font-medium transition-all ${movementCompleted === false ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    >
                        No
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
                            <h4 className="text-sm font-bold text-blue-900 mb-3 uppercase tracking-wider flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Add Workout
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
                                    disabled={!newWorkout.activity_type || addingWorkout}
                                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                                >
                                    {addingWorkout ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Add Workout'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Nutrition Section */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span className="text-xl">🥗</span> Nutrition
                    </h3>
                    <button
                        onClick={() => setNutrition({ ...nutrition, logged: !nutrition.logged })}
                        className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all ${!nutrition.logged
                            ? 'bg-orange-100 text-orange-700 border-orange-200'
                            : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                    >
                        {nutrition.logged ? "Mark as Not Tracked" : "Not Tracked"}
                    </button>
                </div>

                {!nutrition.logged ? (
                    <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-500 text-sm italic">
                        Nutrition skipped for today.
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in">
                        <div>
                            <label className="text-sm font-medium text-gray-500 flex justify-between">
                                Protein (g) <span className="text-blue-600 font-bold">{nutrition.protein}g</span>
                            </label>
                            <input
                                type="range" min="0" max="300" step="5"
                                value={nutrition.protein}
                                onChange={e => setNutrition({ ...nutrition, protein: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2 accent-blue-600"
                            />
                            <div className="flex gap-2 mt-2">
                                <input
                                    type="number"
                                    value={nutrition.protein || ''}
                                    onChange={e => setNutrition({ ...nutrition, protein: parseInt(e.target.value) || 0 })}
                                    className="w-20 p-2 bg-gray-50 rounded-lg text-center"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-500">Calories</label>
                                <input
                                    type="number"
                                    value={nutrition.calories || ''}
                                    onChange={e => setNutrition({ ...nutrition, calories: parseInt(e.target.value) || 0 })}
                                    className="w-full mt-1 p-3 bg-gray-50 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-500">Eating Window</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <input
                                        type="time"
                                        value={nutrition.windowStart}
                                        onChange={e => setNutrition({ ...nutrition, windowStart: e.target.value })}
                                        className="w-full p-2 bg-gray-50 rounded-lg text-xs"
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="time"
                                        value={nutrition.windowEnd}
                                        onChange={e => setNutrition({ ...nutrition, windowEnd: e.target.value })}
                                        className="w-full p-2 bg-gray-50 rounded-lg text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Alcohol Section */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="text-xl">🍺</span> Alcohol
                </h3>
                <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-medium">Standard Drinks</span>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setAlcohol(Math.max(0, alcohol - 1))}
                            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200"
                        >
                            <Minus className="w-5 h-5" />
                        </button>
                        <span className="text-2xl font-bold w-8 text-center">{alcohol}</span>
                        <button
                            onClick={() => setAlcohol(alcohol + 1)}
                            className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 active:bg-blue-100"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Subjective Metrics */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-500" /> How did you feel?
                </h3>

                <div className="space-y-6">
                    {[
                        { label: 'Sleep Quality', icon: <Moon className="w-4 h-4" />, key: 'sleep' },
                        { label: 'Energy', icon: <Zap className="w-4 h-4" />, key: 'energy' },
                        { label: 'Stress', icon: <Activity className="w-4 h-4" />, key: 'stress' },
                    ].map((metric) => (
                        <div key={metric.key}>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                    {metric.icon} {metric.label}
                                </label>
                                <span className="font-bold text-gray-900">{(subjective as any)[metric.key]}/5</span>
                            </div>
                            <div className="flex justify-between gap-1">
                                {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => setSubjective({ ...subjective, [metric.key]: val })}
                                        className={`h-8 w-full rounded transition-all ${(subjective as any)[metric.key] >= val
                                            ? 'bg-purple-500'
                                            : 'bg-gray-100'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <textarea
                    placeholder="Daily notes..."
                    value={subjective.note}
                    onChange={e => setSubjective({ ...subjective, note: e.target.value })}
                    className="w-full mt-6 p-3 bg-gray-50 rounded-xl h-24 resize-none"
                />
            </section>

            {/* Habits Section */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="text-xl">🧘</span> Daily Habits
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {settings.habits.map(habit => (
                        <button
                            key={habit}
                            onClick={() => {
                                if (habits.includes(habit)) {
                                    setHabits(habits.filter(h => h !== habit));
                                } else {
                                    setHabits([...habits, habit]);
                                }
                            }}
                            className={`p-3 rounded-xl border text-sm font-medium transition-all ${habits.includes(habit)
                                ? 'bg-green-50 border-green-200 text-green-700 shadow-sm'
                                : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            {habits.includes(habit) ? '✅ ' : '⬜ '}{habit}
                        </button>
                    ))}
                </div>
            </section>

            {/* Cycle Tracking (Optional) */}
            {settings.cycle && (
                <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="text-xl">🌸</span> Cycle Tracking
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                        {['None', 'Light', 'Medium', 'Heavy'].map(flow => (
                            <button
                                key={flow}
                                onClick={() => setMenstrualFlow(flow === 'None' ? null : flow)}
                                className={`py-2 rounded-lg text-xs font-bold transition-all ${(menstrualFlow === flow || (flow === 'None' && menstrualFlow === null))
                                    ? 'bg-pink-100 text-pink-700 border border-pink-200'
                                    : 'bg-gray-50 text-gray-400 border border-transparent'
                                    }`}
                            >
                                {flow}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Floating Save Button */}
            <div className="fixed bottom-20 right-6 md:right-[max(1.5rem,calc(50vw-220px))]">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-4 bg-black text-white rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all font-bold text-lg"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Log'}
                </button>
            </div>
        </div>
    );
}
