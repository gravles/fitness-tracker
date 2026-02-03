'use client';

import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay, isToday, isBefore } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, Dumbbell, Play, X, Trash2, Loader2 } from 'lucide-react';
import { getScheduledWorkouts, deleteScheduledWorkout, skipScheduledWorkout, ScheduledWorkout } from '@/lib/schedule-api';
import { getTemplates } from '@/lib/workout-api';
import { ScheduleWorkoutModal } from '@/components/ScheduleWorkoutModal';
import { useRouter } from 'next/navigation';
import { haptics } from '@/lib/haptics';

export default function SchedulePage() {
    const router = useRouter();
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
    const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkout[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const weekDays = eachDayOfInterval({
        start: currentWeekStart,
        end: addDays(currentWeekStart, 6),
    });

    useEffect(() => {
        loadData();
    }, [currentWeekStart]);

    async function loadData() {
        setLoading(true);
        try {
            const startStr = format(currentWeekStart, 'yyyy-MM-dd');
            const endStr = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');

            const [workouts, templateData] = await Promise.all([
                getScheduledWorkouts(startStr, endStr),
                getTemplates(),
            ]);

            setScheduledWorkouts(workouts);
            setTemplates(templateData);
        } catch (error) {
            console.error('Error loading schedule:', error);
        } finally {
            setLoading(false);
        }
    }

    function getWorkoutsForDay(day: Date) {
        const dayStr = format(day, 'yyyy-MM-dd');
        return scheduledWorkouts.filter(w => w.scheduled_date === dayStr);
    }

    function handlePrevWeek() {
        haptics.tap();
        setCurrentWeekStart(addDays(currentWeekStart, -7));
    }

    function handleNextWeek() {
        haptics.tap();
        setCurrentWeekStart(addDays(currentWeekStart, 7));
    }

    function handleDayClick(day: Date) {
        haptics.tap();
        setSelectedDate(day);
        setShowModal(true);
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this scheduled workout?')) return;
        haptics.tap();
        try {
            await deleteScheduledWorkout(id);
            setScheduledWorkouts(prev => prev.filter(w => w.id !== id));
        } catch (error) {
            console.error('Error deleting workout:', error);
        }
    }

    async function handleSkip(id: string) {
        haptics.tap();
        try {
            await skipScheduledWorkout(id);
            setScheduledWorkouts(prev =>
                prev.map(w => w.id === id ? { ...w, status: 'skipped' as const } : w)
            );
        } catch (error) {
            console.error('Error skipping workout:', error);
        }
    }

    function handleStartWorkout(workout: ScheduledWorkout) {
        haptics.success();
        if (workout.template_id) {
            router.push(`/workout/active/new?template=${workout.template_id}&schedule=${workout.id}`);
        } else {
            router.push(`/workout/active/new?schedule=${workout.id}`);
        }
    }

    function handleModalClose() {
        setShowModal(false);
        setSelectedDate(null);
    }

    function handleWorkoutScheduled() {
        setShowModal(false);
        setSelectedDate(null);
        loadData();
    }

    return (
        <main className="p-6 pt-12 pb-24 space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <header className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Schedule</h1>
                <button
                    onClick={() => { setSelectedDate(new Date()); setShowModal(true); }}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Schedule
                </button>
            </header>

            {/* Week Navigation */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <button
                    onClick={handlePrevWeek}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>

                <div className="text-center">
                    <span className="font-bold text-gray-900">
                        {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                    </span>
                </div>

                <button
                    onClick={handleNextWeek}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
            </div>

            {/* Week View */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                )}

                <div className="grid grid-cols-7 border-b border-gray-100">
                    {weekDays.map(day => (
                        <button
                            key={day.toString()}
                            onClick={() => handleDayClick(day)}
                            className={`p-3 text-center border-r border-gray-100 last:border-r-0 hover:bg-gray-50 transition-colors ${isToday(day) ? 'bg-blue-50' : ''
                                }`}
                        >
                            <div className={`text-xs font-bold uppercase ${isToday(day) ? 'text-blue-600' : 'text-gray-400'
                                }`}>
                                {format(day, 'EEE')}
                            </div>
                            <div className={`text-lg font-bold mt-1 ${isToday(day) ? 'text-blue-600' : 'text-gray-900'
                                }`}>
                                {format(day, 'd')}
                            </div>
                            {getWorkoutsForDay(day).length > 0 && (
                                <div className="flex justify-center mt-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Daily Detail */}
                <div className="divide-y divide-gray-100">
                    {weekDays.map(day => {
                        const dayWorkouts = getWorkoutsForDay(day);
                        if (dayWorkouts.length === 0) return null;

                        return (
                            <div key={day.toString()} className="p-4">
                                <div className={`text-sm font-bold mb-3 ${isToday(day) ? 'text-blue-600' : 'text-gray-500'
                                    }`}>
                                    {format(day, 'EEEE, MMM d')}
                                    {isToday(day) && <span className="ml-2 text-blue-500">• Today</span>}
                                </div>

                                <div className="space-y-2">
                                    {dayWorkouts.map(workout => (
                                        <div
                                            key={workout.id}
                                            className={`flex items-center justify-between p-3 rounded-xl ${workout.status === 'completed'
                                                    ? 'bg-green-50 border border-green-200'
                                                    : workout.status === 'skipped'
                                                        ? 'bg-gray-50 border border-gray-200 opacity-60'
                                                        : 'bg-gray-50 border border-gray-200'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${workout.status === 'completed'
                                                        ? 'bg-green-100'
                                                        : 'bg-blue-100'
                                                    }`}>
                                                    <Dumbbell className={`w-4 h-4 ${workout.status === 'completed'
                                                            ? 'text-green-600'
                                                            : 'text-blue-600'
                                                        }`} />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{workout.title}</div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {workout.scheduled_time.slice(0, 5)}
                                                        {workout.status === 'completed' && (
                                                            <span className="ml-2 text-green-600">✓ Completed</span>
                                                        )}
                                                        {workout.status === 'skipped' && (
                                                            <span className="ml-2 text-gray-500">Skipped</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {workout.status === 'scheduled' && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleStartWorkout(workout)}
                                                        className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                                        title="Start workout"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSkip(workout.id)}
                                                        className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                                                        title="Skip"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(workout.id)}
                                                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
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

                    {scheduledWorkouts.length === 0 && !loading && (
                        <div className="p-8 text-center text-gray-500">
                            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="font-medium">No workouts scheduled this week</p>
                            <p className="text-sm mt-1">Tap a day or use the button above to schedule</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-2xl border border-green-200">
                    <div className="text-2xl font-black text-green-700">
                        {scheduledWorkouts.filter(w => w.status === 'completed').length}
                    </div>
                    <div className="text-sm font-medium text-green-600">Completed this week</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-2xl border border-blue-200">
                    <div className="text-2xl font-black text-blue-700">
                        {scheduledWorkouts.filter(w => w.status === 'scheduled').length}
                    </div>
                    <div className="text-sm font-medium text-blue-600">Upcoming</div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <ScheduleWorkoutModal
                    selectedDate={selectedDate}
                    templates={templates}
                    onClose={handleModalClose}
                    onScheduled={handleWorkoutScheduled}
                />
            )}
        </main>
    );
}
