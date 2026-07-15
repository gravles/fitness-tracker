'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, TrendingUp } from 'lucide-react';
import { getExerciseHistory } from '@/lib/workout-api';
import { format, parseISO } from 'date-fns';
import { Modal } from './ui/Modal';

interface Props {
    exerciseName: string;
    onClose: () => void;
}

export function ExerciseHistoryModal({ exerciseName, onClose }: Props) {
    const [history, setHistory] = useState<{ date: string; sets: any[] }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getExerciseHistory(exerciseName)
            .then(setHistory)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [exerciseName]);

    function bestSet(sets: any[]) {
        return sets.reduce((best, s) =>
            (s.weight * s.reps > best.weight * best.reps ? s : best), sets[0]);
    }

    return (
        <Modal isOpen onClose={onClose} aria-label={`${exerciseName} history`} size="lg" padding={false} className="flex flex-col max-h-[85dvh]">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-[var(--color-border)] rounded-full" />
                </div>

                {/* Header */}
                <div className="px-5 pt-2 pb-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
                            <h3 className="font-bold text-lg text-[var(--color-text)]">{exerciseName}</h3>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Past 10 sessions</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-[var(--color-bg-subtle)] transition-colors focus-ring">
                        <X className="w-5 h-5 text-[var(--color-text-muted)]" aria-hidden="true" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-4 space-y-3">
                    {loading && (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                        </div>
                    )}

                    {!loading && history.length === 0 && (
                        <div className="text-center py-12 text-[var(--color-text-muted)]">
                            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No history yet</p>
                            <p className="text-sm">Complete a set to start tracking progress</p>
                        </div>
                    )}

                    {!loading && history.map((session, i) => {
                        const best = bestSet(session.sets);
                        const dateStr = format(parseISO(session.date), 'MMM d, yyyy');
                        return (
                            <div key={i} className="bg-[var(--color-bg-subtle)] rounded-2xl p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-sm font-bold text-[var(--color-text)]">{dateStr}</span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(77,137,226,0.1)', color: 'var(--color-primary)' }}>
                                        Best: {best.weight}lbs × {best.reps}
                                    </span>
                                </div>
                                <div className="space-y-1.5">
                                    {session.sets.map((s, si) => (
                                        <div key={si} className="flex items-center gap-3 text-sm">
                                            <span className="w-6 h-6 bg-[var(--color-border)] rounded-full flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)] shrink-0">
                                                {s.set_number}
                                            </span>
                                            <span className="text-[var(--color-text)] font-medium">
                                                {s.weight} lbs × {s.reps} reps
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="h-6" />
        </Modal>
    );
}
