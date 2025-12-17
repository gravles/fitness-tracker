'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '@/lib/api';
import { Loader2, Save, Target, Plus } from 'lucide-react';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [targets, setTargets] = useState({
        weight: '',
        protein: '',
        calories: '',
        enableCycle: true,
        habits: [] as string[]
    });

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        try {
            const data = await getSettings();
            if (data) {
                setTargets({
                    weight: data.target_weight?.toString() || '',
                    protein: data.target_protein?.toString() || '',
                    calories: data.target_calories?.toString() || '',
                    enableCycle: data.enable_cycle_tracking ?? true,
                    habits: data.custom_habits || []
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            await updateSettings({
                target_weight: parseFloat(targets.weight) || null,
                target_protein: parseInt(targets.protein) || null,
                target_calories: parseInt(targets.calories) || null,
                enable_cycle_tracking: targets.enableCycle,
                custom_habits: targets.habits
            });
            alert('Settings saved!');
        } catch (error) {
            alert('Error saving settings');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

    return (
        <main className="p-6 pt-12 pb-24 space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
                    <Target className="w-5 h-5 text-blue-600" />
                    <h2 className="font-bold text-lg">My Targets</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Goal Weight (lbs)</label>
                        <input
                            type="number"
                            placeholder="e.g. 175"
                            value={targets.weight}
                            onChange={e => setTargets({ ...targets, weight: e.target.value })}
                            className="w-full p-3 bg-gray-50 rounded-xl"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Daily Protein (g)</label>
                        <input
                            type="number"
                            placeholder="e.g. 180"
                            value={targets.protein}
                            onChange={e => setTargets({ ...targets, protein: e.target.value })}
                            className="w-full p-3 bg-gray-50 rounded-xl"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Daily Calories (kcal)</label>
                        <input
                            type="number"
                            placeholder="e.g. 2500"
                            value={targets.calories}
                            onChange={e => setTargets({ ...targets, calories: e.target.value })}
                            className="w-full p-3 bg-gray-50 rounded-xl"
                        />
                    </div>
                </div>
            </section>

            {/* Customization Section */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
                    <span className="text-xl">⚙️</span>
                    <h2 className="font-bold text-lg">Customization</h2>
                </div>

                {/* Cycle Tracking Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-gray-900">Cycle Tracking</h3>
                        <p className="text-sm text-gray-500">Show menstrual flow in daily logs</p>
                    </div>
                    <button
                        onClick={() => setTargets({ ...targets, enableCycle: !targets.enableCycle })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${targets.enableCycle ? 'bg-black' : 'bg-gray-200'}`}
                    >
                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${targets.enableCycle ? 'translate-x-6' : ''}`} />
                    </button>
                </div>

                {/* Habit Manager */}
                <div>
                    <h3 className="font-medium text-gray-900 mb-2">My Habits</h3>
                    <p className="text-sm text-gray-500 mb-4">Customize the habits you want to track daily.</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {targets.habits.map(habit => (
                            <div key={habit} className="bg-gray-100 px-3 py-1 rounded-lg text-sm flex items-center gap-2">
                                {habit}
                                <button
                                    onClick={() => setTargets({ ...targets, habits: targets.habits.filter(h => h !== habit) })}
                                    className="text-gray-400 hover:text-red-500"
                                >
                                    <span className="sr-only">Remove</span>x
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Add new habit..."
                            className="flex-1 p-3 bg-gray-50 rounded-xl"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value.trim();
                                    if (val && !targets.habits.includes(val)) {
                                        setTargets({ ...targets, habits: [...targets.habits, val] });
                                        e.currentTarget.value = '';
                                    }
                                }
                            }}
                        />
                        <button className="bg-gray-900 text-white px-4 rounded-xl font-bold" onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            const val = input.value.trim();
                            if (val && !targets.habits.includes(val)) {
                                setTargets({ ...targets, habits: [...targets.habits, val] });
                                input.value = '';
                            }
                        }}>
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-4 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                >
                    {saving ? <Loader2 className="animate-spin" /> : <><Save className="w-4 h-4" /> Save All Settings</>}
                </button>
            </section>

            <section className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <h3 className="font-bold text-gray-400 text-sm uppercase tracking-wide mb-4">About</h3>
                <p className="text-xs text-gray-500">
                    Fitness Tracker v1.1<br />
                    Built with Next.js & Supabase
                </p>
            </section>
        </main >
    );
}
