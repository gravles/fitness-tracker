'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings, getUserBadges, UserBadge } from '@/lib/api';
import { Loader2, Save, Target, Plus, Sparkles, Rocket, Wand2 } from 'lucide-react';
import { GoalWizard } from '@/components/GoalWizard';
import { toast } from 'sonner';
import { TrophyCase } from '@/components/TrophyCase';
import { StravaConnect } from '@/components/StravaConnect';
import { ChangelogModal } from '@/components/ChangelogModal';
import { NotificationSettings } from '@/components/NotificationSettings';
import { haptics } from '@/lib/haptics';

function PWADiagnostic() {
    const [status, setStatus] = useState<'checking' | 'active' | 'missing'>('checking');
    const [error, setError] = useState('');

    useEffect(() => { checkStatus(); }, []);

    function checkStatus() {
        navigator.serviceWorker.getRegistration().then(reg => {
            setStatus(reg ? 'active' : 'missing');
        });
    }

    function register() {
        setStatus('checking');
        navigator.serviceWorker.register('/sw.js')
            .then(() => { setTimeout(checkStatus, 500); })
            .catch(err => { setStatus('missing'); setError(err.message); });
    }

    return (
        <div
            className="mt-4 pt-4"
            style={{ borderTop: '1px solid var(--color-border)' }}
        >
            <h4
                className="font-bold text-xs uppercase tracking-widest mb-2"
                style={{ color: 'var(--color-text-muted)' }}
            >
                PWA Status
            </h4>
            <div className="text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>Service Worker:</span>
                    <span style={{ color: 'var(--color-success)' }}>Supported</span>
                </div>
                <div className="flex justify-between items-center">
                    <span style={{ color: 'var(--color-text-muted)' }}>Registration:</span>
                    <span style={{
                        color: status === 'active' ? 'var(--color-success)' : status === 'missing' ? '#ef4444' : 'var(--color-text-muted)'
                    }}>
                        {status === 'active' ? 'Active ✅' : status === 'missing' ? 'Missing ❌' : 'Checking...'}
                    </span>
                </div>
                {status === 'missing' && (
                    <div
                        className="p-3 rounded-lg border"
                        style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }}
                    >
                        <p className="mb-2" style={{ color: '#ef4444' }}>Worker not running.</p>
                        <button
                            onClick={register}
                            className="w-full py-2 font-bold rounded"
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                        >
                            Force Register
                        </button>
                        {error && <p className="mt-2 text-[10px]" style={{ color: '#ef4444' }}>{error}</p>}
                    </div>
                )}
                {status === 'active' && (
                    <div
                        className="p-2 rounded text-center text-xs"
                        style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' }}
                    >
                        Ready to Install!
                    </div>
                )}
            </div>
        </div>
    );
}

