'use client';

import { useState, useEffect } from 'react';
import { getDailyLog, upsertDailyLog } from '@/lib/api';
import { Loader2, Plus, Minus, Moon, Zap, Activity, Brain } from 'lucide-react';

interface DailyLogFormProps {
    date: Date;
}

export function DailyLogForm({ date }: DailyLogFormProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [movementCompleted, setMovementCompleted] = useState<boolean | null>(null);
    const [movementDetails, setMovementDetails] = useState({ type: '', duration: 0, intensity: 'Moderate' });

    const [nutrition, setNutrition] = useState({
        protein: 0, carbs: 0, fat: 0, calories: 0,
        windowStart: '', windowEnd: ''
    });

    const [alcohol, setAlcohol] = useState(0);

    const [subjective, setSubjective] = useState({
        sleep: 3, energy: 3, motivation: 3, stress: 3, note: ''
    });

    useEffect(() => {
        fetchLog();
    }, [date]);

    async function fetchLog() {
        setLoading(true);
        // Ensure local date string YYYY-MM-DD
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        const dateStr = offsetDate.toISOString().split('T')[0];

        try {
            const data = await getDailyLog(dateStr);

            if (data) {
                setMovementCompleted(data.movement_completed);
                setMovementDetails({
                    type: data.movement_type || '',
                    duration: data.movement_duration || 0,
                    intensity: data.movement_intensity || 'Moderate'
                });
                setNutrition({
                    protein: data.protein_grams || 0,
                    carbs: data.carbs_grams || 0,
                    fat: data.fat_grams || 0,
                    calories: data.calories || 0,
                    windowStart: data.eating_window_start || '',
                    windowEnd: data.eating_window_end || ''
                });
                setAlcohol(data.alcohol_drinks || 0);
                setSubjective({
                    sleep: data.sleep_quality || 3,
                    energy: data.energy_level || 3,
                    motivation: data.motivation_level || 3,
                    stress: data.stress_level || 3,
                    note: data.daily_note || ''
                });
            } else {
                // Reset form for fresh day
                setMovementCompleted(null);
                setMovementDetails({ type: '', duration: 0, intensity: 'Moderate' });
                setNutrition({ protein: 0, carbs: 0, fat: 0, calories: 0, windowStart: '', windowEnd: '' });
                setAlcohol(0);
                setSubjective({ sleep: 3, energy: 3, motivation: 3, stress: 3, note: '' });
            }
        } catch (error) {
            console.error('Error fetching log:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        const dateStr = offsetDate.toISOString().split('T')[0];

        try {
            await upsertDailyLog({
                date: dateStr,
                movement_completed: movementCompleted || false,
                movement_type: movementDetails.type,
                movement_duration: movementDetails.duration,
                movement_intensity: movementDetails.intensity,
                eating_window_start: nutrition.windowStart || null,
                eating_window_end: nutrition.windowEnd || null,
                protein_grams: nutrition.protein,
                carbs_grams: nutrition.carbs,
                fat_grams: nutrition.fat,
                calories: nutrition.calories,
                alcohol_drinks: alcohol,
                sleep_quality: subjective.sleep,
                energy_level: subjective.energy,
                motivation_level: subjective.motivation,
                stress_level: subjective.stress,
                daily_note: subjective.note,
            });

            // Visual feedback
            alert('Saved!');
        } catch (error) {
            console.error('Error saving:', error);
            alert('Failed to save');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-gray-400" /></div>;

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
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div>
                            <label className="text-sm font-medium text-gray-500">Activity Type</label>
                            <input
                                type="text"
                                placeholder="e.g. Cycling, Lifting"
                                value={movementDetails.type}
                                onChange={e => setMovementDetails({ ...movementDetails, type: e.target.value })}
                                className="w-full mt-1 p-3 bg-gray-50 rounded-xl"
                            />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-sm font-medium text-gray-500">Duration (min)</label>
                                <input
                                    type="number"
                                    value={movementDetails.duration || ''}
                                    onChange={e => setMovementDetails({ ...movementDetails, duration: parseInt(e.target.value) || 0 })}
                                    className="w-full mt-1 p-3 bg-gray-50 rounded-xl"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-sm font-medium text-gray-500">Intensity</label>
                                <select
                                    value={movementDetails.intensity}
                                    onChange={e => setMovementDetails({ ...movementDetails, intensity: e.target.value })}
                                    className="w-full mt-1 p-3 bg-gray-50 rounded-xl"
                                >
                                    <option>Light</option>
                                    <option>Moderate</option>
                                    <option>Hard</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Nutrition Section */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="text-xl">🥗</span> Nutrition
                </h3>

                <div className="space-y-4">
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
