'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings, getUserBadges, UserBadge, getAccountabilityPartners, addAccountabilityPartner, deleteAccountabilityPartner, AccountabilityPartner, getIntegrations, upsertIntegration, deleteIntegration, Integration, isAuthError } from '@/lib/api';
import { Loader2, Save, Target, Plus, Sparkles, Rocket, Wand2, Users, Trash2, Send, X, Link2, RefreshCw, User, Sun, Moon, Monitor, CalendarDays, Copy, Check, Bot, Flame, Dumbbell, Scale, Footprints, Settings as SettingsIcon, BookOpen, Watch, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { useSearchParams, useRouter } from 'next/navigation';
import { GoalWizard } from '@/components/GoalWizard';
import { LoadError, Button } from '@/components/ui';
import { SettingsSkeleton } from '@/components/Skeleton';
import { toast } from 'sonner';
import { TrophyCase } from '@/components/TrophyCase';
import { ChangelogModal } from '@/components/ChangelogModal';
import { NotificationSettings } from '@/components/NotificationSettings';
import { ClaudeConnectorSection } from '@/components/ClaudeConnectorSection';
import { PairDeviceSection } from '@/components/PairDeviceSection';
import { haptics } from '@/lib/haptics';

const sectionStyle = {
    background: 'var(--color-surface-elevated)',
    borderColor: 'var(--color-border-light)',
};

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
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
    const { t, lang, setLang } = useLanguage();
    const [profile, setProfile] = useState({
        displayName: '',
        dob: '',
        heightFt: '',
        heightIn: '',
        fitnessGoal: '',
        weightUnit: 'imperial' as 'imperial' | 'metric',
    });
    const [targets, setTargets] = useState({
        weight: '',
        protein: '',
        calories: '',
        enableCycle: false,
        streakType: 'any' as 'any' | 'workout' | 'nutrition',
        habits: [] as string[],
        equipment: [] as string[]
    });
    const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
    const [calendarToken, setCalendarToken] = useState<string | null>(null);
    const [calendarCopied, setCalendarCopied] = useState(false);

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
        setLoading(true);
        setLoadError(false);
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
                    weightUnit:   (data.weight_unit ?? 'imperial') as 'imperial' | 'metric',
                });
                // Targets
                setTargets({
                    weight: data.target_weight?.toString() || '',
                    protein: data.target_protein?.toString() || '',
                    calories: data.target_calories?.toString() || '',
                    enableCycle: data.enable_cycle_tracking ?? false,
                    streakType: (data.streak_type ?? 'any') as 'any' | 'workout' | 'nutrition',
                    habits: data.custom_habits || [],
                    equipment: data.available_equipment || []
                });
                // Calendar token
                if (data.calendar_token) setCalendarToken(data.calendar_token);
                // Auto-save timezone if it differs from what's stored
                const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (detectedTz && (!data.timezone || data.timezone === 'UTC')) {
                    try { await updateSettings({ timezone: detectedTz }); } catch { /* ignore */ }
                }
            }
        } catch (error) {
            console.error(error);
            if (!isAuthError(error)) setLoadError(true);
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
                streak_type: targets.streakType,
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

    const calendarUrl = calendarToken
        ? `https://fit.nathandavie.com/api/calendar/${calendarToken}`
        : null;
    const webcalUrl = calendarUrl?.replace('https://', 'webcal://') ?? null;

    async function copyCalendarUrl() {
        if (!calendarUrl) return;
        await navigator.clipboard.writeText(calendarUrl);
        setCalendarCopied(true);
        setTimeout(() => setCalendarCopied(false), 2000);
    }

    if (loading) return <SettingsSkeleton />;

    if (loadError) return (
        <main className="p-6 pt-12 max-w-2xl mx-auto">
            <LoadError onRetry={loadSettings} />
        </main>
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
                {t.settings.title}
            </h1>

            {/* My Profile */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-6" style={sectionStyle}>
                <div
                    className="flex items-center gap-2 pb-4"
                    style={{ borderBottom: '1px solid var(--color-border-light)' }}
                >
                    <div className="p-1.5 rounded-lg" style={{ background: 'rgba(77,137,226,0.1)' }}>
                        <User className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <h2
                        className="font-bold text-lg"
                        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                    >
                        {t.settings.profile.title}
                    </h2>
                </div>

                <div className="space-y-4">
                    {/* Display Name */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            {t.settings.profile.displayName}
                        </label>
                        <input
                            type="text"
                            placeholder={t.settings.profile.displayNamePlaceholder}
                            value={profile.displayName}
                            onChange={e => setProfile({ ...profile, displayName: e.target.value })}
                            maxLength={40}
                            className={inputClass}
                            style={inputStyle}
                        />
                    </div>

                    {/* Date of Birth */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            {t.settings.profile.dob}
                        </label>
                        <input
                            type="date"
                            value={profile.dob}
                            onChange={e => setProfile({ ...profile, dob: e.target.value })}
                            className={inputClass}
                            style={inputStyle}
                        />
                    </div>

                    {/* Height */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            {t.settings.profile.height}
                        </label>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    placeholder="5"
                                    value={profile.heightFt}
                                    onChange={e => setProfile({ ...profile, heightFt: e.target.value })}
                                    min={0} max={8}
                                    className={inputClass}
                                    style={inputStyle}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>ft</span>
                            </div>
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    placeholder="10"
                                    value={profile.heightIn}
                                    onChange={e => setProfile({ ...profile, heightIn: e.target.value })}
                                    min={0} max={11}
                                    className={inputClass}
                                    style={inputStyle}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>in</span>
                            </div>
                        </div>
                    </div>

                    {/* Fitness Goal */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            {t.settings.profile.fitnessGoal}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'lose_weight',     label: t.settings.profile.goals.loseWeight,     icon: Flame },
                                { id: 'build_muscle',    label: t.settings.profile.goals.buildMuscle,    icon: Dumbbell },
                                { id: 'maintain',        label: t.settings.profile.goals.maintain,        icon: Scale },
                                { id: 'improve_fitness', label: t.settings.profile.goals.improveFitness, icon: Footprints },
                            ].map(g => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => setProfile({ ...profile, fitnessGoal: g.id })}
                                    className="p-3 rounded-xl text-left transition-all"
                                    style={{
                                        background: profile.fitnessGoal === g.id ? 'var(--color-gold-muted)' : 'var(--color-bg-subtle)',
                                        border: `1.5px solid ${profile.fitnessGoal === g.id ? 'var(--color-gold)' : 'var(--color-border)'}`,
                                    }}
                                >
                                    <g.icon className="w-4 h-4 mr-1.5 inline-block align-text-bottom" style={{ color: profile.fitnessGoal === g.id ? 'var(--color-gold-text)' : 'var(--color-text-muted)' }} aria-hidden="true" />
                                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{g.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Weight Unit */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
                            {t.settings.profile.weightUnit}
                        </label>
                        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                            {(['imperial', 'metric'] as const).map(u => (
                                <button
                                    key={u}
                                    type="button"
                                    onClick={async () => {
                                        setProfile(p => ({ ...p, weightUnit: u }));
                                        localStorage.setItem('fitness_unit_pref', u);
                                        try { await updateSettings({ weight_unit: u }); } catch { /* ignore */ }
                                    }}
                                    className="flex-1 py-2.5 text-sm font-bold transition-all"
                                    style={
                                        profile.weightUnit === u
                                            ? { background: 'var(--color-navy)', color: 'var(--color-gold)' }
                                            : { background: 'transparent', color: 'var(--color-text-muted)' }
                                    }
                                >
                                    {u === 'imperial' ? 'lbs' : 'kg'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>{/* end space-y-4 */}

                <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {savingProfile ? <Loader2 className="animate-spin w-5 h-5" /> : <><Save className="w-4 h-4" /> {t.settings.profile.saveProfile}</>}
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
                        {t.settings.targets.title}
                    </h2>
                </div>

                <div className="space-y-4">
                    {[
                        { key: 'weight', label: t.settings.targets.goalWeight, placeholder: 'e.g. 175' },
                        { key: 'protein', label: t.settings.targets.dailyProtein, placeholder: 'e.g. 180' },
                        { key: 'calories', label: t.settings.targets.dailyCalories, placeholder: 'e.g. 2500' },
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
                                inputMode="numeric"
                                placeholder={placeholder}
                                value={targets[key as keyof typeof targets] as string}
                                onChange={e => setTargets({ ...targets, [key]: e.target.value })}
                                className={inputClass}
                                style={inputStyle}
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
                    <SettingsIcon className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
                    <h2
                        className="font-bold text-lg"
                        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                    >
                        {t.settings.customization.title}
                    </h2>
                </div>

                {/* Theme toggle */}
                <div>
                    <h3 className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>{t.settings.customization.appearance}</h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>{t.settings.customization.appearanceDesc}</p>
                    <div className="grid grid-cols-3 gap-2">
                        {([
                            { value: 'light',  label: t.settings.customization.themeLight,  Icon: Sun },
                            { value: 'system', label: t.settings.customization.themeSystem, Icon: Monitor },
                            { value: 'dark',   label: t.settings.customization.themeDark,   Icon: Moon },
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

                {/* Language Toggle */}
                <div>
                    <h3 className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>{t.settings.customization.language}</h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>{t.settings.customization.languageDesc}</p>
                    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                        {([
                            { value: 'en' as const, label: 'English' },
                            { value: 'fr' as const, label: 'Français' },
                        ]).map(({ value, label }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setLang(value)}
                                className="flex-1 py-2.5 text-sm font-bold transition-all"
                                style={
                                    lang === value
                                        ? { background: 'var(--color-navy)', color: 'var(--color-gold)' }
                                        : { background: 'transparent', color: 'var(--color-text-muted)' }
                                }
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Streak Type Selector */}
                <div>
                    <h3 className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>{t.settings.customization.streakCountsAs}</h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                        {t.settings.customization.streakDesc}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {([
                            { value: 'any',       label: t.settings.customization.streakOptions.any,       desc: t.settings.customization.streakOptions.anyDesc },
                            { value: 'workout',   label: t.settings.customization.streakOptions.workout,   desc: t.settings.customization.streakOptions.workoutDesc },
                            { value: 'nutrition', label: t.settings.customization.streakOptions.nutrition, desc: t.settings.customization.streakOptions.nutritionDesc },
                        ] as const).map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setTargets(t => ({ ...t, streakType: opt.value }))}
                                className="p-3 rounded-xl text-left transition-all"
                                style={{
                                    background: targets.streakType === opt.value ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                                    border: `1px solid ${targets.streakType === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                    color: targets.streakType === opt.value ? 'white' : 'var(--color-text)',
                                }}
                            >
                                <p className="font-bold text-sm">{opt.label}</p>
                                <p className="text-[11px] opacity-75 mt-0.5">{opt.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Cycle Tracking Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>{t.settings.customization.cycleTracking}</h3>
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            {t.settings.customization.cycleTrackingDesc}
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
                    <h3 className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>{t.settings.customization.myHabits}</h3>
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                        {t.settings.customization.myHabitsDesc}
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
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
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
                            placeholder={t.settings.customization.addHabitPlaceholder}
                            className="flex-1 p-3 rounded-xl outline-none transition-all"
                            style={inputStyle}
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
                            className="px-4 rounded-xl font-bold transition-all focus-ring tap-target"
                            style={{ background: 'var(--color-navy)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-border)' }}
                            aria-label="Add habit"
                            onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                const val = input.value.trim();
                                if (val && !targets.habits.includes(val)) {
                                    setTargets({ ...targets, habits: [...targets.habits, val] });
                                    input.value = '';
                                }
                            }}
                        >
                            <Plus className="w-5 h-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* Equipment Manager */}
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Dumbbell className="w-5 h-5" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                        <h3 className="font-medium" style={{ color: 'var(--color-text)' }}>{t.settings.customization.homeEquipment}</h3>
                    </div>
                    <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
                        {t.settings.customization.homeEquipmentDesc}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {targets.equipment.map(item => (
                            <div
                                key={item}
                                className="px-3 py-1 rounded-lg text-sm flex items-center gap-2 border"
                                style={{
                                    background: 'rgba(77,137,226,0.08)',
                                    color: 'var(--color-primary)',
                                    borderColor: 'rgba(77,137,226,0.2)',
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
                            placeholder={t.settings.customization.addEquipmentPlaceholder}
                            className="flex-1 p-3 rounded-xl outline-none transition-all"
                            style={inputStyle}
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
                            className="px-4 rounded-xl font-bold focus-ring tap-target"
                            style={{ background: 'var(--color-navy)', color: 'var(--color-gold)', border: '1px solid var(--color-gold-border)' }}
                            aria-label="Add equipment"
                            onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                const val = input.value.trim();
                                if (val && !targets.equipment.includes(val)) {
                                    setTargets({ ...targets, equipment: [...targets.equipment, val] });
                                    input.value = '';
                                }
                            }}
                        >
                            <Plus className="w-5 h-5" aria-hidden="true" />
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

                <Button
                    variant="brand"
                    fullWidth
                    onClick={handleSave}
                    disabled={saving}
                    className="py-4"
                >
                    {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <><Save className="w-4 h-4" /> {t.settings.customization.saveAll}</>}
                </Button>
            </section>

            {/* Goal Wizard */}
            <section className="p-5 rounded-2xl border shadow-sm" style={{ ...sectionStyle, background: 'var(--color-navy)', borderColor: 'var(--color-gold-border)' }}>
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: 'var(--color-gold-muted)' }}>
                        <Wand2 className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold" style={{ color: 'var(--color-gold)' }}>{t.settings.goals.setWithAI}</p>
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{t.settings.goals.setWithAIDesc}</p>
                    </div>
                    <button
                        onClick={() => setShowGoalWizard(true)}
                        className="px-4 py-2 rounded-xl font-bold text-sm flex-shrink-0 transition-all active:scale-95"
                        style={{ background: 'var(--color-gold)', color: 'var(--color-navy)' }}
                    >
                        {t.common.start}
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
                        {t.settings.help.title}
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                        onClick={() => window.location.href = '/?tutorial=true'}
                        className="p-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all"
                        style={{
                            background: 'rgba(77,137,226,0.06)',
                            color: 'var(--color-primary)',
                            borderColor: 'rgba(77,137,226,0.15)',
                        }}
                    >
                        <Sparkles className="w-5 h-5" /> {t.settings.help.rerunOnboarding}
                    </button>
                    <button
                        onClick={() => setShowChangelog(true)}
                        className="p-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all"
                        style={{
                            background: 'var(--color-gold-muted)',
                            color: 'var(--color-gold)',
                            borderColor: 'var(--color-gold-border)',
                        }}
                    >
                        <Rocket className="w-5 h-5" /> {t.settings.help.whatsNew}
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
                        <BookOpen className="w-5 h-5" aria-hidden="true" /> {t.settings.help.userManual}
                    </button>
                </div>
            </section>

            {/* Workout Calendar */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-4" style={sectionStyle}>
                <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                        {t.settings.calendar.title}
                    </h3>
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {t.settings.calendar.desc}
                </p>

                {calendarUrl ? (
                    <div className="space-y-3">
                        {/* webcal:// subscribe link */}
                        <a
                            href={webcalUrl ?? '#'}
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
                            style={{ background: 'var(--color-primary)', color: 'white' }}
                        >
                            <CalendarDays className="w-4 h-4" />
                            {t.settings.calendar.subscribe}
                        </a>

                        {/* Manual URL copy */}
                        <div className="flex gap-2">
                            <div
                                className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono truncate"
                                style={{
                                    background: 'var(--color-bg-subtle)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                {calendarUrl}
                            </div>
                            <button
                                onClick={copyCalendarUrl}
                                className="px-3 py-2.5 rounded-xl flex-shrink-0 transition-all"
                                style={{
                                    background: calendarCopied ? 'rgba(34,197,94,0.1)' : 'var(--color-bg-subtle)',
                                    border: `1px solid ${calendarCopied ? 'rgba(34,197,94,0.3)' : 'var(--color-border)'}`,
                                    color: calendarCopied ? 'var(--color-success)' : 'var(--color-text-muted)',
                                }}
                                title="Copy URL"
                            >
                                {calendarCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>

                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {t.settings.calendar.googleDesc}
                        </p>
                    </div>
                ) : (
                    <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
                        {t.settings.calendar.loadingLink}
                    </p>
                )}
            </section>

            {/* Health Integrations */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-4" style={sectionStyle}>
                <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                        {t.settings.integrations.title}
                    </h3>
                </div>

                {[
                    { id: 'strava',   name: 'Strava',     icon: Footprints, desc: t.settings.integrations.providers.strava,   authUrl: '/api/strava/auth',                 syncUrl: '/api/strava/sync' },
                    { id: 'withings', name: 'Withings',   icon: Scale,      desc: t.settings.integrations.providers.withings, authUrl: '/api/integrations/withings/auth',  syncUrl: '/api/integrations/withings/sync' },
                    { id: 'oura',     name: 'Oura Ring',  icon: Watch,      desc: t.settings.integrations.providers.oura,     authUrl: '/api/integrations/oura/auth',      syncUrl: '/api/integrations/oura/sync' },
                ].map(provider => {
                    const connected = integrations.find(i => i.provider === provider.id);
                    return (
                        <div key={provider.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-light)' }}>
                            <div className="flex items-center gap-3">
                                <provider.icon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                                <div>
                                    <p className="font-bold text-sm text-[var(--color-text)]">{provider.name}</p>
                                    <p className="text-xs" style={{ color: connected ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                        {connected ? t.settings.integrations.connected : provider.desc}
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
                                        style={{ color: 'var(--color-primary)', background: 'rgba(77,137,226,0.08)' }}
                                        title={t.settings.integrations.syncNow}
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
                                        style={{ color: 'var(--color-danger)', background: 'rgba(239,68,68,0.08)' }}
                                    >
                                        {t.settings.integrations.disconnect}
                                    </button>
                                ) : (
                                    <a
                                        href={provider.authUrl}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                        style={{ background: 'var(--color-primary)', color: 'white' }}
                                    >
                                        {t.settings.integrations.connect}
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </section>

            {/* Claude AI Connector */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-4" style={sectionStyle}>
                <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                        {t.settings.claude.title}
                    </h3>
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {t.settings.claude.desc}
                </p>
                <ClaudeConnectorSection />
            </section>

            {/* Pair a Device */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-4" style={sectionStyle}>
                <div className="flex items-center gap-2">
                    <Watch className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                        {t.settings.pairDevice.title}
                    </h3>
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {t.settings.pairDevice.desc}
                </p>
                <PairDeviceSection />
            </section>

            {/* Accountability Partners */}
            <section className="p-6 rounded-2xl border shadow-sm space-y-4" style={sectionStyle}>
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                        {t.settings.partners.title}
                    </h3>
                </div>
                {/* In-app workout partners */}
                <Link
                    href="/partner"
                    className="flex items-center justify-between p-3 rounded-xl transition-all hover:shadow-md"
                    style={{ background: 'var(--color-gold-muted)', border: '1px solid var(--color-gold-border)' }}
                >
                    <div>
                        <p className="font-bold text-sm" style={{ color: 'var(--color-gold-text)' }}>{t.partner.title}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.partner.subtitle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-gold-text)' }} />
                </Link>

                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {t.settings.partners.desc}
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
                                style={{ color: 'var(--color-primary)', background: 'rgba(77,137,226,0.08)' }}
                                title={t.settings.partners.sendSummaryTitle}
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
                                style={{ color: 'var(--color-danger)', background: 'rgba(239,68,68,0.08)' }}
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
                            placeholder={t.settings.partners.namePlaceholder}
                            value={newPartnerName}
                            onChange={e => setNewPartnerName(e.target.value)}
                            className="w-full p-3 rounded-xl outline-none text-sm"
                            style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                        />
                        <div className="flex gap-2">
                            <input
                                type="email"
                                placeholder={t.settings.partners.emailPlaceholder}
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
                    {t.settings.about.title}
                </h3>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {t.settings.about.version}<br />
                    {t.settings.about.builtWith}
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
