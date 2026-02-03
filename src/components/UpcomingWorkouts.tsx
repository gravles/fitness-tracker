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
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-40 mb-3" />
                <div className="space-y-2">
                    <div className="h-16 bg-gray-100 rounded-xl" />
                    <div className="h-16 bg-gray-100 rounded-xl" />
                </div>
            </div>
        );
    }

    if (workouts.length === 0) {
        return (
            <div
                onClick={() => { haptics.tap(); router.push('/schedule'); }}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100 cursor-pointer hover:shadow-md transition-shadow"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-xl">
                            <Calendar className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">Schedule Your Workouts</p>
                            <p className="text-sm text-gray-500">Plan ahead and stay consistent</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Upcoming Workouts</h3>
                <button
                    onClick={() => { haptics.tap(); router.push('/schedule'); }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    View All
                </button>
            </div>

            <div className="divide-y divide-gray-100">
                {workouts.map(workout => (
                    <div
                        key={workout.id}
                        className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Dumbbell className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                                <div className="font-medium text-gray-900">{workout.title}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
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
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
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
