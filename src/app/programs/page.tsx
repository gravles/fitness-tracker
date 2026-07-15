'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
    ChevronLeft, ChevronRight, Sparkles, Loader2, Trophy, Trash2, X, Pause, Play, BarChart2,
} from 'lucide-react';
import {
    getTrainingPrograms, createTrainingProgram, updateTrainingProgram,
    deleteTrainingProgram, TrainingProgram, getSettings, isAuthError } from '@/lib/api';
import { getProgramStats, getProgramSessions, ProgramSession } from '@/lib/program-api';
import { ProgramReviewModal } from '@/components/ProgramReviewModal';
import { LoadError } from '@/components/ui';
import { toast } from 'sonner';
import { confirm } from '@/components/ConfirmDialog';
import { useRouter } from 'next/navigation';
import { haptics } from '@/lib/haptics';

// ─── Constants ────────────────────────────────────────────────────────────────

const GOALS: { id: 'strength' | 'hypertrophy' | 'endurance' | 'athletic'; label: string; desc: string }[] = [
    { id: 'strength',    label: 'Strength',    desc: 'Heavy loads, compound lifts' },
    { id: 'hypertrophy', label: 'Hypertrophy', desc: 'Muscle building, volume focus' },
    { id: 'endurance',   label: 'Endurance',   desc: 'High reps, conditioning' },
    { id: 'athletic',    label: 'Athletic',     desc: 'Power, speed, agility' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramsPage() {
    const router = useRouter();

    const [programs, setPrograms]             = useState<TrainingProgram[]>([]);
    const [loading, setLoading]               = useState(true);
    const [loadError, setLoadError]           = useState(false);
    const [programStats, setProgramStats]     = useState<Record<string, { total: number; completed: number; adherence: number }>>({});
    const [userEquipment, setUserEquipment]   = useState<string[]>([]);

    // Generation form
    const [showForm, setShowForm]             = useState(false);
    const [programGoal, setProgramGoal]       = useState<typeof GOALS[0]['id']>('hypertrophy');
    const [programDays, setProgramDays]       = useState(4);
    const [programNotes, setProgramNotes]     = useState('');
    const [generating, setGenerating]         = useState(false);

    // Review modal
    const [reviewingProgram, setReviewingProgram] = useState<TrainingProgram | null>(null);

    // Progress / analytics
    const [showProgress, setShowProgress]             = useState(false);
    const [allActiveSessions, setAllActiveSessions]   = useState<ProgramSession[]>([]);
    const [progressLoading, setProgressLoading]       = useState(false);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        setLoading(true);
        setLoadError(false);
        try {
            const [programData, settings] = await Promise.all([
                getTrainingPrograms(),
                getSettings(),
            ]);
            setPrograms(programData);
            if (settings?.available_equipment?.length) {
                setUserEquipment(settings.available_equipment);
            }
            // Load completion stats for each program
            const statsMap: Record<string, { total: number; completed: number; adherence: number }> = {};
            await Promise.all(programData.map(async (p) => {
                statsMap[p.id] = await getProgramStats(p.id);
            }));
            setProgramStats(statsMap);
        } catch (err) {
            console.error('Error loading programs:', err);
            if (!isAuthError(err)) setLoadError(true);
        } finally {
            setLoading(false);
        }
    }

    async function handleGenerate() {
        setGenerating(true);
        try {
            const { supabase: sb } = await import('@/lib/supabase');
            const { data: { session } } = await sb.auth.getSession();
            const res = await fetch('/api/ai/generate-program', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                body:    JSON.stringify({ goal: programGoal, daysPerWeek: programDays, equipment: userEquipment, notes: programNotes }),
            });
            if (!res.ok) throw new Error(await res.text());
            const programData = await res.json();
            const saved = await createTrainingProgram({
                ...programData,
                status:      'draft',
                days_per_week: programDays,
            });
            setPrograms(prev => [saved, ...prev]);
            setShowForm(false);
            setReviewingProgram(saved);
            haptics.success();
        } catch (e: any) {
            toast.error('Failed to generate program: ' + e.message);
            haptics.error();
        } finally {
            setGenerating(false);
        }
    }

    async function handleActivate(prog: TrainingProgram) {
        haptics.tap();
        try {
            // Pause any currently active programs
            await Promise.all(
                programs
                    .filter(p => p.status === 'active')
                    .map(p => updateTrainingProgram(p.id, { status: 'paused' }))
            );
            await updateTrainingProgram(prog.id, { status: 'active' });
            setPrograms(prev => prev.map(p => ({
                ...p,
                status: p.id === prog.id ? 'active' : (p.status === 'active' ? 'paused' : p.status),
            })));
            toast.success('Program activated');
        } catch {
            toast.error('Failed to activate program');
        }
    }

    async function handleDelete(progId: string) {
        if (!await confirm({ title: 'Delete Program', message: 'Delete this program? This cannot be undone.', danger: true })) return;
        haptics.tap();
        try {
            await deleteTrainingProgram(progId);
            setPrograms(prev => prev.filter(p => p.id !== progId));
        } catch {
            toast.error('Failed to delete program');
        }
    }

    async function handlePause() {
        const activeProg = programs.find(p => p.status === 'active');
        if (!activeProg) return;
        haptics.tap();
        try {
            await updateTrainingProgram(activeProg.id, { status: 'paused' });
            setPrograms(prev => prev.map(p =>
                p.id === activeProg.id ? { ...p, status: 'paused' as const } : p
            ));
            setShowProgress(false);
            setAllActiveSessions([]);
            toast.success('Program paused');
        } catch {
            toast.error('Failed to pause program');
        }
    }

    async function handleResume(prog: TrainingProgram) {
        haptics.tap();
        try {
            await Promise.all(
                programs
                    .filter(p => p.status === 'active')
                    .map(p => updateTrainingProgram(p.id, { status: 'paused' }))
            );
            await updateTrainingProgram(prog.id, { status: 'active' });
            setPrograms(prev => prev.map(p => ({
                ...p,
                status: p.id === prog.id ? 'active' as const : (p.status === 'active' ? 'paused' as const : p.status),
            })));
            setShowProgress(false);
            setAllActiveSessions([]);
            toast.success('Program resumed');
        } catch {
            toast.error('Failed to resume program');
        }
    }

    async function loadProgressData(progId: string) {
        setProgressLoading(true);
        try {
            const sessions = await getProgramSessions(progId);
            setAllActiveSessions(sessions);
        } finally {
            setProgressLoading(false);
        }
    }

    const activeProgram = programs.find(p => p.status === 'active');
    const otherPrograms = programs.filter(p => p.status !== 'active');

    // ── Progress helpers ──────────────────────────────────────────────────────
    function programProgress(prog: TrainingProgram): number {
        const stats = programStats[prog.id];
        if (!stats || stats.total === 0) return 0;
        return Math.round((stats.completed / stats.total) * 100);
    }

    function currentPhase(prog: TrainingProgram): string {
        const stats = programStats[prog.id];
        if (!stats || stats.total === 0) return prog.phases?.[0]?.name || 'Phase 1';
        const sessionsPerWeek = prog.days_per_week || 4;
        const approxWeek = Math.floor(stats.completed / sessionsPerWeek) + 1;
        const phase = prog.phases?.find(ph => {
            const [start, end] = ph.weeks.split('-').map(Number);
            return approxWeek >= start && approxWeek <= end;
        });
        return phase?.name || prog.phases?.[0]?.name || 'Phase 1';
    }

    return (
        <>
        <main className="p-6 pt-12 pb-24 space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <header className="flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-xl transition-all active:scale-90"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h1
                    className="text-3xl font-bold flex-1"
                    style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                >
                    Programs
                </h1>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium shadow-lg transition-all active:scale-[0.98]"
                        style={{ background: 'var(--color-primary)', color: 'white' }}
                    >
                        <Sparkles className="w-4 h-4" />
                        New
                    </button>
                )}
            </header>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
                </div>
            ) : loadError ? (
                <LoadError onRetry={loadData} />
            ) : (
                <div className="space-y-4">

                    {/* ── Active program ─────────────────────────────────── */}
                    {activeProgram && (
                        <div
                            className="p-5 rounded-2xl border space-y-4"
                            style={{ background: 'var(--color-navy)', borderColor: 'var(--color-gold-border)' }}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-gold)' }}>
                                        Active Program
                                    </p>
                                    <h2 className="font-bold text-white text-xl leading-tight">{activeProgram.name}</h2>
                                    <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                        {currentPhase(activeProgram)}
                                        {activeProgram.start_date
                                            ? ` · Started ${format(new Date(activeProgram.start_date + 'T00:00:00'), 'MMM d')}`
                                            : ''}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-white">{programProgress(activeProgram)}%</div>
                                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>complete</div>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{ background: 'var(--color-gold)', width: `${programProgress(activeProgram)}%` }}
                                />
                            </div>

                            {/* Session stats */}
                            {programStats[activeProgram.id] && programStats[activeProgram.id].total > 0 && (
                                <div className="flex items-center justify-between text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                    <span>
                                        {programStats[activeProgram.id].completed} / {programStats[activeProgram.id].total} sessions
                                    </span>
                                    <span>
                                        {programStats[activeProgram.id].adherence}% adherence
                                    </span>
                                </div>
                            )}

                            {/* Action row */}
                            <div className="flex gap-2">
                                <button
                                    onClick={handlePause}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)' }}
                                >
                                    <Pause className="w-3.5 h-3.5" /> Pause
                                </button>
                                <button
                                    onClick={() => setReviewingProgram(activeProgram)}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95"
                                    style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
                                >
                                    Review / Edit
                                </button>
                            </div>

                            {/* Progress toggle */}
                            <button
                                onClick={() => {
                                    if (!showProgress && allActiveSessions.length === 0) {
                                        loadProgressData(activeProgram.id);
                                    }
                                    setShowProgress(s => !s);
                                }}
                                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
                            >
                                <BarChart2 className="w-4 h-4" />
                                {showProgress ? 'Hide Progress' : 'View Progress'}
                            </button>

                            {/* ── 12-week adherence grid ────────────────────── */}
                            {showProgress && (
                                <div
                                    className="pt-3 space-y-3"
                                    style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
                                >
                                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                        12-Week Progress
                                    </p>
                                    {progressLoading ? (
                                        <div className="flex justify-center py-3">
                                            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-1.5">
                                                {Array.from({ length: 12 }, (_, i) => {
                                                    const weekNum = i + 1;
                                                    const weekSessions = allActiveSessions.filter(s => s.week_number === weekNum);
                                                    const isCurrent = activeProgram.start_date ? (() => {
                                                        const start = new Date(activeProgram.start_date + 'T00:00:00');
                                                        const wkStart = new Date(start);
                                                        wkStart.setDate(start.getDate() + (weekNum - 1) * 7);
                                                        const wkEnd = new Date(wkStart);
                                                        wkEnd.setDate(wkStart.getDate() + 6);
                                                        const now = new Date();
                                                        return now >= wkStart && now <= wkEnd;
                                                    })() : false;
                                                    return (
                                                        <div key={weekNum} className="flex items-center gap-2">
                                                            <span
                                                                className="text-xs w-7 flex-shrink-0 font-medium text-right"
                                                                style={{ color: isCurrent ? 'var(--color-gold)' : 'rgba(255,255,255,0.3)' }}
                                                            >
                                                                {weekNum}
                                                            </span>
                                                            <div className="flex gap-1 flex-wrap flex-1">
                                                                {weekSessions.length === 0
                                                                    ? <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
                                                                    : weekSessions.map((s, j) => (
                                                                        <div
                                                                            key={j}
                                                                            title={`${s.day_label} · ${s.status}`}
                                                                            className="w-4 h-4 rounded-sm"
                                                                            style={{
                                                                                background:
                                                                                    s.status === 'completed'  ? 'var(--chart-2)' :
                                                                                    s.status === 'skipped'    ? 'rgba(239,68,68,0.55)' :
                                                                                    s.status === 'upcoming' || s.status === 'rescheduled'
                                                                                        ? 'rgba(255,255,255,0.18)' :
                                                                                    'rgba(255,255,255,0.06)',
                                                                            }}
                                                                        />
                                                                    ))
                                                                }
                                                            </div>
                                                            {isCurrent && (
                                                                <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--color-gold)' }}>
                                                                    ← now
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex gap-4 text-xs pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                                {[
                                                    { label: 'Done',     bg: 'var(--chart-2)'                 },
                                                    { label: 'Skipped',  bg: 'rgba(239,68,68,0.55)'    },
                                                    { label: 'Upcoming', bg: 'rgba(255,255,255,0.18)'  },
                                                ].map(({ label, bg }) => (
                                                    <span key={label} className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                                        <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ background: bg }} />
                                                        {label}
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Generation form ────────────────────────────────── */}
                    {showForm && (
                        <div
                            className="p-5 rounded-2xl border space-y-4"
                            style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>New 12-Week Program</h3>
                                <button onClick={() => setShowForm(false)} className="p-1">
                                    <X className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                                </button>
                            </div>

                            {/* Goal */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
                                    Goal
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {GOALS.map(g => (
                                        <button
                                            key={g.id}
                                            onClick={() => setProgramGoal(g.id)}
                                            className="p-3 rounded-xl text-left transition-all border"
                                            style={
                                                programGoal === g.id
                                                    ? { background: 'var(--color-gold-muted)', borderColor: 'var(--color-gold)' }
                                                    : { background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-light)' }
                                            }
                                        >
                                            <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{g.label}</p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{g.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Days per week */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
                                    Days per week
                                </label>
                                <div className="flex gap-2">
                                    {[3, 4, 5, 6].map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setProgramDays(d)}
                                            className="flex-1 py-2 rounded-xl font-bold text-sm transition-all"
                                            style={
                                                programDays === d
                                                    ? { background: 'var(--color-primary)', color: 'white' }
                                                    : { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }
                                            }
                                        >
                                            {d}×
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Equipment preview */}
                            <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-light)' }}>
                                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                    Equipment (from Settings)
                                </p>
                                {userEquipment.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {userEquipment.map(e => (
                                            <span
                                                key={e}
                                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                style={{ background: 'rgba(77,137,226,0.1)', color: 'var(--color-primary)' }}
                                            >
                                                {e}
                                            </span>
                                        ))}
                                        <span
                                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                                            style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' }}
                                        >
                                            + Bodyweight
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        No equipment set — will use standard gym + bodyweight. Add yours in Settings → Home Equipment.
                                    </p>
                                )}
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
                                    Notes (optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. bad knees, focus on upper body, no overhead pressing"
                                    value={programNotes}
                                    onChange={e => setProgramNotes(e.target.value)}
                                    className="w-full p-3 rounded-xl text-sm outline-none"
                                    style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                />
                            </div>

                            <button
                                disabled={generating}
                                onClick={handleGenerate}
                                className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-[0.98]"
                                style={{ background: 'var(--color-primary)' }}
                            >
                                {generating
                                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating (20–30s)…</>
                                    : <><Sparkles className="w-5 h-5" /> Generate Program</>
                                }
                            </button>
                        </div>
                    )}

                    {/* ── No programs yet ────────────────────────────────── */}
                    {!showForm && programs.length === 0 && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="w-full p-6 rounded-2xl border-2 border-dashed flex flex-col items-center gap-3 transition-all active:scale-[0.98]"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                        >
                            <div className="p-3 rounded-2xl" style={{ background: 'var(--color-gold-muted)' }}>
                                <Trophy className="w-8 h-8" style={{ color: 'var(--color-gold)' }} />
                            </div>
                            <div className="text-center">
                                <p className="font-bold" style={{ color: 'var(--color-text)' }}>Generate your first program</p>
                                <p className="text-sm mt-1">AI builds a full 12-week plan tailored to your goal</p>
                            </div>
                        </button>
                    )}

                    {/* ── Other programs ─────────────────────────────────── */}
                    {otherPrograms.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                Other Programs
                            </p>
                            {otherPrograms.map(prog => (
                                <div
                                    key={prog.id}
                                    className="p-4 rounded-2xl border flex items-center justify-between gap-3"
                                    style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                                >
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>{prog.name}</p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                            {prog.duration_weeks} weeks · {prog.goal}
                                            {prog.status === 'completed' && ' · Completed'}
                                            {prog.status === 'paused'    && ' · Paused'}
                                            {prog.status === 'draft'     && ' · Draft'}
                                        </p>
                                        {/* Compact progress bar */}
                                        {programStats[prog.id]?.total > 0 && (
                                            <div className="mt-1.5 h-1 rounded-full w-32" style={{ background: 'var(--color-bg-subtle)' }}>
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{ background: 'var(--color-primary)', width: `${programProgress(prog)}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => setReviewingProgram(prog)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold"
                                            style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                                        >
                                            Review
                                        </button>
                                        {prog.status === 'paused' ? (
                                            <button
                                                onClick={() => handleResume(prog)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                                                style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--chart-5)', border: '1px solid rgba(249,115,22,0.3)' }}
                                            >
                                                <Play className="w-3 h-3" /> Resume
                                            </button>
                                        ) : prog.status === 'draft' ? (
                                            <button
                                                onClick={() => handleActivate(prog)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                                                style={{ background: 'var(--color-primary)', color: 'white' }}
                                            >
                                                Activate
                                            </button>
                                        ) : null}
                                        <button
                                            onClick={() => handleDelete(prog.id)}
                                            className="p-1.5 rounded-lg"
                                            style={{ color: 'var(--color-danger)', background: 'rgba(239,68,68,0.08)' }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </main>

        {/* Review modal */}
        {reviewingProgram && (
            <ProgramReviewModal
                program={reviewingProgram}
                onClose={() => setReviewingProgram(null)}
                onScheduled={() => {
                    setReviewingProgram(null);
                    loadData();
                    toast.success('Program scheduled! Sessions are now on your calendar.');
                }}
            />
        )}
        </>
    );
}
