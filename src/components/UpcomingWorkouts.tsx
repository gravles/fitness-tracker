'use client';

import { useState, useEffect } from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { Calendar, Clock, Dumbbell, ChevronRight, Play } from 'lucide-react';
import { getUpcomingWorkouts, ScheduledWorkout } from '@/lib/schedule-api';
import { useRouter } from 'next/navigation';
import { haptics } from '@/lib/haptics';

export function UpcomingWorkouts() {
    const router = useRouter();
    const [workouts, setWorkouts] = useState<ScheduledWorkout[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadWorkouts();
    }, []);

    async function loadWorkouts() {
        try {
            const data = await getUpcomingWorkouts(3);
            setWorkouts(data);
        } catch (error) {
            console.error('Error loading upcoming workouts:', error);
        } finally {
            setLoading(false);
        }
    }

    function formatDate(dateStr: string) {
        const date = new Date(dateStr + 'T00:00:00');
        if (isToday(date)) return 'Today';
        if (isTomorrow(date)) return 'Tomorrow';
        return format(date, 'EEE, MMM d');
    }

    function handleStartWorkout(workout: ScheduledWorkout) {
        haptics.success();
        if (workout.template_id) {
            router.push(`/workout/active/new?template=${workout.template_id}&schedule=${workout.id}`);
        } else {
            router.push(`/workout/active/new?schedule=${workout.id}`);
        }
    }

    if (loading) {
        return (
            <div className="bg-[var(--color-surface-elevated)] p-4 rounded-2xl border border-[var(--color-border-light)] shadow-sm animate-pulse">
                <div className="h-5 bg-[var(--color-bg-muted)] rounded w-40 mb-3" />
                <div className="space-y-2">
                    <div className="h-16 bg-[var(--color-bg-subtle)] rounded-xl" />
                    <div className="h-16 bg-[var(--color-bg-subtle)] rounded-xl" />
                </div>
            </div>
        );
    }

    if (workouts.length === 0) {
        return (
            <div
                onClick={() => { haptics.tap(); router.push('/schedule'); }}
                className="bg-[var(--color-surface-elevated)] p-4 rounded-2xl border border-[var(--color-border-light)] shadow-sm cursor-pointer hover:border-[var(--color-primary)]/30 hover:shadow-md transition-all"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--color-primary)]/10 rounded-xl">
                            <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <div>
                            <p className="font-bold text-[var(--color-text)]">Schedule Your Workouts</p>
                            <p className="text-sm text-[var(--color-text-muted)]">Plan ahead and stay consistent</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[var(--color-surface-elevated)] rounded-2xl border border-[var(--color-border-light)] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-light)]">
                <h3 className="font-bold text-[var(--color-text)]">Upcoming Workouts</h3>
                <button
                    onClick={() => { haptics.tap(); router.push('/schedule'); }}
                    className="text-sm font-semibold text-[var(--color-primary)] hover:opacity-80 transition-opacity"
                >
                    View All
                </button>
            </div>

            <div className="divide-y divide-[var(--color-border-light)]">
                {workouts.map(workout => (
                    <div
                        key={workout.id}
                        className="flex items-center justify-between p-4 hover:bg-[var(--color-bg-subtle)] transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                                <Dumbbell className="w-4 h-4 text-green-500" />
                            </div>
                            <div>
                                <div className="font-medium text-[var(--color-text)]">{workout.title}</div>
                                <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
                                    <span>{formatDate(workout.scheduled_date)}</span>
                                    <span>•</span>
                                    <Clock className="w-3 h-3" />
                                    <span>{workout.scheduled_time.slice(0, 5)}</span>
                                </div>
                            </div>
                        </div>

                        {isToday(new Date(workout.scheduled_date + 'T00:00:00')) && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleStartWorkout(workout); }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition-colors"
                            >
                                <Play className="w-3 h-3" />
                                Start
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
