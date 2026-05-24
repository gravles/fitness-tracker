'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings, getUserBadges, UserBadge, getAccountabilityPartners, addAccountabilityPartner, deleteAccountabilityPartner, AccountabilityPartner, getIntegrations, upsertIntegration, deleteIntegration, Integration } from '@/lib/api';
import { Loader2, Save, Target, Plus, Sparkles, Rocket, Wand2, Users, Trash2, Send, X, Link2, RefreshCw, User, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useSearchParams, useRouter } from 'next/navigation';
import { GoalWizard } from '@/components/GoalWizard';
import { toast } from 'sonner';
import { TrophyCase } from '@/components/TrophyCase';
import { ChangelogModal } from '@/components/ChangelogModal';
import { NotificationSettings } from '@/components/NotificationSettings';
import { haptics } from '@/lib/haptics';

const sectionStyle = {
    background: 'var(--color-surface-elevated)',
    borderColor: 'var(--color-border-light)',
};

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);
    const [showGoalWizard, setShowGoalWizard] = useState(false);
    const [partners, setPartners] = useState<AccountabilityPartner[]>([]);
    const [newPartnerEmail, setNewPartnerEmail] = useState('');
    const [newPartnerName, setNewPartnerName] = useState('');
    const [addingPartner, setAddingPartner] = useState(false);
    const [sendingSummary, setSendingSummary] = useState<string | null>(null);
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [syncingIntegration, setSyncingIntegration] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [profile, setProfile] = useState({
        displayName: '',
        dob: '',
        heightFt: '',
        heightIn: '',
        fitnessGoal: '',
    });
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

    // Handle OAuth callbacks from Withings / Oura
    useEffect(() => {
        const connected = searchParams.get('connected');
        if (!connected) return;

        async function handleOAuthCallback() {
            const { supabase: sb } = await import('@/lib/supabase');

            if (connected === 'withings') {
                const accessToken = searchParams.get('withings_access');
                const refreshToken = searchParams.get('withings_refresh');
                const expiresAt = searchParams.get('withings_expires');
                const providerUserId = searchParams.get('withings_user');
                if (accessToken) {
                    await upsertIntegration('withings', { access_token: accessToken, refresh_token: refreshToken, token_expires_at: expiresAt ? new Date(Number(expiresAt)).toISOString() : null, provider_user_id: providerUserId });
                    toast.success('Withings connected!');
                    setIntegrations(await getIntegrations());
                }
            }
            if (connected === 'oura') {
                const accessToken = searchParams.get('oura_access');
                const refreshToken = searchParams.get('oura_refresh');
                const expiresAt = searchParams.get('oura_expires');
                if (accessToken) {
                    await upsertIntegration('oura', { access_token: accessToken, refresh_token: refreshToken || null, token_expires_at: expiresAt ? new Date(Number(expiresAt)).toISOString() : null });
                    toast.success('Oura connected!');
                    setIntegrations(await getIntegrations());
                }
            }

            const error = searchParams.get('error');
            if (error) toast.error(`Connection failed: ${error.replace(/_/g, ' ')}`);

            // Clean URL
            router.replace('/settings');
        }

        // Strava uses a different callback — /settings/strava-callback redirects here with ?strava_connected=true
        const stravaConnected = searchParams.get('strava_connected');
        if (stravaConnected === 'true') {
            async function handleStravaConnected() {
                toast.success('Strava connected!');
                setIntegrations(await getIntegrations());
                router.replace('/settings');
            }
            handleStravaConnected();
        }

        handleOAuthCallback();
    }, [searchParams]);

    async function loadSettings() {
        try {
            const [data, badges, partnerList, integrationList] = await Promise.all([getSettings(), getUserBadges(), getAccountabilityPartners(), getIntegrations()]);
            setPartners(partnerList);
            setIntegrations(integrationList);
            setEarnedBadges(badges);
            if (data) {
                // Profile
                const heightCm = data.height_cm ?? 0;
                const totalIn  = Math.round(heightCm / 2.54);
                const ft       = Math.floor(totalIn / 12);
                const inches   = totalIn % 12;
                setProfile({
                    displayName:  data.display_name ?? '',
                    dob:          data.date_of_birth ?? '',
                    heightFt:     ft > 0 ? String(ft) : '',
                    heightIn:     inches > 0 ? String(inches) : '',
                    fitnessGoal:  data.fitness_goal ?? '',
                });
                // Targets
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

    function cmFromFtIn(ft: string, inches: string) {
        const f = parseFloat(ft) || 0;
        const i = parseFloat(inches) || 0;
        const cm = Math.round(f * 30.48 + i * 2.54);
        return cm > 0 ? cm : null;
    }

    async function handleSaveProfile() {
        setSavingProfile(true);
        haptics.tap();
        try {
            await updateSettings({
                display_name:  profile.displayName.trim() || null,
                date_of_birth: profile.dob || null,
                height_cm:     cmFromFtIn(profile.heightFt, profile.heightIn),
                fitness_goal:  profile.fitnessGoal || null,
            });
            toast.success('Profile saved!');
        } catch {
            toast.error('Error saving profile');
        } finally {
            setSavingProfile(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            await updateSettings({
                display_name:  profile.displayName.trim() || null,
                date_of_birth: profile.dob || null,
                height_cm:     cmFromFtIn(profile.heightFt, profile.heightIn),
                fitness_goal:  profile.fitnessGoal || null,
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

            {/* My Profile */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-6" style={sectionStyle}>
                <div
                    className="flex items-center gap-2 pb-4"
                    style={{ borderBottom: '1px solid var(--color-border-light)' }}
                >
                    <div className="p-1.5 rounded-lg" style={{ background: 'rgba(29,95,168,0.1)' }}>
                        <User className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <h2
                        className="font-bold text-lg"
                        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                    >
                        My Profile
                    </h2>
                </div>

                <div className="space-y-4">
                    {/* Display Name */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            Display Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Nathan"
                            value={profile.displayName}
                            onChange={e => setProfile({ ...profile, displayName: e.target.value })}
                            maxLength={40}
                            className={inputClass}
                            style={inputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    {/* Date of Birth */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            Date of Birth
                        </label>
                        <input
                            type="date"
                            value={profile.dob}
                            onChange={e => setProfile({ ...profile, dob: e.target.value })}
                            className={inputClass}
                            style={inputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                    </div>

                    {/* Height */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            Height
                        </label>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    placeholder="5"
                                    value={profile.heightFt}
                                    onChange={e => setProfile({ ...profile, heightFt: e.target.value })}
                                    min={0} max={8}
                                    className={inputClass}
                                    style={inputStyle}
                                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)'; }}
                                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>ft</span>
                            </div>
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    placeholder="10"
                                    value={profile.heightIn}
                                    onChange={e => setProfile({ ...profile, heightIn: e.target.value })}
                                    min={0} max={11}
                                    className={inputClass}
                                    style={inputStyle}
                                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.15)'; }}
                                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>in</span>
                            </div>
                        </div>
                    </div>

                    {/* Fitness Goal */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            Fitness Goal
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'lose_weight',     label: 'Lose Weight',     emoji: '🔥' },
                                { id: 'build_muscle',    label: 'Build Muscle',    emoji: '💪' },
                                { id: 'maintain',        label: 'Maintain',        emoji: '⚖️'  },
                                { id: 'improve_fitness', label: 'Improve Fitness', emoji: '🏃' },
                            ].map(g => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => setProfile({ ...profile, fitnessGoal: g.id })}
                                    className="p-3 rounded-xl text-left transition-all"
                                    style={{
                                        background: profile.fitnessGoal === g.id ? 'rgba(201,168,76,0.12)' : 'var(--color-bg-subtle)',
                                        border: `1.5px solid ${profile.fitnessGoal === g.id ? 'var(--color-gold)' : 'var(--color-border)'}`,
                                    }}
                                >
                                    <span className="mr-1.5">{g.emoji}</span>
                                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{g.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {savingProfile ? <Loader2 className="animate-spin w-5 h-5" /> : <><Save className="w-4 h-4" /> Save Profile</>}
                </button>
            </section>

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

                {/* Theme toggle */}
                <div>
                    <h3 className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>Appearance</h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>Choose light, dark, or follow your device setting.</p>
                    <div className="grid grid-cols-3 gap-2">
                        {([
                            { value: 'light',  label: 'Light',  Icon: Sun },
                            { value: 'system', label: 'System', Icon: Monitor },
                            { value: 'dark',   label: 'Dark',   Icon: Moon },
                        ] as const).map(({ value, label, Icon }) => (
                            <button
                                key={value}
                                onClick={() => setTheme(value)}
                                className="flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all"
                                style={{
                                    background: theme === value ? 'var(--color-navy)' : 'var(--color-bg-subtle)',
                                    borderColor: theme === value ? 'var(--color-gold)' : 'var(--color-border)',
                                    color: theme === value ? 'var(--color-gold)' : 'var(--color-text-muted)',
                                }}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="text-xs font-bold">{label}</span>
                            </button>
                        ))}
                    </div>
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

            {/* Health Integrations */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-4" style={sectionStyle}>
                <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                        Health Integrations
                    </h3>
                </div>

                {[
                    { id: 'strava',   name: 'Strava',     icon: '🏃', desc: 'Auto-sync runs, rides & workouts',       authUrl: '/api/strava/auth',                 syncUrl: '/api/strava/sync' },
                    { id: 'withings', name: 'Withings',   icon: '⚖️', desc: 'Auto-sync weight from your smart scale', authUrl: '/api/integrations/withings/auth',  syncUrl: '/api/integrations/withings/sync' },
                    { id: 'oura',     name: 'Oura Ring',  icon: '💍', desc: 'Sync readiness score, sleep & HRV',      authUrl: '/api/integrations/oura/auth',      syncUrl: '/api/integrations/oura/sync' },
                ].map(provider => {
                    const connected = integrations.find(i => i.provider === provider.id);
                    return (
                        <div key={provider.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-light)' }}>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{provider.icon}</span>
                                <div>
                                    <p className="font-bold text-sm text-[var(--color-text)]">{provider.name}</p>
                                    <p className="text-xs" style={{ color: connected ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                        {connected ? '● Connected' : provider.desc}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {connected && (
                                    <button
                                        disabled={syncingIntegration === provider.id}
                                        onClick={async () => {
                                            setSyncingIntegration(provider.id);
                                            try {
                                                const { supabase: sb } = await import('@/lib/supabase');
                                                const { data: { session } } = await sb.auth.getSession();
                                                const res = await fetch(provider.syncUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${session?.access_token}` } });
                                                const data = await res.json();
                                                if (data.success) toast.success(`Synced ${data.synced ?? ''} entries`);
                                                else toast.error(data.error || 'Sync failed');
                                            } finally { setSyncingIntegration(null); }
                                        }}
                                        className="p-2 rounded-lg transition-all"
                                        style={{ color: 'var(--color-primary)', background: 'rgba(29,95,168,0.08)' }}
                                        title="Sync now"
                                    >
                                        {syncingIntegration === provider.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    </button>
                                )}
                                {connected ? (
                                    <button
                                        onClick={async () => {
                                            await deleteIntegration(provider.id);
                                            setIntegrations(prev => prev.filter(i => i.provider !== provider.id));
                                            toast.success(`${provider.name} disconnected`);
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                        style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                                    >
                                        Disconnect
                                    </button>
                                ) : (
                                    <a
                                        href={provider.authUrl}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                        style={{ background: 'var(--color-primary)', color: 'white' }}
                                    >
                                        Connect
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </section>

            {/* Accountability Partners */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-4" style={sectionStyle}>
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                        Accountability Partners
                    </h3>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Add up to 3 people to receive a weekly summary of your progress.
                </p>

                {/* Existing partners */}
                {partners.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-light)' }}>
                        <div>
                            <p className="font-bold text-sm text-[var(--color-text)]">{p.partner_name || p.partner_email}</p>
                            {p.partner_name && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{p.partner_email}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={sendingSummary === p.id}
                                onClick={async () => {
                                    setSendingSummary(p.id);
                                    try {
                                        const { supabase: sb } = await import('@/lib/supabase');
                                        const { data: { session } } = await sb.auth.getSession();
                                        const res = await fetch('/api/accountability/send-summary', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ partnerId: p.id }) });
                                        if (res.ok) toast.success(`Summary sent to ${p.partner_email}!`);
                                        else toast.error('Failed to send — check email settings.');
                                    } finally { setSendingSummary(null); }
                                }}
                                className="p-2 rounded-lg transition-all"
                                style={{ color: 'var(--color-primary)', background: 'rgba(29,95,168,0.08)' }}
                                title="Send weekly summary now"
                            >
                                {sendingSummary === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={async () => {
                                    await deleteAccountabilityPartner(p.id);
                                    setPartners(prev => prev.filter(x => x.id !== p.id));
                                    toast.success('Partner removed');
                                }}
                                className="p-2 rounded-lg transition-all"
                                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add partner form */}
                {partners.length < 3 && (
                    <div className="space-y-2">
                        <input
                            type="text"
                            placeholder="Partner's name (optional)"
                            value={newPartnerName}
                            onChange={e => setNewPartnerName(e.target.value)}
                            className="w-full p-3 rounded-xl outline-none text-sm"
                            style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                        />
                        <div className="flex gap-2">
                            <input
                                type="email"
                                placeholder="their@email.com"
                                value={newPartnerEmail}
                                onChange={e => setNewPartnerEmail(e.target.value)}
                                className="flex-1 p-3 rounded-xl outline-none text-sm"
                                style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                onKeyDown={e => e.key === 'Enter' && newPartnerEmail && document.getElementById('add-partner-btn')?.click()}
                            />
                            <button
                                id="add-partner-btn"
                                disabled={!newPartnerEmail.includes('@') || addingPartner}
                                onClick={async () => {
                                    setAddingPartner(true);
                                    try {
                                        const p = await addAccountabilityPartner(newPartnerEmail, newPartnerName || undefined);
                                        setPartners(prev => [...prev, p]);
                                        setNewPartnerEmail('');
                                        setNewPartnerName('');
                                        toast.success('Partner added!');
                                    } catch (e: any) {
                                        toast.error(e.message?.includes('duplicate') ? 'Already added' : 'Failed to add');
                                    } finally { setAddingPartner(false); }
                                }}
                                className="px-4 py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition-all"
                                style={{ background: 'var(--color-primary)', color: 'white' }}
                            >
                                {addingPartner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                )}
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
