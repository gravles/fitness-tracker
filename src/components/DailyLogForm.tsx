'use client';

import { useState, useEffect } from 'react';
import { getDailyLog, upsertDailyLog, getWorkouts, addWorkout, deleteWorkout, Workout } from '@/lib/api';
import { Loader2, Plus, Minus, Moon, Zap, Activity, Brain, Trash2, Clock, Dumbbell, Camera, X } from 'lucide-react';
import { FoodCamera } from './FoodCamera';
import { VoiceInput } from './VoiceInput';

interface DailyLogFormProps {
    date: Date;
}

export function DailyLogForm({ date }: DailyLogFormProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [loadingAI, setLoadingAI] = useState(false);

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

    // Settings State (for UI toggles)
    const [settings, setSettings] = useState({
        cycle: true,
        habits: ['Meditation', 'Cold Plunge', 'Reading', 'Stretching', 'No Sugar']
    });

    // Gamification State
    const [initialXP, setInitialXP] = useState(0);
    const [targetsState, setTargetsState] = useState<{ protein: number, calories: number } | null>(null);

    // Computed
    const totalDuration = workouts.reduce((acc, curr) => acc + curr.duration, 0);

    async function fetchLog() {
        setLoading(true);
        // Ensure local date string YYYY-MM-DD
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        const dateStr = offsetDate.toISOString().split('T')[0];

        try {
            // Fetch everything we need: Log, Workouts, AND Settings (for targets)
            const [logData, workoutData, settingsData] = await Promise.all([
                getDailyLog(dateStr),
                getWorkouts(dateStr),
                import('@/lib/api').then(m => m.getSettings())
            ]);

            // Update Settings State
            if (settingsData) {
                setSettings({
                    cycle: settingsData.enable_cycle_tracking ?? true,
                    habits: settingsData.custom_habits && settingsData.custom_habits.length > 0 ? settingsData.custom_habits : ['Meditation', 'Cold Plunge', 'Reading', 'Stretching', 'No Sugar']
                });
                setTargetsState({
                    protein: settingsData.target_protein || 0,
                    calories: settingsData.target_calories || 0
                });
            }

            if (logData) {
                setMovementCompleted(logData.movement_completed);
                setNutrition({
                    protein: logData.protein_grams || 0,
                    carbs: logData.carbs_grams || 0,
                    fat: logData.fat_grams || 0,
                    calories: logData.calories || 0,
                    windowStart: logData.eating_window_start || '',
                    windowEnd: logData.eating_window_end || '',
                    logged: logData.nutrition_logged ?? true
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

                // Calculate Initial XP from existing data
                const { calculateXP } = await import('@/lib/gamification');
                const t = settingsData ? { daily_protein: settingsData.target_protein || 0, daily_calories: settingsData.target_calories || 0 } : undefined;
                const baseline = calculateXP(logData, t);
                setInitialXP(baseline);

            } else {
                // Reset form defaults if no log exists
                setMovementCompleted(null);
                setNutrition({
                    protein: 0, carbs: 0, fat: 0, calories: 0,
                    windowStart: '', windowEnd: '', logged: true
                });
                setAlcohol(0);
                setSubjective({
                    sleep: 3, energy: 3, motivation: 3, stress: 3, note: ''
                });
                setHabits([]);
                setMenstrualFlow(null);
                setInitialXP(0);
            }
            setWorkouts(workoutData || []);

        } catch (error) {
            console.error('Error fetching log:', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchLog();
    }, [date]);

    async function handleAddWorkout() {
        if (!newWorkout.activity_type) return;
        setAddingWorkout(true);

        // Ensure local date string YYYY-MM-DD
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
            // --- GAMIFICATION LOGIC START ---
            const { calculateXP } = await import('@/lib/gamification');

            // 1. Reconstruct New State
            const currentLogState: any = {
                movement_completed: movementCompleted === false ? false : (movementCompleted === true || workouts.length > 0),
                movement_duration: totalDuration,
                protein_grams: nutrition.protein,
                calories: nutrition.calories,
                habits: habits,
                date: dateStr
            };

            // 2. Refresh Targets (ensure we use latest keys)
            const activeTargets = targetsState ? { daily_protein: targetsState.protein, daily_calories: targetsState.calories } : undefined;
            const newDailyXP = calculateXP(currentLogState, activeTargets);

            // 3. Calculate Delta
            const xpDelta = newDailyXP - initialXP;

            // --- END GAMIFICATION PRE-CALC ---

            const logData = {
                date: dateStr,
                movement_completed: currentLogState.movement_completed,
                movement_duration: totalDuration,

                protein_grams: nutrition.protein,
                carbs_grams: nutrition.carbs,
                fat_grams: nutrition.fat,
                calories: nutrition.calories,
                eating_window_start: nutrition.windowStart || null,
                eating_window_end: nutrition.windowEnd || null,
                nutrition_logged: nutrition.logged,

                alcohol_drinks: alcohol,

                sleep_quality: subjective.sleep,
                energy_level: subjective.energy,
                motivation_level: subjective.motivation,
                stress_level: subjective.stress,
                daily_note: subjective.note,

                habits: habits,
                menstrual_flow: menstrualFlow
            };

            await upsertDailyLog(logData);

            // Apply XP update if any
            if (xpDelta !== 0) {
                const { updateUserXP } = await import('@/lib/api');
                const result = await updateUserXP(xpDelta);
                setInitialXP(newDailyXP); // Update baseline for next save

                if (xpDelta > 0) {
                    alert(`Saved! You earned +${xpDelta} XP! (Daily Total: ${newDailyXP}) ${result?.leveledUp ? 'LEVEL UP! 🎉' : ''}`);
                } else {
                    alert(`Saved! Updated daily stats.`);
                }
            } else {
                alert('Saved!');
            }

        } catch (error) {
            console.error('Error saving log:', error);
            alert('Failed to save log');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-32">
            {/* Movement Section */}
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
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span className="text-xl">🥗</span> Nutrition
                    </h3>
                    <div className="flex gap-2">
                        <VoiceInput onIntentDetected={(intent) => {
                            if (intent.intent === 'log_food') {
                                // Simple text fallback if AI returns raw text
                                setSubjective(prev => ({ ...prev, note: (prev.note + ' ' + (intent.data?.item || intent.original)).trim() }));
                                alert(`Voice Logged: ${intent.data?.item || intent.original}`);
                            }
                        }} />
                        <button
                            onClick={() => setShowCamera(true)}
                            className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                        >
                            <Camera className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setNutrition({ ...nutrition, logged: !nutrition.logged })}
                            className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all ${!nutrition.logged
                                ? 'bg-orange-100 text-orange-700 border-orange-200'
                                : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                        >
                            {nutrition.logged ? "Mark as Not Tracked" : "Not Tracked"}
                        </button>
                    </div>
                </div>

                {showCamera && (
                    <div className="mb-6 animate-in slide-in-from-top-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-gray-600">Scan Meal</h4>
                            <button onClick={() => setShowCamera(false)}><X className="w-4 h-4 text-gray-400" /></button>
                        </div>
                        <FoodCamera
                            onClose={() => setShowCamera(false)}
                            onCapture={async (img) => {
                                setShowCamera(false);
                                setLoadingAI(true);
                                try {
                                    const res = await fetch('/api/ai/analyze-food', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ image: img })
                                    });
                                    const data = await res.json();
                                    setNutrition(prev => ({
                                        ...prev,
                                        calories: (prev.calories || 0) + data.calories,
                                        protein: (prev.protein || 0) + data.protein,
                                        carbs: (prev.carbs || 0) + data.carbs,
                                        fat: (prev.fat || 0) + data.fat
                                    }));
                                    setSubjective(prev => ({ ...prev, note: (prev.note + `\n[AI Scan]: ${data.name}`).trim() }));
                                } catch (e: any) {
                                    console.error(e);
                                    alert('AI Error: ' + (e.message || 'Failed to analyze food. Check usage limits.'));
                                } finally {
                                    setLoadingAI(false);
                                }
                            }}
                        />
                    </div>
                )}

                {loadingAI && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-blue-600">
                        <Brain className="w-8 h-8 animate-pulse mb-2" />
                        <p className="text-sm font-bold animate-pulse">Analyzing Food...</p>
                    </div>
                )}

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
                        { label: 'Motivation', icon: <Activity className="w-4 h-4" />, key: 'motivation' },
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
