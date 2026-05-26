'use client';

/**
 * DriveMode
 *
 * A full-screen overlay designed for Android Automotive head units.
 * AAOS guidelines: ≥ 76dp tap targets, ≤ 4 actions visible at once,
 * no text input while driving.
 *
 * Usage:
 *   <DriveModeSchedule workouts={todayWorkouts} sessions={todaySessions} ... />
 *   <DriveModeLog date={date} />
 */

import { format } from 'date-fns';
import { Play, X, Car, Calendar, Clock } from 'lucide-react';
import type { ScheduledWorkout } from '@/lib/schedule-api';
import type { ProgramSession } from '@/lib/program-api';

// ─── Shared header strip ────────────────────────────────────────────────────

function DriveModeHeader({ onExit }: { onExit: () => void }) {
    return (
        <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: 'var(--color-border-light)' }}
        >
            <div className="flex items-center gap-3">
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--color-gold-muted)' }}
                >
                    <Car className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
                </div>
                <span className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
                    Car Mode
                </span>
            </div>
            <button
                onClick={onExit}
                className="drive-tap px-6"
                style={{
                    background: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                    minHeight: '56px',
                    fontSize: '1rem',
                }}
            >
                <X className="w-5 h-5 mr-2" />
                Exit
            </button>
        </div>
    );
}

// ─── Schedule DriveMode ──────────────────────────────────────────────────────

interface DriveModeScheduleProps {
    workouts:  ScheduledWorkout[];
    sessions:  ProgramSession[];
    onStart:   (workout: ScheduledWorkout) => void;
    onStartSession: (session: ProgramSession) => void;
    onExit:    () => void;
}

export function DriveModeSchedule({
    workouts, sessions, onStart, onStartSession, onExit,
}: DriveModeScheduleProps) {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayLabel = format(new Date(), 'EEEE, MMMM d');

    const todayWorkouts = workouts.filter(w => w.scheduled_date === todayStr && w.status === 'scheduled');
    const todaySessions = sessions.filter(s =>
        s.scheduled_date === todayStr && (s.status === 'upcoming' || s.status === 'rescheduled')
    );
    const allItems = [...todaySessions, ...todayWorkouts];

    return (
        <div className="drive-overlay">
            <DriveModeHeader onExit={onExit} />

            <div className="px-6 py-5" style={{ maxWidth: 900, margin: '0 auto' }}>
                {/* Date */}
                <p className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>
                    {todayLabel}
                </p>

                {allItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Calendar className="w-16 h-16" style={{ color: 'var(--color-border)' }} />
                        <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                            No workouts scheduled today
                        </p>
                        <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
                            Check back tomorrow or tap Exit to browse the full schedule.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Program sessions */}
                        {todaySessions.map(session => (
                            <div
                                key={session.id}
                                className="flex items-center justify-between p-5 rounded-2xl border"
                                style={{
                                    background: 'var(--color-surface-elevated)',
                                    borderColor: 'var(--color-border-light)',
                                    minHeight: 90,
                                }}
                            >
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="text-xs font-bold uppercase tracking-wider mb-1"
                                        style={{ color: 'var(--color-primary)' }}>
                                        Program · Week {session.week_number}
                                    </div>
                                    <div className="text-xl font-bold truncate" style={{ color: 'var(--color-text)' }}>
                                        {session.day_label}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-base"
                                        style={{ color: 'var(--color-text-muted)' }}>
                                        <Clock className="w-4 h-4" />
                                        {(session.scheduled_time ?? '12:00:00').slice(0, 5)}
                                        <span>·</span>
                                        {session.exercises?.length ?? 0} exercises
                                    </div>
                                </div>
                                <button
                                    onClick={() => onStartSession(session)}
                                    className="drive-tap px-8"
                                    style={{ background: 'var(--color-success)', color: 'white', gap: '0.5rem' }}
                                >
                                    <Play className="w-6 h-6" />
                                    Start
                                </button>
                            </div>
                        ))}

                        {/* Ad-hoc scheduled workouts */}
                        {todayWorkouts.map(workout => (
                            <div
                                key={workout.id}
                                className="flex items-center justify-between p-5 rounded-2xl border"
                                style={{
                                    background: 'var(--color-surface-elevated)',
                                    borderColor: 'var(--color-border-light)',
                                    minHeight: 90,
                                }}
                            >
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="text-xl font-bold truncate" style={{ color: 'var(--color-text)' }}>
                                        {workout.title}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-base"
                                        style={{ color: 'var(--color-text-muted)' }}>
                                        <Clock className="w-4 h-4" />
                                        {workout.scheduled_time.slice(0, 5)}
                                    </div>
                                </div>
                                <button
                                    onClick={() => onStart(workout)}
                                    className="drive-tap px-8"
                                    style={{ background: 'var(--color-success)', color: 'white', gap: '0.5rem' }}
                                >
                                    <Play className="w-6 h-6" />
                                    Start
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Log DriveMode ───────────────────────────────────────────────────────────

interface DriveModeLogProps {
    onExit: () => void;
}

/**
 * In log drive-mode we don't allow text entry (distracted driving).
 * We show a big banner telling the user to pull over to log food,
 * but provide one-tap movement / nutrition confirmation buttons.
 */
export function DriveModeLog({ onExit }: DriveModeLogProps) {
    return (
        <div className="drive-overlay">
            <DriveModeHeader onExit={onExit} />

            <div
                className="px-6 py-8 flex flex-col gap-6"
                style={{ maxWidth: 900, margin: '0 auto' }}
            >
                {/* Info banner */}
                <div
                    className="p-5 rounded-2xl border"
                    style={{
                        background: 'rgba(201,168,76,0.06)',
                        borderColor: 'rgba(201,168,76,0.25)',
                    }}
                >
                    <p className="text-lg font-bold" style={{ color: 'var(--color-gold)' }}>
                        Detailed logging disabled while driving
                    </p>
                    <p className="text-base mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Pull over or park to log meals and track nutrition. You can still mark
                        today&apos;s movement as done below.
                    </p>
                </div>

                {/* Exit to full log */}
                <button
                    onClick={onExit}
                    className="drive-tap justify-center"
                    style={{
                        background: 'var(--color-primary)',
                        color: 'white',
                        gap: '0.75rem',
                    }}
                >
                    <Calendar className="w-6 h-6" />
                    Open Full Log
                </button>
            </div>
        </div>
    );
}
