'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings, getUserBadges, UserBadge } from '@/lib/api';
import { Loader2, Save, Target, Plus, Trophy, Sparkles, Rocket, Bell } from 'lucide-react';
import { TrophyCase } from '@/components/TrophyCase';
import { StravaConnect } from '@/components/StravaConnect';
import { ChangelogModal } from '@/components/ChangelogModal';
import { getPermissionStatus, subscribeToPush, unsubscribeFromPush, isPushSupported } from '@/lib/notifications';
import { haptics } from '@/lib/haptics';

function PWADiagnostic() {
    const [status, setStatus] = useState<'checking' | 'active' | 'missing'>('checking');
    const [error, setError] = useState('');

    useEffect(() => {
        checkStatus();
    }, []);

    function checkStatus() {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) {
                setStatus('active');
            } else {
                setStatus('missing');
            }
        });
    }

    function register() {
        setStatus('checking');
        navigator.serviceWorker.register('/sw.js')
            .then(() => {
                setTimeout(checkStatus, 500);
            })
            .catch(err => {
                setStatus('missing');
                setError(err.message);
            });
    }

    return (
        <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="font-bold text-xs text-gray-400 uppercase mb-2">PWA Status</h4>
            <div className="text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                    <span className="text-gray-500">Service Worker:</span>
                    <span className="text-green-600">Supported</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-500">Registration:</span>
                    <span className={status === 'active' ? 'text-green-600' : status === 'missing' ? 'text-red-500' : 'text-gray-400'}>
                        {status === 'active' ? 'Active ✅' : status === 'missing' ? 'Missing ❌' : 'Checking...'}
                    </span>
                </div>

                {status === 'missing' && (
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                        <p className="text-red-600 mb-2">Worker not running.</p>
                        <button
                            onClick={register}
                            className="w-full py-2 bg-red-100 text-red-700 font-bold rounded hover:bg-red-200 transaction-colors"
                        >
                            Force Register
                        </button>
                        {error && <p className="mt-2 text-[10px] text-red-500">{error}</p>}
                    </div>
                )}

                {status === 'active' && (
                    <div className="bg-green-50 p-2 rounded text-green-700 text-center">
                        Ready to Install!
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationsSupported, setNotificationsSupported] = useState(false);
    const [targets, setTargets] = useState({
        weight: '',
        protein: '',
        calories: '',
        enableCycle: true,
        habits: [] as string[],
        equipment: [] as string[]
    });
    const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        try {
            const [data, badges] = await Promise.all([
                getSettings(),
                getUserBadges()
            ]);

            setEarnedBadges(badges);

            if (data) {
                setTargets({
                    weight: data.target_weight?.toString() || '',
                    protein: data.target_protein?.toString() || '',
                    calories: data.target_calories?.toString() || '',
                    enableCycle: data.enable_cycle_tracking ?? true,
                    habits: data.custom_habits || [],
                    equipment: data.available_equipment || []
                });
            }

            // Check notification status
            if (isPushSupported()) {
                setNotificationsSupported(true);
                const status = getPermissionStatus();
                setNotificationsEnabled(status === 'granted');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function handleToggleNotifications() {
        haptics.tap();
        try {
            if (notificationsEnabled) {
                await unsubscribeFromPush();
                setNotificationsEnabled(false);
            } else {
                const sub = await subscribeToPush();
                setNotificationsEnabled(!!sub);
            }
        } catch (error) {
            console.error('Notification toggle failed', error);
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
                custom_habits: targets.habits,
                available_equipment: targets.equipment
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

            {/* Integrations Section */}
            <StravaConnect />

            {/* Customization Section */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
                    <span className="text-xl">⚙️</span>
                    <h2 className="font-bold text-lg">Customization</h2>
                </div>

                {/* Push Notifications Toggle */}
                {notificationsSupported && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Bell className="w-5 h-5 text-purple-600" />
                            <div>
                                <h3 className="font-medium text-gray-900">Push Notifications</h3>
                                <p className="text-sm text-gray-500">Get reminders to log and streak alerts</p>
                            </div>
                        </div>
                        <button
                            onClick={handleToggleNotifications}
                            className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-purple-600' : 'bg-gray-200'}`}
                        >
                            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : ''}`} />
                        </button>
                    </div>
                )}

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

                {/* Equipment Manager */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🏋️‍♂️</span>
                        <h3 className="font-medium text-gray-900">Home Equipment</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Select what you have at home for the AI Coach to suggest appropriate workouts.</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {targets.equipment.map(item => (
                            <div key={item} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm flex items-center gap-2 border border-blue-100">
                                {item}
                                <button
                                    onClick={() => setTargets({ ...targets, equipment: targets.equipment.filter(e => e !== item) })}
                                    className="text-blue-400 hover:text-blue-600"
                                >
                                    <span className="sr-only">Remove</span>x
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Add equipment (e.g. Dumbbells, Pull-up Bar)..."
                            className="flex-1 p-3 bg-gray-50 rounded-xl"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value.trim();
                                    if (val && !targets.equipment.includes(val)) {
                                        setTargets({ ...targets, equipment: [...targets.equipment, val] });
                                        e.currentTarget.value = '';
                                    }
                                }
                            }}
                        />
                        <button className="bg-gray-900 text-white px-4 rounded-xl font-bold" onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            const val = input.value.trim();
                            if (val && !targets.equipment.includes(val)) {
                                setTargets({ ...targets, equipment: [...targets.equipment, val] });
                                input.value = '';
                            }
                        }}>
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                        {['Dumbbells', 'Kettlebell', 'Pull-up Bar', 'Resistance Bands', 'Bench', 'Yoga Mat'].map(s => (
                            <button
                                key={s}
                                onClick={() => {
                                    if (!targets.equipment.includes(s)) {
                                        setTargets({ ...targets, equipment: [...targets.equipment, s] });
                                    }
                                }}
                                className="px-3 py-1 rounded-full border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 whitespace-nowrap"
                            >
                                + {s}
                            </button>
                        ))}
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

            {/* Trophy Case Section */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <TrophyCase earnedBadges={earnedBadges} />
            </section>

            {/* Help & Updates */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
                    <span className="text-xl">ℹ️</span>
                    <h2 className="font-bold text-lg">Help & Updates</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={() => window.location.href = '/?tutorial=true'}
                        className="p-4 bg-blue-50 text-blue-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                    >
                        <Sparkles className="w-5 h-5" /> Re-run Onboarding
                    </button>
                    <button
                        onClick={() => setShowChangelog(true)}
                        className="p-4 bg-purple-50 text-purple-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors"
                    >
                        <Rocket className="w-5 h-5" /> What's New?
                    </button>
                    <button
                        onClick={() => window.location.href = '/help'}
                        className="p-4 bg-green-50 text-green-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-100 transition-colors md:col-span-2"
                    >
                        <span className="text-xl">📚</span> User Manual
                    </button>
                </div>
            </section>

            <section className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <h3 className="font-bold text-gray-400 text-sm uppercase tracking-wide mb-4">About</h3>
                <p className="text-xs text-gray-500 mb-2">
                    Fitness Tracker v1.2 (AI Edition)<br />
                    Built with Next.js & Supabase
                </p>

                {/* PWA Diagnostics */}
                {typeof window !== 'undefined' && 'serviceWorker' in navigator && (
                    <PWADiagnostic />
                )}
            </section>

            <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
        </main >
    );
}