const sectionStyle = {
    background: 'var(--color-surface-elevated)',
    borderColor: 'var(--color-border-light)',
};

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);
    const [showGoalWizard, setShowGoalWizard] = useState(false);
    const [targets, setTargets] = useState({
        weight: '',
        protein: '',
        calories: '',
        enableCycle: false,
        habits: [] as string[],
        equipment: [] as string[]
    });
    const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);

    useEffect(() => { loadSettings(); }, []);

    async function loadSettings() {
        try {
            const [data, badges] = await Promise.all([getSettings(), getUserBadges()]);
            setEarnedBadges(badges);
            if (data) {
                setTargets({
                    weight: data.target_weight?.toString() || '',
                    protein: data.target_protein?.toString() || '',
                    calories: data.target_calories?.toString() || '',
                    enableCycle: data.enable_cycle_tracking ?? false,
                    habits: data.custom_habits || [],
                    equipment: data.available_equipment || []
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
                custom_habits: targets.habits,
                available_equipment: targets.equipment
            });
            toast.success('Settings saved!');
        } catch (error) {
            toast.error('Error saving settings');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return (
        <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin w-8 h-8" style={{ color: 'var(--color-primary)' }} />
        </div>
    );

    const inputClass = "w-full p-3 rounded-xl outline-none transition-all";
    const inputStyle = {
        background: 'var(--color-bg-subtle)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text)',
    };

    return (
        <main className="p-6 pt-12 pb-24 space-y-6 max-w-2xl mx-auto">
            <h1
                className="text-3xl font-bold"
                style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
            >
                Settings
            </h1>

            {/* My Targets */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-6" style={sectionStyle}>
                <div
                    className="flex items-center gap-2 pb-4"
                    style={{ borderBottom: '1px solid var(--color-border-light)' }}
                >
                    <div
                        className="p-1.5 rounded-lg"
                        style={{ background: 'var(--color-gold-muted)' }}
                    >
                        <Target className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
                    </div>
                    <h2
                        className="font-bold text-lg"
                        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                    >
                        My Targets
                    </h2>
                </div>

                <div className="space-y-4">
                    {[
                        { key: 'weight', label: 'Goal Weight (lbs)', placeholder: 'e.g. 175' },
                        { key: 'protein', label: 'Daily Protein (g)', placeholder: 'e.g. 180' },
                        { key: 'calories', label: 'Daily Calories (kcal)', placeholder: 'e.g. 2500' },
                    ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                            <label
                                className="block text-xs font-bold uppercase tracking-widest mb-1.5"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                {label}
                            </label>
                            <input
                                type="number"
                                placeholder={placeholder}
                                value={targets[key as keyof typeof targets] as string}
                                onChange={e => setTargets({ ...targets, [key]: e.target.value })}
                                className={inputClass}
                                style={inputStyle}
                                onFocus={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-gold)';
                                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)';
                                }}
                                onBlur={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            />
                        </div>
                    ))}
                </div>
            </section>

            {/* Integrations */}
            <StravaConnect />

            {/* Customization */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-6" style={sectionStyle}>
                <div
                    className="flex items-center gap-2 pb-4"
                    style={{ borderBottom: '1px solid var(--color-border-light)' }}
                >
                    <span className="text-xl">⚙️</span>
                    <h2
                        className="font-bold text-lg"
                        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                    >
                        Customization
                    </h2>
                </div>

                <NotificationSettings />

                {/* Cycle Tracking Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>Cycle Tracking</h3>
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            Show menstrual flow in daily logs
                        </p>
                    </div>
                    <button
                        onClick={() => setTargets({ ...targets, enableCycle: !targets.enableCycle })}
                        className="w-12 h-6 rounded-full transition-colors relative"
                        style={{
                            background: targets.enableCycle ? 'var(--color-gold)' : 'var(--color-bg-subtle)',
                            border: `1px solid ${targets.enableCycle ? 'var(--color-gold)' : 'var(--color-border)'}`,
                        }}
                    >
                        <div
                            className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                            style={{
                                left: '2px',
                                background: 'white',
                                transform: targets.enableCycle ? 'translateX(24px)' : 'translateX(0)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }}
                        />
                    </button>
                </div>

                {/* Habit Manager */}
                <div>
                    <h3 className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>My Habits</h3>
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                        Customize the habits you want to track daily.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {targets.habits.map(habit => (
                            <div
                                key={habit}
                                className="px-3 py-1 rounded-lg text-sm flex items-center gap-2"
                                style={{
                                    background: 'var(--color-bg-subtle)',
                                    color: 'var(--color-text)',
                                    border: '1px solid var(--color-border)',
                                }}
                            >
                                {habit}
                                <button
                                    onClick={() => setTargets({ ...targets, habits: targets.habits.filter(h => h !== habit) })}
                                    className="transition-colors"
                                    style={{ color: 'var(--color-text-muted)' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                                >
                                    <span className="sr-only">Remove</span>×
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Add new habit..."
                            className="flex-1 p-3 rounded-xl outline-none transition-all"
                            style={inputStyle}
                            onFocus={e => {
                                e.currentTarget.style.borderColor = 'var(--color-gold)';
                            }}
                            onBlur={e => {
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                            }}
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
                        <button
                            className="px-4 rounded-xl font-bold transition-all"
                            style={{ background: 'var(--color-navy)', color: 'var(--color-gold)' }}
                            onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                const val = input.value.trim();
                                if (val && !targets.habits.includes(val)) {
                                    setTargets({ ...targets, habits: [...targets.habits, val] });
                                    input.value = '';
                                }
                            }}
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Equipment Manager */}
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🏋️‍♂️</span>
                        <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>Home Equipment</h3>
                    </div>
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                        Select what you have at home for the AI Coach to suggest appropriate workouts.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {targets.equipment.map(item => (
                            <div
                                key={item}
                                className="px-3 py-1 rounded-lg text-sm flex items-center gap-2 border"
                                style={{
                                    background: 'rgba(29,95,168,0.08)',
                                    color: 'var(--color-primary)',
                                    borderColor: 'rgba(29,95,168,0.2)',
                                }}
                            >
                                {item}
                                <button
                                    onClick={() => setTargets({ ...targets, equipment: targets.equipment.filter(e => e !== item) })}
                                    className="transition-colors"
                                    style={{ color: 'var(--color-primary)' }}
                                >
                                    <span className="sr-only">Remove</span>×
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            placeholder="Add equipment (e.g. Dumbbells, Pull-up Bar)..."
                            className="flex-1 p-3 rounded-xl outline-none transition-all"
                            style={inputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
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
                        <button
                            className="px-4 rounded-xl font-bold"
                            style={{ background: 'var(--color-navy)', color: 'var(--color-gold)' }}
                            onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                const val = input.value.trim();
                                if (val && !targets.equipment.includes(val)) {
                                    setTargets({ ...targets, equipment: [...targets.equipment, val] });
                                    input.value = '';
                                }
                            }}
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                        {['Dumbbells', 'Barbell', 'Kettlebell', 'Pull-up Bar', 'Resistance Bands', 'Bench', 'Cable Machine', 'TRX', 'Medicine Ball', 'Battle Ropes', 'Yoga Mat'].map(s => (
                            <button
                                key={s}
                                onClick={() => {
                                    if (!targets.equipment.includes(s)) {
                                        setTargets({ ...targets, equipment: [...targets.equipment, s] });
                                    }
                                }}
                                className="px-3 py-1 rounded-full border text-xs font-bold whitespace-nowrap transition-all"
                                style={{
                                    borderColor: 'var(--color-border)',
                                    color: 'var(--color-text-muted)',
                                    background: 'transparent',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                                    e.currentTarget.style.color = 'var(--color-primary)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.color = 'var(--color-text-muted)';
                                }}
                            >
                                + {s}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                    style={{ background: 'var(--color-navy)', color: 'var(--color-gold)' }}
                >
                    {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <><Save className="w-4 h-4" /> Save All Settings</>}
                </button>
            </section>

            {/* Goal Wizard */}
            <section className="p-5 rounded-2xl border shadow-sm" style={{ ...sectionStyle, background: 'var(--color-navy)', borderColor: 'rgba(201,168,76,0.2)' }}>
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: 'rgba(201,168,76,0.15)' }}>
                        <Wand2 className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold" style={{ color: 'var(--color-gold)' }}>Set Goals with AI</p>
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Answer a few quick questions and get personalised targets</p>
                    </div>
                    <button
                        onClick={() => setShowGoalWizard(true)}
                        className="px-4 py-2 rounded-xl font-bold text-sm flex-shrink-0 transition-all active:scale-95"
                        style={{ background: 'var(--color-gold)', color: 'var(--color-navy)' }}
                    >
                        Start
                    </button>
                </div>
            </section>

            {/* Trophy Case */}
            <section className="p-6 rounded-2xl border shadow-sm" style={sectionStyle}>
                <TrophyCase earnedBadges={earnedBadges} />
            </section>

            {/* Help & Updates */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-4" style={sectionStyle}>
                <div
                    className="flex items-center gap-2 pb-4"
                    style={{ borderBottom: '1px solid var(--color-border-light)' }}
                >
                    <span className="text-xl">ℹ️</span>
                    <h2
                        className="font-bold text-lg"
                        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                    >
                        Help &amp; Updates
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                        onClick={() => window.location.href = '/?tutorial=true'}
                        className="p-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all"
                        style={{
                            background: 'rgba(29,95,168,0.06)',
                            color: 'var(--color-primary)',
                            borderColor: 'rgba(29,95,168,0.15)',
                        }}
                    >
                        <Sparkles className="w-5 h-5" /> Re-run Onboarding
                    </button>
                    <button
                        onClick={() => setShowChangelog(true)}
                        className="p-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all"
                        style={{
                            background: 'var(--color-gold-muted)',
                            color: 'var(--color-gold)',
                            borderColor: 'rgba(201,168,76,0.2)',
                        }}
                    >
                        <Rocket className="w-5 h-5" /> What&apos;s New?
                    </button>
                    <button
                        onClick={() => window.location.href = '/help'}
                        className="p-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all sm:col-span-2"
                        style={{
                            background: 'rgba(34,197,94,0.06)',
                            color: 'var(--color-success)',
                            borderColor: 'rgba(34,197,94,0.15)',
                        }}
                    >
                        <span className="text-xl">📚</span> User Manual
                    </button>
                </div>
            </section>

            {/* About */}
            <section
                className="p-6 rounded-2xl border"
                style={{
                    background: 'var(--color-bg-subtle)',
                    borderColor: 'var(--color-border)',
                }}
            >
                <h3
                    className="font-bold text-xs uppercase tracking-widest mb-4"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    About
                </h3>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Fitness Tracker v1.2 (AI Edition)<br />
                    Built with Next.js &amp; Supabase
                </p>

                {typeof window !== 'undefined' && 'serviceWorker' in navigator && (
                    <PWADiagnostic />
                )}
            </section>

            <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
            <GoalWizard
                isOpen={showGoalWizard}
                onClose={() => setShowGoalWizard(false)}
                onComplete={() => { setShowGoalWizard(false); loadSettings(); }}
            />
        </main>
    );
}
