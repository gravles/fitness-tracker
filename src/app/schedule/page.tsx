'use client';

import { isAuthError } from '@/lib/api';

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { format, addDays, startOfWeek, eachDayOfInterval, isToday } from 'date-fns';
import {
    ChevronLeft, ChevronRight, Plus, Calendar, Clock, Dumbbell, Play, X, Trash2,
    Loader2, LayoutGrid, Edit2, Sparkles, Star, MoreVertical, Copy, Check, Eye, Zap, Bot, Trophy, RefreshCw, Share2,
    Activity, Wind, Footprints, Flame, PersonStanding, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { confirm } from '@/components/ConfirmDialog';
import { LoadError, Modal } from '@/components/ui';
import { getScheduledWorkouts, deleteScheduledWorkout, skipScheduledWorkout, updateScheduledWorkout, ScheduledWorkout } from '@/lib/schedule-api';
import { getProgramSessionsForRange, skipProgramSession, updateProgramSession, ProgramSession, SessionType } from '@/lib/program-api';
import { getTemplates, createTemplate, deleteTemplate, updateTemplate, WorkoutTemplate } from '@/lib/workout-api';
import { getPublicTemplates, WorkoutTemplate as PublicTemplate, WorkoutCategory } from '@/lib/features';
import { ShareToPartnerSheet } from '@/components/ShareToPartnerSheet';
import { ScheduleWorkoutModal } from '@/components/ScheduleWorkoutModal';
import { useRouter } from 'next/navigation';
import { useTabParam } from '@/lib/useTabParam';
import Link from 'next/link';
import { haptics } from '@/lib/haptics';
import { useLanguage } from '@/components/LanguageProvider';

type Tab = 'schedule' | 'templates' | 'discover' | 'programs';
type WorkoutCategoryFilter = WorkoutCategory | 'all';

const CATEGORIES: { value: WorkoutCategoryFilter; label: string; icon: LucideIcon }[] = [
    { value: 'all', label: 'All', icon: LayoutGrid },
    { value: 'strength', label: 'Strength', icon: Dumbbell },
    { value: 'cardio', label: 'Cardio', icon: Footprints },
    { value: 'hiit', label: 'HIIT', icon: Flame },
    { value: 'flexibility', label: 'Flexibility', icon: PersonStanding },
];

const COMMON_EXERCISES = [
    'Bench Press', 'Incline Bench Press', 'Dumbbell Press', 'Push-ups',
    'Squat', 'Deadlift', 'Leg Press', 'Lunges', 'Romanian Deadlift',
    'Pull-ups', 'Lat Pulldown', 'Rows', 'Bent Over Row', 'Cable Row',
    'Shoulder Press', 'Lateral Raise', 'Front Raise', 'Face Pulls',
    'Bicep Curl', 'Hammer Curl', 'Tricep Extension', 'Tricep Pushdown',
    'Plank', 'Crunches', 'Mountain Climbers', 'Russian Twists',
    'Burpees', 'Box Jumps', 'Kettlebell Swings', 'Battle Ropes',
    'Running', 'Cycling', 'Rowing', 'Jump Rope', 'Stair Climber',
    'Hip Thrusts', 'Calf Raises', 'Leg Curl', 'Leg Extension',
];

interface ExerciseItem { name: string; sets: number; reps: string; }
interface AIRecommendation { title: string; exercises: { name: string; sets: number; reps: string }[]; reason: string; }

export default function WorkoutHubPage() {
    const { lang } = useLanguage();
    const router = useRouter();
    const [activeTab, setActiveTab] = useTabParam<Tab>(['schedule', 'templates', 'discover', 'programs'], 'schedule');
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
    const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkout[]>([]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [publicTemplates, setPublicTemplates] = useState<PublicTemplate[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<WorkoutCategoryFilter>('all');
    const [showEditorModal, setShowEditorModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formExercises, setFormExercises] = useState<ExerciseItem[]>([]);
    const [exerciseInput, setExerciseInput] = useState('');
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<WorkoutTemplate | PublicTemplate | null>(null);
    const [shareTemplate, setShareTemplate] = useState<WorkoutTemplate | null>(null);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteResults, setAutocompleteResults] = useState<string[]>([]);
    const autocompleteRef = useRef<HTMLDivElement>(null);
    const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [syncingStrava, setSyncingStrava] = useState(false);
    const [programSessions, setProgramSessions]         = useState<ProgramSession[]>([]);
    const [skipConfirmSession, setSkipConfirmSession]   = useState<ProgramSession | null>(null);
    const [reschedulingSession, setReschedulingSession] = useState<ProgramSession | null>(null);
    const [rescheduleDate, setRescheduleDate]           = useState('');
    const [rescheduleTime, setRescheduleTime]           = useState('12:00');

    // Edit ad-hoc workout
    const [editingWorkout, setEditingWorkout]           = useState<ScheduledWorkout | null>(null);
    const [editTitle, setEditTitle]                     = useState('');
    const [editDate, setEditDate]                       = useState('');
    const [editTime, setEditTime]                       = useState('');
    const [editNotes, setEditNotes]                     = useState('');
    const [editRemind, setEditRemind]                   = useState(15);
    const [editDuration, setEditDuration]               = useState(60);
    const [editSaving, setEditSaving]                   = useState(false);

    const weekDays = eachDayOfInterval({ start: currentWeekStart, end: addDays(currentWeekStart, 6) });

    useEffect(() => { loadData(); }, [currentWeekStart, categoryFilter, activeTab]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
                setShowAutocomplete(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (exerciseInput.trim().length > 0) {
            const filtered = COMMON_EXERCISES.filter(ex => ex.toLowerCase().includes(exerciseInput.toLowerCase())).slice(0, 6);
            setAutocompleteResults(filtered);
            setShowAutocomplete(filtered.length > 0);
        } else {
            setShowAutocomplete(false);
        }
    }, [exerciseInput]);

    async function loadData() {
        setLoading(true);
        setLoadError(false);
        try {
            const startStr = format(currentWeekStart, 'yyyy-MM-dd');
            const endStr = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
            const [workouts, templateData, publicData, sessions] = await Promise.all([
                getScheduledWorkouts(startStr, endStr),
                getTemplates(),
                activeTab === 'discover' ? getPublicTemplates(categoryFilter === 'all' ? undefined : categoryFilter) : Promise.resolve([]),
                getProgramSessionsForRange(startStr, endStr),
            ]);
            setScheduledWorkouts(workouts);
            setTemplates(templateData);
            setProgramSessions(sessions);
            if (activeTab === 'discover') setPublicTemplates(publicData);
        } catch (error) {
            console.error('Error loading data:', error);
            if (!isAuthError(error)) setLoadError(true);
        } finally {
            setLoading(false);
        }
    }

    async function loadAIRecommendations() {
        setAiLoading(true); setAiError(null);
        try {
            const res = await fetch('/api/ai/recommend-workout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang }) });
            if (!res.ok) throw new Error('Failed to get recommendations');
            const data = await res.json();
            setAiRecommendations(data.recommendations || []);
        } catch (error) {
            setAiError('Unable to load recommendations');
        } finally {
            setAiLoading(false);
        }
    }

    function getWorkoutsForDay(day: Date) {
        return scheduledWorkouts.filter(w => w.scheduled_date === format(day, 'yyyy-MM-dd'));
    }

    function getProgramSessionsForDay(day: Date) {
        return programSessions.filter(s => s.scheduled_date === format(day, 'yyyy-MM-dd'));
    }

    // Visual accent colours for each session type
    function sessionAccent(type: SessionType): { color: string; bgAlpha: string; iconBg: string } {
        switch (type) {
            case 'cardio':   return { color: 'var(--chart-5)', bgAlpha: 'rgba(249,115,22,0.06)',  iconBg: 'rgba(249,115,22,0.12)' };
            case 'mobility': return { color: 'var(--chart-3)', bgAlpha: 'rgba(168,85,247,0.06)', iconBg: 'rgba(168,85,247,0.12)' };
            default:         return { color: 'var(--color-primary)', bgAlpha: 'rgba(77,137,226,0.06)', iconBg: 'rgba(77,137,226,0.12)' };
        }
    }

    function SessionTypeIcon({ type, className, style }: { type: SessionType; className?: string; style?: CSSProperties }) {
        if (type === 'cardio')   return <Activity className={className} style={style} />;
        if (type === 'mobility') return <Wind     className={className} style={style} />;
        return <Dumbbell className={className} style={style} />;
    }

    async function handleSkipProgramSession(session: ProgramSession, cascade: boolean) {
        haptics.tap();
        try {
            await skipProgramSession(session.id, cascade);
            setProgramSessions(prev => prev.map(s =>
                s.id === session.id ? { ...s, status: 'skipped' as const } : s
            ));
            setSkipConfirmSession(null);
            if (cascade) {
                await loadData();
                toast.success('Session skipped — future sessions shifted +1 day');
            }
        } catch {
            toast.error('Could not skip session');
        }
    }

    function openEditWorkout(w: ScheduledWorkout) {
        setEditingWorkout(w);
        setEditTitle(w.title);
        setEditDate(w.scheduled_date);
        setEditTime(w.scheduled_time.slice(0, 5));
        setEditNotes(w.notes ?? '');
        setEditRemind(w.remind_minutes ?? 15);
        setEditDuration(w.duration_minutes ?? 60);
    }

    function closeEditWorkout() {
        setEditingWorkout(null);
    }

    async function handleSaveEdit() {
        if (!editingWorkout || !editTitle.trim()) return;
        setEditSaving(true);
        haptics.tap();
        try {
            await updateScheduledWorkout(editingWorkout.id, {
                date: editDate,
                time: editTime + ':00',
                title: editTitle.trim(),
                notes: editNotes.trim() || undefined,
                remindMinutes: editRemind,
                durationMinutes: editDuration,
            });
            closeEditWorkout();
            await loadData();
            toast.success('Workout updated');
        } catch {
            toast.error('Could not update workout');
        } finally {
            setEditSaving(false);
        }
    }

    async function handleRescheduleSession(session: ProgramSession) {
        if (!rescheduleDate) return;
        haptics.tap();
        try {
            await updateProgramSession(session.id, {
                scheduled_date: rescheduleDate,
                scheduled_time: rescheduleTime + ':00',
                status: 'rescheduled',
            });
            setReschedulingSession(null);
            setRescheduleDate('');
            setRescheduleTime('12:00');
            await loadData();
            toast.success('Session rescheduled');
        } catch {
            toast.error('Could not reschedule session');
        }
    }

    function handleStartProgramSession(session: ProgramSession) {
        haptics.success();
        // Phase 5: pre-load exercises into logger; for now launch empty workout with session ID
        router.push(`/workout/active/new?programSession=${session.id}`);
    }

    function handlePrevWeek() { haptics.tap(); setCurrentWeekStart(addDays(currentWeekStart, -7)); }
    function handleNextWeek() { haptics.tap(); setCurrentWeekStart(addDays(currentWeekStart, 7)); }
    function handleDayClick(day: Date) { haptics.tap(); setSelectedDate(day); setShowScheduleModal(true); }

    async function handleDeleteScheduled(id: string) {
        if (!await confirm({ title: 'Delete Workout', message: 'Delete this scheduled workout?', danger: true })) return;
        haptics.tap();
        try {
            await deleteScheduledWorkout(id);
            setScheduledWorkouts(prev => prev.filter(w => w.id !== id));
        } catch (error) { console.error(error); }
    }

    async function handleSkip(id: string) {
        haptics.tap();
        try {
            await skipScheduledWorkout(id);
            setScheduledWorkouts(prev => prev.map(w => w.id === id ? { ...w, status: 'skipped' as const } : w));
        } catch (error) { console.error(error); }
    }

    function handleStartWorkout(workout: ScheduledWorkout) {
        haptics.success();
        if (workout.template_id) router.push(`/workout/active/new?template=${workout.template_id}&schedule=${workout.id}`);
        else router.push(`/workout/active/new?schedule=${workout.id}`);
    }

    function openCreateModal() {
        setEditingTemplate(null); setFormTitle(''); setFormExercises([]); setShowEditorModal(true);
    }

    function openEditModal(template: WorkoutTemplate) {
        setEditingTemplate(template);
        setFormTitle(template.name);
        setFormExercises((template.exercises || []).map((e: any) => ({
            name: e.name || e.exercise_name || '',
            sets: e.sets || e.target_sets || 3,
            reps: e.reps || e.target_reps || '10'
        })));
        setShowEditorModal(true);
        setMenuOpen(null);
    }

    async function handleDuplicateTemplate(template: WorkoutTemplate) {
        haptics.tap();
        try {
            await createTemplate(`${template.name} (Copy)`, (template.exercises || []).map((e: any) => ({
                exercise_name: e.name || e.exercise_name || '',
                target_sets: e.sets || e.target_sets || 3,
                target_reps: e.reps || e.target_reps || '10',
                order_index: 0
            })));
            loadData(); setMenuOpen(null); haptics.success();
        } catch (error) { haptics.error(); }
    }

    async function handleSaveTemplate() {
        if (!formTitle.trim()) return;
        haptics.tap(); setSaving(true);
        try {
            const exercisesData = formExercises.map(e => ({ exercise_name: e.name, target_sets: e.sets, target_reps: e.reps, order_index: 0 }));
            if (editingTemplate) await updateTemplate(editingTemplate.id, { name: formTitle, exercises: formExercises });
            else await createTemplate(formTitle, exercisesData);
            setShowEditorModal(false); setEditingTemplate(null); loadData(); haptics.success();
        } catch { toast.error('Failed to save template'); haptics.error(); } finally { setSaving(false); }
    }

    async function handleDeleteTemplate(id: string) {
        if (!await confirm({ title: 'Delete Template', message: 'Delete this template?', danger: true })) return;
        haptics.tap();
        try { await deleteTemplate(id); setTemplates(prev => prev.filter(t => t.id !== id)); setMenuOpen(null); }
        catch (error) { console.error(error); }
    }

    function addExercise(name?: string) {
        const exerciseName = name || exerciseInput.trim();
        if (!exerciseName) return;
        setFormExercises([...formExercises, { name: exerciseName, sets: 3, reps: '10' }]);
        setExerciseInput(''); setShowAutocomplete(false);
    }
    function removeExercise(index: number) { setFormExercises(formExercises.filter((_, i) => i !== index)); }

    async function handleCopyTemplate(template: PublicTemplate) {
        haptics.tap();
        try {
            await createTemplate(template.name, (template.exercises || []).map((e: any) => ({
                exercise_name: e.name || e.exercise_name || '',
                target_sets: e.sets || e.target_sets || 3,
                target_reps: e.reps || e.target_reps || '10',
                order_index: 0
            })));
            setCopiedId(template.id);
            setTimeout(() => setCopiedId(null), 2000);
            haptics.success();
        } catch { haptics.error(); }
    }

    async function handleSaveAIRecommendation(rec: AIRecommendation) {
        haptics.tap();
        try {
            await createTemplate(rec.title, rec.exercises.map(e => ({ exercise_name: e.name, target_sets: e.sets, target_reps: e.reps, order_index: 0 })));
            haptics.success(); setActiveTab('templates'); loadData();
        } catch { haptics.error(); }
    }

    async function handleSyncStrava() {
        setSyncingStrava(true);
        try {
            const { supabase: sb } = await import('@/lib/supabase');
            const { data: { session } } = await sb.auth.getSession();
            const res = await fetch('/api/strava/sync', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            const data = await res.json();
            if (data.success) {
                const count = data.synced ?? data.count ?? '';
                toast.success(`Synced${count ? ` ${count}` : ''} Strava activities`);
                loadData();
            } else {
                toast.error(data.error || 'Strava sync failed');
            }
        } catch {
            toast.error('Strava sync failed');
        } finally {
            setSyncingStrava(false);
        }
    }

    const cardStyle = {
        background: 'var(--color-surface-elevated)',
        borderColor: 'var(--color-border-light)',
    };

    return (
        <>
        <main className="p-6 pt-12 pb-24 space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <header className="flex items-center justify-between">
                <h1
                    className="text-3xl font-bold"
                    style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                >
                    Workout
                </h1>
                {activeTab === 'schedule' && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSyncStrava}
                            disabled={syncingStrava}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-50"
                            style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                            title="Sync Strava"
                        >
                            {syncingStrava
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <RefreshCw className="w-4 h-4" />}
                            <span className="text-sm">Strava</span>
                        </button>
                        <button
                            onClick={() => { setSelectedDate(new Date()); setShowScheduleModal(true); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium shadow-lg transition-all active:scale-[0.98]"
                            style={{
                                background: 'var(--color-primary)',
                                color: 'white',
                                boxShadow: '0 4px 16px rgba(77,137,226,0.3)',
                            }}
                        >
                            <Plus className="w-5 h-5" />
                            Schedule
                        </button>
                    </div>
                )}
                {activeTab === 'templates' && (
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium shadow-lg transition-all active:scale-[0.98]"
                        style={{
                            background: 'var(--color-success)',
                            color: 'white',
                            boxShadow: '0 4px 16px rgba(34,197,94,0.25)',
                        }}
                    >
                        <Plus className="w-5 h-5" />
                        Template
                    </button>
                )}
            </header>

            {/* AI Coach CTA */}
            <Link
                href="/coach"
                className="flex items-center justify-between px-4 py-3 rounded-2xl transition-all active:scale-[0.98]"
                style={{ background: 'var(--color-navy)' }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-gold-border)' }}>
                        <Bot className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
                    </div>
                    <div>
                        <p className="font-bold text-sm text-white leading-tight">AI Coach</p>
                        <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.55)' }}>Personalised plans &amp; weekly insights</p>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
            </Link>

            {/* Tabs */}
            <div
                className="flex rounded-xl p-1"
                style={{ background: 'var(--color-bg-subtle)' }}
            >
                {(['schedule', 'templates', 'discover', 'programs'] as Tab[]).map((tab) => {
                    const labels = { schedule: 'Schedule', templates: 'Templates', discover: 'Discover', programs: 'Programs' };
                    const icons = { schedule: Calendar, templates: LayoutGrid, discover: Sparkles, programs: Trophy };
                    const Icon = icons[tab];
                    const active = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => { haptics.tap(); setActiveTab(tab); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-medium transition-all text-sm"
                            style={
                                active
                                    ? {
                                        background: 'var(--color-surface-elevated)',
                                        color: 'var(--color-text)',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                                    }
                                    : { color: 'var(--color-text-muted)' }
                            }
                        >
                            <Icon className="w-4 h-4" />
                            {labels[tab]}
                        </button>
                    );
                })}
            </div>

            {/* Page-load failure (distinguishes network errors from empty states) */}
            {loadError && !loading && <LoadError onRetry={loadData} />}

            {/* ========== SCHEDULE TAB ========== */}
            {!loadError && activeTab === 'schedule' && (
                <>
                    {/* Week Navigation */}
                    <div
                        className="flex items-center justify-between p-4 rounded-2xl border shadow-sm"
                        style={cardStyle}
                    >
                        <button
                            onClick={handlePrevWeek}
                            className="w-10 h-10 flex items-center justify-center rounded-full transition-all"
                            style={{ color: 'var(--color-text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-bold" style={{ color: 'var(--color-text)' }}>
                            {format(currentWeekStart, 'MMM d')} – {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                        </span>
                        <button
                            onClick={handleNextWeek}
                            className="w-10 h-10 flex items-center justify-center rounded-full transition-all"
                            style={{ color: 'var(--color-text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Week View */}
                    <div className="rounded-2xl border overflow-hidden relative shadow-sm" style={cardStyle}>
                        {loading && (
                            <div
                                className="absolute inset-0 flex items-center justify-center z-10"
                                style={{ background: 'color-mix(in srgb, var(--color-surface-elevated) 80%, transparent)', backdropFilter: 'blur(4px)' }}
                            >
                                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
                            </div>
                        )}

                        <div
                            className="grid grid-cols-7"
                            style={{ borderBottom: '1px solid var(--color-border-light)' }}
                        >
                            {weekDays.map(day => (
                                <button
                                    key={day.toString()}
                                    onClick={() => handleDayClick(day)}
                                    className="p-3 text-center border-r last:border-r-0 transition-colors"
                                    style={{
                                        borderColor: 'var(--color-border-light)',
                                        background: isToday(day) ? 'rgba(77,137,226,0.08)' : 'transparent',
                                    }}
                                >
                                    <div
                                        className="text-xs font-bold uppercase"
                                        style={{ color: isToday(day) ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                                    >
                                        {format(day, 'EEE')}
                                    </div>
                                    <div
                                        className="text-lg font-bold mt-1"
                                        style={{ color: isToday(day) ? 'var(--color-primary)' : 'var(--color-text)' }}
                                    >
                                        {format(day, 'd')}
                                    </div>
                                    {(getWorkoutsForDay(day).length > 0 || getProgramSessionsForDay(day).length > 0) && (
                                        <div className="flex justify-center gap-1 mt-1">
                                            {getProgramSessionsForDay(day).some(s => s.status === 'completed')
                                                ? <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-success)' }} />
                                                : getProgramSessionsForDay(day).length > 0
                                                    ? <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />
                                                    : null
                                            }
                                            {getWorkoutsForDay(day).length > 0 && (
                                                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-gold)' }} />
                                            )}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div style={{ borderTop: '1px solid var(--color-border-light)' }}>
                            {weekDays.map(day => {
                                const dayWorkouts  = getWorkoutsForDay(day);
                                const daySessions  = getProgramSessionsForDay(day);
                                if (dayWorkouts.length === 0 && daySessions.length === 0) return null;
                                return (
                                    <div key={day.toString()} className="p-4" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                        <div
                                            className="text-sm font-bold mb-3"
                                            style={{ color: isToday(day) ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                                        >
                                            {format(day, 'EEEE, MMM d')}
                                            {isToday(day) && <span className="ml-2" style={{ color: 'var(--color-primary)' }}>• Today</span>}
                                        </div>
                                        <div className="space-y-2">
                                            {/* ── Program sessions (rendered first) ── */}
                                            {daySessions.map(session => {
                                                const accent  = sessionAccent(session.session_type);
                                                const isActive = session.status === 'upcoming' || session.status === 'rescheduled';
                                                const isDone   = session.status === 'completed';
                                                const isSkipped = session.status === 'skipped';
                                                return (
                                                    <div
                                                        key={session.id}
                                                        className="flex items-center justify-between p-3 rounded-xl border"
                                                        style={{
                                                            background: isDone
                                                                ? 'rgba(34,197,94,0.06)'
                                                                : isSkipped
                                                                ? 'var(--color-bg-subtle)'
                                                                : accent.bgAlpha,
                                                            borderColor: isDone
                                                                ? 'rgba(34,197,94,0.2)'
                                                                : isSkipped
                                                                ? 'var(--color-border)'
                                                                : accent.color + '40',
                                                            borderLeft: `3px solid ${isDone ? 'var(--color-success)' : accent.color}`,
                                                            opacity: isSkipped ? 0.55 : 1,
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="p-2 rounded-lg flex-shrink-0" style={{ background: isDone ? 'rgba(34,197,94,0.1)' : accent.iconBg }}>
                                                                <SessionTypeIcon
                                                                    type={session.session_type}
                                                                    className="w-4 h-4"
                                                                    style={{ color: isDone ? 'var(--color-success)' : accent.color }}
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                    <span
                                                                        className="text-xs font-bold uppercase tracking-wider"
                                                                        style={{ color: isDone ? 'var(--color-success)' : accent.color }}
                                                                    >
                                                                        Program · Wk {session.week_number}
                                                                    </span>
                                                                </div>
                                                                <div className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
                                                                    {session.day_label}
                                                                </div>
                                                                <div className="text-xs flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
                                                                    <Clock className="w-3 h-3" />
                                                                    {(session.scheduled_time ?? '12:00:00').slice(0, 5)}
                                                                    <span>·</span>
                                                                    {session.exercises?.length ?? 0} exercise{(session.exercises?.length ?? 0) !== 1 ? 's' : ''}
                                                                    {isDone && <span className="ml-1" style={{ color: 'var(--color-success)' }}>Completed</span>}
                                                                    {isSkipped && <span className="ml-1">Skipped</span>}
                                                                    {session.status === 'rescheduled' && <span className="ml-1" style={{ color: 'var(--chart-5)' }}>Rescheduled</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {isActive && (
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <button
                                                                    onClick={() => handleStartProgramSession(session)}
                                                                    className="p-2 rounded-lg transition-colors"
                                                                    style={{ background: 'var(--color-success)', color: 'white' }}
                                                                    title="Start"
                                                                >
                                                                    <Play className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => { setReschedulingSession(session); setRescheduleDate(session.scheduled_date); setRescheduleTime((session.scheduled_time ?? '12:00:00').slice(0, 5)); }}
                                                                    className="p-2 rounded-lg transition-colors"
                                                                    style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                                                                    title="Reschedule"
                                                                >
                                                                    <Calendar className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setSkipConfirmSession(session)}
                                                                    className="p-2 rounded-lg transition-colors"
                                                                    style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                                                                    title="Skip"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* ── Ad-hoc scheduled workouts ── */}
                                            {dayWorkouts.map(workout => (
                                                <div
                                                    key={workout.id}
                                                    className="flex items-center justify-between p-3 rounded-xl border"
                                                    style={
                                                        workout.status === 'completed'
                                                            ? { background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)' }
                                                            : workout.status === 'skipped'
                                                            ? { background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', opacity: 0.6 }
                                                            : { background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)' }
                                                    }
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="p-2 rounded-lg"
                                                            style={{
                                                                background: workout.status === 'completed'
                                                                    ? 'rgba(34,197,94,0.1)'
                                                                    : 'var(--color-gold-muted)',
                                                            }}
                                                        >
                                                            <Dumbbell
                                                                className="w-4 h-4"
                                                                style={{
                                                                    color: workout.status === 'completed'
                                                                        ? 'var(--color-success)'
                                                                        : 'var(--color-gold)',
                                                                }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                                                                {workout.title}
                                                            </div>
                                                            <div
                                                                className="text-xs flex items-center gap-1"
                                                                style={{ color: 'var(--color-text-muted)' }}
                                                            >
                                                                <Clock className="w-3 h-3" />
                                                                {workout.scheduled_time.slice(0, 5)}
                                                                {workout.status === 'completed' && (
                                                                    <span className="ml-2" style={{ color: 'var(--color-success)' }}>Completed</span>
                                                                )}
                                                                {workout.status === 'skipped' && (
                                                                    <span className="ml-2" style={{ color: 'var(--color-text-muted)' }}>Skipped</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {workout.status === 'scheduled' && (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleStartWorkout(workout)}
                                                                className="p-2 rounded-lg transition-colors"
                                                                style={{ background: 'var(--color-success)', color: 'white' }}
                                                                title="Start"
                                                            >
                                                                <Play className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => openEditWorkout(workout)}
                                                                className="p-2 rounded-lg transition-colors"
                                                                style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                                                                title="Edit"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleSkip(workout.id)}
                                                                className="p-2 rounded-lg transition-colors"
                                                                style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                                                                title="Skip"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteScheduled(workout.id)}
                                                                className="p-2 rounded-lg transition-colors"
                                                                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            {scheduledWorkouts.length === 0 && programSessions.length === 0 && !loading && (
                                <div className="p-8 text-center">
                                    <Calendar className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-border)' }} />
                                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>No workouts scheduled this week</p>
                                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Tap a day or use the button above to schedule</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <div
                            className="p-4 rounded-2xl border"
                            style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)' }}
                        >
                            <div className="text-2xl font-black" style={{ color: 'var(--color-success)' }}>
                                {scheduledWorkouts.filter(w => w.status === 'completed').length
                                 + programSessions.filter(s => s.status === 'completed').length}
                            </div>
                            <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-success)' }}>Done</div>
                        </div>
                        <div
                            className="p-4 rounded-2xl border"
                            style={{ background: 'rgba(77,137,226,0.06)', borderColor: 'rgba(77,137,226,0.2)' }}
                        >
                            <div className="text-2xl font-black" style={{ color: 'var(--color-primary)' }}>
                                {programSessions.filter(s => s.status === 'upcoming' || s.status === 'rescheduled').length}
                            </div>
                            <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-primary)' }}>Program</div>
                        </div>
                        <div
                            className="p-4 rounded-2xl border"
                            style={{ background: 'var(--color-gold-muted)', borderColor: 'var(--color-gold-border)' }}
                        >
                            <div className="text-2xl font-black" style={{ color: 'var(--color-gold)' }}>
                                {scheduledWorkouts.filter(w => w.status === 'scheduled').length}
                            </div>
                            <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--color-gold)' }}>Ad-hoc</div>
                        </div>
                    </div>
                </>
            )}

            {/* ========== TEMPLATES TAB ========== */}
            {!loadError && activeTab === 'templates' && (
                <div className="space-y-4">
                    {loading ? (
                        <div className="space-y-3" aria-hidden="true">
                            <div className="skeleton rounded-2xl h-24 w-full" />
                            <div className="skeleton rounded-2xl h-24 w-full" />
                            <div className="skeleton rounded-2xl h-24 w-full" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="rounded-2xl border p-8 text-center" style={cardStyle}>
                            <Dumbbell className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-border)' }} />
                            <p className="font-medium" style={{ color: 'var(--color-text)' }}>No workout templates yet</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Create your own or browse Discover</p>
                            <button
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl font-medium transition-all"
                                style={{ background: 'var(--color-success)', color: 'white' }}
                            >
                                <Plus className="w-4 h-4" /> Create Template
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {templates.map(template => (
                                <div key={template.id} className="rounded-2xl border p-4 shadow-sm" style={cardStyle}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div
                                                className="p-2 rounded-xl flex-shrink-0"
                                                style={{ background: 'var(--color-gold-muted)' }}
                                            >
                                                <Dumbbell className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold truncate" style={{ color: 'var(--color-text)' }}>
                                                    {template.name}
                                                </h3>
                                                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                                    {Array.isArray(template.exercises) ? `${template.exercises.length} exercises` : 'Custom workout'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => setPreviewTemplate(template)}
                                                className="p-2 rounded-lg transition-colors"
                                                style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                                                title="Preview"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => { haptics.success(); router.push(`/workout/active/new?template=${template.id}`); }}
                                                className="p-2 rounded-lg transition-colors"
                                                style={{ background: 'var(--color-success)', color: 'white' }}
                                                title="Start workout"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setMenuOpen(menuOpen === template.id ? null : template.id)}
                                                    className="p-2 rounded-lg transition-colors"
                                                    style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                {menuOpen === template.id && (
                                                    <div
                                                        className="absolute right-0 top-10 shadow-xl rounded-xl py-2 z-20 min-w-[140px] border"
                                                        style={{
                                                            background: 'var(--color-surface-elevated)',
                                                            borderColor: 'var(--color-border-light)',
                                                        }}
                                                    >
                                                        <button
                                                            onClick={() => openEditModal(template)}
                                                            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                                                            style={{ color: 'var(--color-text)' }}
                                                        >
                                                            <Edit2 className="w-4 h-4" /> Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDuplicateTemplate(template)}
                                                            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                                                            style={{ color: 'var(--color-text)' }}
                                                        >
                                                            <Copy className="w-4 h-4" /> Duplicate
                                                        </button>
                                                        <button
                                                            onClick={() => { setShareTemplate(template); setMenuOpen(null); }}
                                                            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                                                            style={{ color: 'var(--color-text)' }}
                                                        >
                                                            <Share2 className="w-4 h-4" /> Send to partner
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteTemplate(template.id)}
                                                            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                                                            style={{ color: 'var(--color-danger)' }}
                                                        >
                                                            <Trash2 className="w-4 h-4" /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {Array.isArray(template.exercises) && template.exercises.length > 0 && (
                                        <div
                                            className="mt-3 pt-3 flex flex-wrap gap-2"
                                            style={{ borderTop: '1px solid var(--color-border-light)' }}
                                        >
                                            {template.exercises.slice(0, 3).map((ex: any, idx: number) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-1 text-xs rounded-lg"
                                                    style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                                                >
                                                    {ex.name || ex.exercise_name}
                                                </span>
                                            ))}
                                            {template.exercises.length > 3 && (
                                                <span className="px-2 py-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                    +{template.exercises.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Quick Start */}
                    <div
                        className="rounded-2xl border p-4"
                        style={{
                            background: 'var(--color-navy)',
                            borderColor: 'var(--color-gold-border)',
                        }}
                    >
                        <h3 className="font-bold mb-1 text-white">Quick Start</h3>
                        <p className="text-sm mb-3" style={{ color: 'rgba(228,234,242,0.6)' }}>Start a workout without a template</p>
                        <button
                            onClick={() => { haptics.success(); router.push('/workout/active/new'); }}
                            className="flex items-center justify-between w-full p-3 rounded-xl transition-all"
                            style={{
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid var(--color-gold-border)',
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg" style={{ background: 'var(--color-gold-muted)' }}>
                                    <Play className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
                                </div>
                                <span className="font-medium text-white">Empty Workout</span>
                            </div>
                            <ChevronRight className="w-5 h-5" style={{ color: 'rgba(224,179,90,0.6)' }} />
                        </button>
                    </div>
                </div>
            )}

            {/* ========== DISCOVER TAB ========== */}
            {!loadError && activeTab === 'discover' && (
                <div className="space-y-4">
                    {/* AI Recommendations */}
                    <div
                        className="rounded-2xl border p-4"
                        style={{ background: 'var(--color-navy)', borderColor: 'var(--color-gold-border)' }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg" style={{ background: 'var(--color-gold-muted)' }}>
                                    <Bot className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">AI Recommendations</h3>
                                    <p className="text-xs" style={{ color: 'rgba(228,234,242,0.5)' }}>
                                        Personalized workouts based on your history
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={loadAIRecommendations}
                                disabled={aiLoading}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50 transition-all"
                                style={{ background: 'var(--color-gold)', color: 'var(--color-navy)' }}
                            >
                                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                {aiRecommendations.length > 0 ? 'Refresh' : 'Generate'}
                            </button>
                        </div>

                        {aiError && (
                            <div
                                className="text-sm p-2 rounded-lg mb-3"
                                style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
                            >
                                {aiError}
                            </div>
                        )}

                        {aiRecommendations.length > 0 && (
                            <div className="space-y-2">
                                {aiRecommendations.map((rec, idx) => (
                                    <div
                                        key={idx}
                                        className="rounded-xl p-3 border"
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            borderColor: 'var(--color-gold-border)',
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold text-white">{rec.title}</h4>
                                            <button
                                                onClick={() => handleSaveAIRecommendation(rec)}
                                                className="p-1.5 rounded-lg transition-all"
                                                style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold)' }}
                                                title="Save to My Templates"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-xs mb-2" style={{ color: 'rgba(224,179,90,0.8)' }}>{rec.reason}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {rec.exercises.slice(0, 4).map((ex, i) => (
                                                <span
                                                    key={i}
                                                    className="px-2 py-0.5 text-xs rounded"
                                                    style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold)' }}
                                                >
                                                    {ex.name}
                                                </span>
                                            ))}
                                            {rec.exercises.length > 4 && (
                                                <span className="text-xs" style={{ color: 'rgba(224,179,90,0.5)' }}>
                                                    +{rec.exercises.length - 4}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!aiLoading && aiRecommendations.length === 0 && !aiError && (
                            <p className="text-sm text-center py-4" style={{ color: 'rgba(228,234,242,0.4)' }}>
                                Tap &quot;Generate&quot; to get personalized workout suggestions
                            </p>
                        )}
                    </div>

                    {/* Category Filter */}
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.value}
                                onClick={() => { haptics.tap(); setCategoryFilter(cat.value); }}
                                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all"
                                style={
                                    categoryFilter === cat.value
                                        ? { background: 'var(--color-primary)', color: 'white' }
                                        : { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }
                                }
                            >
                                <cat.icon className="w-4 h-4 inline-block mr-1 align-text-bottom" aria-hidden="true" />{cat.label}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="space-y-3" aria-hidden="true">
                            <div className="skeleton rounded-2xl h-24 w-full" />
                            <div className="skeleton rounded-2xl h-24 w-full" />
                            <div className="skeleton rounded-2xl h-24 w-full" />
                        </div>
                    ) : publicTemplates.length === 0 ? (
                        <div className="rounded-2xl border p-8 text-center" style={cardStyle}>
                            <Sparkles className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-border)' }} />
                            <p className="font-medium" style={{ color: 'var(--color-text)' }}>No templates found</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Try a different category</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {publicTemplates.map(template => (
                                <div key={template.id} className="rounded-2xl border p-4 shadow-sm" style={cardStyle}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div
                                                className="p-2 rounded-xl flex-shrink-0"
                                                style={{ background: template.is_featured ? 'var(--color-gold-muted)' : 'rgba(77,137,226,0.1)' }}
                                            >
                                                {template.is_featured
                                                    ? <Star className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
                                                    : <Dumbbell className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                                                }
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold truncate" style={{ color: 'var(--color-text)' }}>{template.name}</h3>
                                                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                                    {template.difficulty && (
                                                        <span
                                                            className="px-2 py-0.5 rounded-full text-xs"
                                                            style={
                                                                template.difficulty === 'beginner'
                                                                    ? { background: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' }
                                                                    : template.difficulty === 'intermediate'
                                                                    ? { background: 'rgba(234,179,8,0.1)', color: 'var(--color-warning)' }
                                                                    : { background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }
                                                            }
                                                        >
                                                            {template.difficulty}
                                                        </span>
                                                    )}
                                                    {template.estimated_duration && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />{template.estimated_duration}m
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => setPreviewTemplate(template)}
                                                className="p-2 rounded-lg transition-colors"
                                                style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => { haptics.success(); router.push(`/workout/active/new?template=${template.id}`); }}
                                                className="p-2 rounded-lg"
                                                style={{ background: 'var(--color-success)', color: 'white' }}
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleCopyTemplate(template)}
                                                className="p-2 rounded-lg transition-colors"
                                                style={
                                                    copiedId === template.id
                                                        ? { background: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' }
                                                        : { background: 'rgba(77,137,226,0.1)', color: 'var(--color-primary)' }
                                                }
                                            >
                                                {copiedId === template.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    {template.description && (
                                        <p className="mt-2 text-sm line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                                            {template.description}
                                        </p>
                                    )}
                                    {Array.isArray(template.exercises) && template.exercises.length > 0 && (
                                        <div
                                            className="mt-3 pt-3 flex flex-wrap gap-2"
                                            style={{ borderTop: '1px solid var(--color-border-light)' }}
                                        >
                                            {template.exercises.slice(0, 4).map((ex: any, idx: number) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-1 text-xs rounded-lg"
                                                    style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                                                >
                                                    {ex.name || ex.exercise_name}
                                                </span>
                                            ))}
                                            {template.exercises.length > 4 && (
                                                <span className="px-2 py-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                    +{template.exercises.length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ========== PROGRAMS TAB ========== */}
            {!loadError && activeTab === 'programs' && (
                <Link
                    href="/programs"
                    className="flex items-center justify-between p-5 rounded-2xl border transition-all active:scale-[0.98]"
                    style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl" style={{ background: 'var(--color-primary)' }}>
                            <Trophy className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-base" style={{ color: 'var(--color-text)' }}>12-Week Programs</p>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                Create, track and manage your training programs
                            </p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                </Link>
            )}

            {/* ========== SCHEDULE MODAL ========== */}
            {showScheduleModal && (
                <ScheduleWorkoutModal
                    selectedDate={selectedDate}
                    templates={templates}
                    onClose={() => { setShowScheduleModal(false); setSelectedDate(null); }}
                    onScheduled={() => { setShowScheduleModal(false); setSelectedDate(null); loadData(); }}
                />
            )}

            {/* ========== TEMPLATE PREVIEW MODAL ========== */}
            {previewTemplate && (
                <Modal isOpen onClose={() => setPreviewTemplate(null)} aria-label={`Preview ${previewTemplate.name}`} size="md" sheet={false} padding={false} className="max-h-[80dvh] overflow-hidden flex flex-col">
                        <div
                            className="p-4 flex items-center justify-between"
                            style={{ borderBottom: '1px solid var(--color-border-light)' }}
                        >
                            <div>
                                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
                                    {previewTemplate.name}
                                </h2>
                                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                    {Array.isArray(previewTemplate.exercises) ? `${previewTemplate.exercises.length} exercises` : 'Custom workout'}
                                </p>
                            </div>
                            <button
                                onClick={() => setPreviewTemplate(null)}
                                className="p-2 rounded-lg"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {Array.isArray(previewTemplate.exercises) && previewTemplate.exercises.length > 0 ? (
                                <div className="space-y-3">
                                    {previewTemplate.exercises.map((ex: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-3 rounded-xl"
                                            style={{ background: 'var(--color-bg-subtle)' }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                                                    style={{ background: 'rgba(77,137,226,0.1)', color: 'var(--color-primary)' }}
                                                >
                                                    {idx + 1}
                                                </div>
                                                <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                                                    {ex.name || ex.exercise_name}
                                                </span>
                                            </div>
                                            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                                {ex.sets || ex.target_sets} × {ex.reps || ex.target_reps}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No exercises defined</p>
                            )}
                        </div>
                        <div
                            className="p-4 flex gap-3"
                            style={{ borderTop: '1px solid var(--color-border-light)' }}
                        >
                            <button
                                onClick={() => setPreviewTemplate(null)}
                                className="flex-1 py-3 rounded-xl font-bold transition-all"
                                style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text)' }}
                            >
                                Close
                            </button>
                            <button
                                onClick={() => { haptics.success(); router.push(`/workout/active/new?template=${previewTemplate.id}`); }}
                                className="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                                style={{ background: 'var(--color-primary)', color: 'white' }}
                            >
                                <Play className="w-5 h-5" /> Start Workout
                            </button>
                        </div>
                </Modal>
            )}

            {/* ========== TEMPLATE EDITOR MODAL ========== */}
            {showEditorModal && (
                <Modal isOpen onClose={() => setShowEditorModal(false)} aria-label={editingTemplate ? 'Edit Template' : 'New Template'} size="lg">
                        <h2
                            className="text-xl font-bold mb-4"
                            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                        >
                            {editingTemplate ? 'Edit Template' : 'New Template'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label
                                    className="block text-xs font-bold uppercase tracking-widest mb-1.5"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    Workout Name
                                </label>
                                <input
                                    className="w-full p-3 rounded-xl outline-none transition-all"
                                    style={{
                                        background: 'var(--color-bg-subtle)',
                                        border: '1px solid var(--color-border)',
                                        color: 'var(--color-text)',
                                    }}
                                    placeholder="e.g. Push Day"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div ref={autocompleteRef}>
                                <label
                                    className="block text-xs font-bold uppercase tracking-widest mb-1.5"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    Exercises
                                </label>
                                <div className="flex gap-2 relative">
                                    <div className="flex-1 relative">
                                        <input
                                            className="w-full p-3 rounded-xl outline-none transition-all"
                                            style={{
                                                background: 'var(--color-bg-subtle)',
                                                border: '1px solid var(--color-border)',
                                                color: 'var(--color-text)',
                                            }}
                                            placeholder="Type exercise name..."
                                            value={exerciseInput}
                                            onChange={e => setExerciseInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addExercise()}
                                            onFocus={() => exerciseInput && setShowAutocomplete(true)}
                                        />
                                        {showAutocomplete && autocompleteResults.length > 0 && (
                                            <div
                                                className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-lg z-10 overflow-hidden border"
                                                style={{
                                                    background: 'var(--color-surface-elevated)',
                                                    borderColor: 'var(--color-border-light)',
                                                }}
                                            >
                                                {autocompleteResults.map((ex, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => addExercise(ex)}
                                                        className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                                                        style={{ color: 'var(--color-text)' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-subtle)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <Dumbbell className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                                                        {ex}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => addExercise()}
                                        className="px-4 py-3 rounded-xl font-medium transition-all"
                                        style={{ background: 'var(--color-primary)', color: 'white' }}
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {formExercises.length > 0 && (
                                <div className="space-y-2">
                                    {formExercises.map((ex, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3 p-3 rounded-xl"
                                            style={{ background: 'var(--color-bg-subtle)' }}
                                        >
                                            <span className="flex-1 font-medium" style={{ color: 'var(--color-text)' }}>{ex.name}</span>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                className="w-16 p-2 rounded-lg border text-center outline-none"
                                                style={{
                                                    background: 'var(--color-surface-elevated)',
                                                    borderColor: 'var(--color-border)',
                                                    color: 'var(--color-text)',
                                                }}
                                                value={ex.sets}
                                                onChange={e => {
                                                    const updated = [...formExercises];
                                                    updated[i].sets = parseInt(e.target.value) || 0;
                                                    setFormExercises(updated);
                                                }}
                                            />
                                            <span style={{ color: 'var(--color-text-muted)' }}>×</span>
                                            <input
                                                type="text"
                                                className="w-16 p-2 rounded-lg border text-center outline-none"
                                                style={{
                                                    background: 'var(--color-surface-elevated)',
                                                    borderColor: 'var(--color-border)',
                                                    color: 'var(--color-text)',
                                                }}
                                                value={ex.reps}
                                                onChange={e => {
                                                    const updated = [...formExercises];
                                                    updated[i].reps = e.target.value;
                                                    setFormExercises(updated);
                                                }}
                                            />
                                            <button
                                                onClick={() => removeExercise(i)}
                                                className="p-2 rounded-lg transition-colors"
                                                style={{ color: 'var(--color-danger)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowEditorModal(false)}
                                    className="flex-1 py-3 rounded-xl font-bold transition-all"
                                    style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    disabled={!formTitle.trim() || saving}
                                    className="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                                    style={{ background: 'var(--color-primary)', color: 'white' }}
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editingTemplate ? 'Save Changes' : 'Create Template'}
                                </button>
                            </div>
                        </div>
                </Modal>
            )}

            {/* ── Skip Confirm Bottom Sheet ────────────────────────────────── */}
            {skipConfirmSession && (
                <Modal isOpen onClose={() => setSkipConfirmSession(null)} aria-label="Skip this session?" size="lg" className="space-y-3">
                        <div className="mb-1">
                            <p className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
                                Skip this session?
                            </p>
                            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                Week {skipConfirmSession.week_number} · {skipConfirmSession.day_label}
                            </p>
                        </div>
                        <button
                            onClick={() => handleSkipProgramSession(skipConfirmSession, false)}
                            className="w-full py-3.5 rounded-xl text-left px-4 transition-all active:scale-[0.98]"
                            style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}
                        >
                            <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                                Skip this session only
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                Future sessions stay on their current dates
                            </div>
                        </button>
                        <button
                            onClick={() => handleSkipProgramSession(skipConfirmSession, true)}
                            className="w-full py-3.5 rounded-xl text-left px-4 transition-all active:scale-[0.98]"
                            style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)' }}
                        >
                            <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                                Skip &amp; push future sessions +1 day
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                All upcoming sessions shift forward by one day
                            </div>
                        </button>
                        <button
                            onClick={() => setSkipConfirmSession(null)}
                            className="w-full py-3 rounded-xl font-semibold text-sm"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            Cancel
                        </button>
                </Modal>
            )}

            {/* ── Edit Ad-hoc Workout Modal ────────────────────────────────── */}
            {editingWorkout && (
                <Modal isOpen onClose={closeEditWorkout} aria-label="Edit Workout" size="sm" sheet={false} className="space-y-4">
                        <p className="font-bold text-base" style={{ color: 'var(--color-text)' }}>Edit Workout</p>

                        {/* Title */}
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Title</label>
                            <input
                                type="text"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                className="w-full p-3 rounded-xl outline-none"
                                style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                            />
                        </div>

                        {/* Date + Time */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Date</label>
                                <input
                                    type="date"
                                    value={editDate}
                                    onChange={e => setEditDate(e.target.value)}
                                    className="w-full p-3 rounded-xl outline-none"
                                    style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Time</label>
                                <input
                                    type="time"
                                    value={editTime}
                                    onChange={e => setEditTime(e.target.value)}
                                    className="w-full p-3 rounded-xl outline-none"
                                    style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                />
                            </div>
                        </div>

                        {/* Duration + Remind */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Duration</label>
                                <select
                                    value={editDuration}
                                    onChange={e => setEditDuration(Number(e.target.value))}
                                    className="w-full p-3 rounded-xl outline-none"
                                    style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                >
                                    <option value={30}>30 min</option>
                                    <option value={45}>45 min</option>
                                    <option value={60}>1 hour</option>
                                    <option value={75}>75 min</option>
                                    <option value={90}>90 min</option>
                                    <option value={120}>2 hours</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Remind Me</label>
                                <select
                                    value={editRemind}
                                    onChange={e => setEditRemind(Number(e.target.value))}
                                    className="w-full p-3 rounded-xl outline-none"
                                    style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                >
                                    <option value={0}>At start</option>
                                    <option value={5}>5 min before</option>
                                    <option value={15}>15 min before</option>
                                    <option value={30}>30 min before</option>
                                    <option value={60}>1 hr before</option>
                                    <option value={1440}>1 day before</option>
                                </select>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Notes</label>
                            <textarea
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                rows={2}
                                className="w-full p-3 rounded-xl outline-none resize-none"
                                style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={closeEditWorkout}
                                className="flex-1 py-3 rounded-xl font-bold text-sm"
                                style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={editSaving || !editTitle.trim()}
                                className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                style={{ background: 'var(--color-primary)', color: 'white' }}
                            >
                                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                            </button>
                        </div>
                </Modal>
            )}

            {/* ── Reschedule Modal ─────────────────────────────────────────── */}
            {reschedulingSession && (
                <Modal isOpen onClose={() => { setReschedulingSession(null); setRescheduleDate(''); setRescheduleTime('12:00'); }} aria-label="Reschedule Session" size="sm" sheet={false} className="space-y-4">
                        <div>
                            <p className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
                                Reschedule Session
                            </p>
                            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                Week {reschedulingSession.week_number} · {reschedulingSession.day_label}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label
                                    className="text-xs font-bold uppercase tracking-wider block mb-1.5"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    New Date
                                </label>
                                <input
                                    type="date"
                                    value={rescheduleDate}
                                    onChange={e => setRescheduleDate(e.target.value)}
                                    className="w-full p-3 rounded-xl outline-none"
                                    style={{
                                        background: 'var(--color-bg-subtle)',
                                        border: '1px solid var(--color-border)',
                                        color: 'var(--color-text)',
                                    }}
                                />
                            </div>
                            <div>
                                <label
                                    className="text-xs font-bold uppercase tracking-wider block mb-1.5"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    Time
                                </label>
                                <input
                                    type="time"
                                    value={rescheduleTime}
                                    onChange={e => setRescheduleTime(e.target.value)}
                                    className="w-full p-3 rounded-xl outline-none"
                                    style={{
                                        background: 'var(--color-bg-subtle)',
                                        border: '1px solid var(--color-border)',
                                        color: 'var(--color-text)',
                                    }}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setReschedulingSession(null); setRescheduleDate(''); setRescheduleTime('12:00'); }}
                                className="flex-1 py-3 rounded-xl font-bold text-sm"
                                style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleRescheduleSession(reschedulingSession)}
                                disabled={!rescheduleDate}
                                className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition-all"
                                style={{ background: 'var(--color-primary)', color: 'white' }}
                            >
                                Reschedule
                            </button>
                        </div>
                </Modal>
            )}

            {shareTemplate && (
                <ShareToPartnerSheet
                    open={!!shareTemplate}
                    onClose={() => setShareTemplate(null)}
                    itemType="workout_template"
                    payload={{
                        name: shareTemplate.name,
                        exercises: (shareTemplate.exercises || []).map((e: any) => ({
                            name: e.name || e.exercise_name || '',
                            sets: e.sets || e.target_sets || 3,
                            reps: e.reps || e.target_reps || '10',
                        })),
                    }}
                />
            )}
        </main>

        </>
    );
}
