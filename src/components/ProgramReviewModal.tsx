'use client';

import { useState, useRef, useEffect } from 'react';
import { format, addWeeks, nextMonday } from 'date-fns';
import { X, ChevronDown, ChevronRight, Sparkles, Send, Loader2, CalendarDays, Check, Bot, User } from 'lucide-react';
import { TrainingProgram } from '@/lib/api';
import { scheduleProgramToCalendar } from '@/lib/schedule-api';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Props {
    program: TrainingProgram;
    onClose: () => void;
    onScheduled: () => void;
}

type Tab = 'program' | 'edit';

interface EditMessage {
    role: 'user' | 'assistant';
    content: string;
}

const PHASE_COLORS: Record<string, string> = {
    Accumulation:    'var(--color-primary)',
    Intensification: '#f97316',
    Realisation:     '#a855f7',
    Deload:          'var(--color-success)',
};

export function ProgramReviewModal({ program, onClose, onScheduled }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('program');
    const [currentProgram, setCurrentProgram] = useState<TrainingProgram>(program);
    const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['Accumulation']));
    const [editMessages, setEditMessages] = useState<EditMessage[]>([]);
    const [editInput, setEditInput] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [showSchedulePanel, setShowSchedulePanel] = useState(false);
    const [startDate, setStartDate] = useState(() => format(nextMonday(new Date()), 'yyyy-MM-dd'));
    const [scheduling, setScheduling] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [editMessages]);

    // Group weeks by phase
    const phases = currentProgram.phases || [];
    const weeksByPhase: Record<string, any[]> = {};
    for (const week of currentProgram.weeks || []) {
        if (!weeksByPhase[week.phase]) weeksByPhase[week.phase] = [];
        weeksByPhase[week.phase].push(week);
    }

    async function handleAIEdit() {
        const msg = editInput.trim();
        if (!msg || editLoading) return;
        setEditInput('');
        setEditMessages(prev => [...prev, { role: 'user', content: msg }]);
        setEditLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/ai/edit-program', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                body: JSON.stringify({ program: currentProgram, message: msg }),
            });
            if (!res.ok) throw new Error(await res.text());
            const { program: updated } = await res.json();
            setCurrentProgram(updated);
            setEditMessages(prev => [...prev, { role: 'assistant', content: '✅ Done! I\'ve updated the program. Switch to the Program tab to review the changes.' }]);
        } catch (e: any) {
            setEditMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I couldn't apply that change: ${e.message}` }]);
        } finally {
            setEditLoading(false);
        }
    }

    async function handleSchedule() {
        setScheduling(true);
        try {
            const start = new Date(startDate + 'T00:00:00');
            const count = await scheduleProgramToCalendar(currentProgram.id, currentProgram.weeks, start);

            // Save any AI edits back to DB
            const { data: { session } } = await supabase.auth.getSession();
            await fetch(`/api/programs/${currentProgram.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                body: JSON.stringify({ weeks: currentProgram.weeks, started_at: startDate }),
            }).catch(() => {}); // best-effort save

            // Update started_at via supabase directly
            await supabase
                .from('training_programs')
                .update({ started_at: startDate })
                .eq('id', currentProgram.id);

            toast.success(`Scheduled ${count} sessions to your calendar!`);
            onScheduled();
        } catch (e: any) {
            toast.error('Failed to schedule: ' + e.message);
        } finally {
            setScheduling(false);
        }
    }

    const totalSessions = (currentProgram.weeks || []).reduce((acc, w) =>
        acc + (w.days || []).filter((d: any) => d.exercises?.length > 0).length, 0
    );
    const endDateStr = format(addWeeks(new Date(startDate + 'T00:00:00'), currentProgram.duration_weeks), 'MMM d, yyyy');

    return (
        <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: 'var(--color-bg)' }}>
            {/* Header */}
            <div
                className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-elevated)' }}
            >
                <button onClick={onClose} className="p-2 rounded-xl transition-all active:scale-90" style={{ color: 'var(--color-text-muted)' }}>
                    <X className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>{currentProgram.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {currentProgram.duration_weeks} weeks · {totalSessions} sessions
                    </p>
                </div>
                <button
                    onClick={() => setShowSchedulePanel(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm transition-all active:scale-95"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    <CalendarDays className="w-4 h-4" />
                    Schedule
                </button>
            </div>

            {/* Tabs */}
            <div
                className="flex-shrink-0 flex border-b"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-elevated)' }}
            >
                {([['program', '📋 Program'], ['edit', '✨ Edit with AI']] as const).map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className="flex-1 py-3 text-sm font-bold transition-all relative"
                        style={{ color: activeTab === id ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                    >
                        {label}
                        {activeTab === id && (
                            <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
                        )}
                    </button>
                ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">

                {/* ── PROGRAM TAB ── */}
                {activeTab === 'program' && (
                    <div className="p-4 space-y-3 pb-8">
                        {phases.map(phase => {
                            const phaseWeeks = weeksByPhase[phase.name] || [];
                            const isExpanded = expandedPhases.has(phase.name);
                            const color = PHASE_COLORS[phase.name] || 'var(--color-primary)';

                            return (
                                <div key={phase.name} className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--color-border-light)' }}>
                                    {/* Phase header */}
                                    <button
                                        onClick={() => setExpandedPhases(prev => {
                                            const next = new Set(prev);
                                            isExpanded ? next.delete(phase.name) : next.add(phase.name);
                                            return next;
                                        })}
                                        className="w-full flex items-center justify-between p-4"
                                        style={{ background: 'var(--color-surface-elevated)' }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                                            <div className="text-left">
                                                <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{phase.name}</p>
                                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                    Weeks {phase.weeks} · {phase.description}
                                                </p>
                                            </div>
                                        </div>
                                        {isExpanded
                                            ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                                            : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                                        }
                                    </button>

                                    {isExpanded && (
                                        <div className="divide-y" style={{ borderColor: 'var(--color-border-light)' }}>
                                            {phaseWeeks.map((week: any) => {
                                                const trainingDays = (week.days || []).filter((d: any) => d.exercises?.length > 0);
                                                return (
                                                    <div key={week.week} className="p-4 space-y-3" style={{ background: 'var(--color-bg)' }}>
                                                        <div className="flex items-center justify-between">
                                                            <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>
                                                                Week {week.week}
                                                            </p>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                                                                    {Math.round((week.volume_modifier || 1) * 100)}% volume
                                                                </span>
                                                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-subtle)', color }}>
                                                                    {week.days?.[0]?.exercises?.[0]?.load_pct ?? '—'}% load
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                            {trainingDays.map((day: any) => (
                                                                <div
                                                                    key={day.day}
                                                                    className="p-3 rounded-xl"
                                                                    style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-light)' }}
                                                                >
                                                                    <p className="font-bold text-xs mb-2" style={{ color }}>
                                                                        Day {day.day} · {day.label}
                                                                    </p>
                                                                    <div className="space-y-0.5">
                                                                        {(day.exercises || []).map((ex: any, i: number) => (
                                                                            <p key={i} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                                                <span style={{ color: 'var(--color-text)' }}>{ex.name}</span>
                                                                                {' '}{ex.sets}×{ex.reps}
                                                                                {ex.load_pct ? <span style={{ color: 'var(--color-text-muted)' }}> @ {ex.load_pct}%</span> : null}
                                                                            </p>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── EDIT WITH AI TAB ── */}
                {activeTab === 'edit' && (
                    <div className="flex flex-col h-full">
                        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                            {editMessages.length === 0 && (
                                <div className="py-8 text-center space-y-3">
                                    <Sparkles className="w-10 h-10 mx-auto" style={{ color: 'var(--color-gold)' }} />
                                    <p className="font-bold" style={{ color: 'var(--color-text)' }}>Edit your program with AI</p>
                                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                        Describe what you&apos;d like to change and the AI will modify the program for you.
                                    </p>
                                    <div className="space-y-2 text-left max-w-xs mx-auto">
                                        {[
                                            'Swap all barbell exercises for dumbbell alternatives',
                                            'Add more bicep work to Upper A days',
                                            'Make the squat the main lower body lift',
                                            'Replace running with rowing for cardio',
                                        ].map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setEditInput(s)}
                                                className="w-full text-left text-xs p-2.5 rounded-xl border transition-all active:scale-95"
                                                style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                                            >
                                                &ldquo;{s}&rdquo;
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {editMessages.map((msg, i) => (
                                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-gold-muted)' }}
                                    >
                                        {msg.role === 'user'
                                            ? <User className="w-3.5 h-3.5 text-white" />
                                            : <Bot className="w-3.5 h-3.5" style={{ color: 'var(--color-gold)' }} />
                                        }
                                    </div>
                                    <div
                                        className="max-w-[80%] px-3 py-2 rounded-2xl text-sm"
                                        style={{
                                            background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface-elevated)',
                                            color: msg.role === 'user' ? 'white' : 'var(--color-text)',
                                            borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                        }}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {editLoading && (
                                <div className="flex gap-2">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--color-gold-muted)' }}>
                                        <Bot className="w-3.5 h-3.5" style={{ color: 'var(--color-gold)' }} />
                                    </div>
                                    <div className="px-3 py-2 rounded-2xl" style={{ background: 'var(--color-surface-elevated)' }}>
                                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={chatBottomRef} />
                        </div>

                        {/* AI input — sticky at bottom of edit tab */}
                        <div
                            className="flex-shrink-0 p-4 border-t"
                            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-elevated)' }}
                        >
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="e.g. Swap bench press for dumbbell press..."
                                    value={editInput}
                                    onChange={e => setEditInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAIEdit()}
                                    disabled={editLoading}
                                    className="flex-1 p-3 rounded-xl text-sm outline-none"
                                    style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                />
                                <button
                                    onClick={handleAIEdit}
                                    disabled={!editInput.trim() || editLoading}
                                    className="p-3 rounded-xl transition-all active:scale-95 disabled:opacity-40"
                                    style={{ background: 'var(--color-primary)', color: 'white' }}
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── SCHEDULE PANEL OVERLAY ── */}
            {showSchedulePanel && (
                <div className="absolute inset-0 z-10 flex items-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div
                        className="w-full rounded-t-3xl p-6 space-y-5"
                        style={{ background: 'var(--color-surface-elevated)' }}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
                                Approve &amp; Schedule
                            </h3>
                            <button onClick={() => setShowSchedulePanel(false)}>
                                <X className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full p-3 rounded-xl outline-none text-sm"
                                style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                            />
                        </div>

                        {/* Preview */}
                        <div className="p-4 rounded-2xl space-y-2" style={{ background: 'var(--color-bg-subtle)' }}>
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                    {totalSessions} sessions added to your calendar
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                    Runs {startDate ? format(new Date(startDate + 'T00:00:00'), 'MMM d') : '—'} → {endDateStr}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                    Exercises pre-loaded in each session
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleSchedule}
                            disabled={scheduling || !startDate}
                            className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-[0.98]"
                            style={{ background: 'var(--color-primary)', color: 'white' }}
                        >
                            {scheduling
                                ? <><Loader2 className="w-5 h-5 animate-spin" /> Scheduling…</>
                                : <><CalendarDays className="w-5 h-5" /> Confirm &amp; Schedule</>
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
