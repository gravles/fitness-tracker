'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '@/lib/api';
import { Loader2, Save, Target } from 'lucide-react';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [targets, setTargets] = useState({
        weight: '',
        protein: '',
        calories: ''
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
                    calories: data.target_calories?.toString() || ''
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
                target_calories: parseInt(targets.calories) || null
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

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-4 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                >
                    {saving ? <Loader2 className="animate-spin" /> : <><Save className="w-4 h-4" /> Save Targets</>}
                </button>
            </section>

            <section className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <h3 className="font-bold text-gray-400 text-sm uppercase tracking-wide mb-4">About</h3>
                <p className="text-xs text-gray-500">
                    Fitness Tracker v1.0<br />
                    Built with Next.js & Supabase
                </p>
            </section>
        </main>
    );
}
