'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, TrendingUp } from 'lucide-react';
import { getExerciseHistory } from '@/lib/workout-api';
import { format, parseISO } from 'date-fns';

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

    // Best set per session (highest weight × reps)
    function bestSet(sets: any[]) {
        return sets.reduce((best, s) =>
            (s.weight * s.reps > best.weight * best.reps ? s : best), sets[0]);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
            <div
                className="w-full bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-4 max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-5 pt-2 pb-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                            <h3 className="font-bold text-lg text-gray-900">{exerciseName}</h3>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Past 10 sessions</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-4 space-y-3">
                    {loading && (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    )}

                    {!loading && history.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No history yet</p>
                            <p className="text-sm">Complete a set to start tracking progress</p>
                        </div>
                    )}

                    {!loading && history.map((session, i) => {
                        const best = bestSet(session.sets);
                        const dateStr = format(parseISO(session.date), 'MMM d, yyyy');
                        return (
                            <div key={i} className="bg-gray-50 rounded-2xl p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-sm font-bold text-gray-700">{dateStr}</span>
                                    <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                                        Best: {best.weight}lbs × {best.reps}
                                    </span>
                                </div>
                                <div className="space-y-1.5">
                                    {session.sets.map((s, si) => (
                                        <div key={si} className="flex items-center gap-3 text-sm">
                                            <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                                                {s.set_number}
                                            </span>
                                            <span className="text-gray-800 font-medium">
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
            </div>
        </div>
    );
}
