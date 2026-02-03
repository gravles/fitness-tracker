'use client';

import { useState, useEffect, useRef } from 'react';
import { format, addDays, startOfWeek, eachDayOfInterval, isToday } from 'date-fns';
import {
    ChevronLeft, ChevronRight, Plus, Calendar, Clock, Dumbbell, Play, X, Trash2,
    Loader2, LayoutGrid, Edit2, Sparkles, Star, MoreVertical, Copy, Check, Eye, Zap, Bot
} from 'lucide-react';
import { getScheduledWorkouts, deleteScheduledWorkout, skipScheduledWorkout, ScheduledWorkout } from '@/lib/schedule-api';
import { getTemplates, createTemplate, deleteTemplate, updateTemplate, WorkoutTemplate } from '@/lib/workout-api';
import { getPublicTemplates, WorkoutTemplate as PublicTemplate, WorkoutCategory } from '@/lib/features';
import { ScheduleWorkoutModal } from '@/components/ScheduleWorkoutModal';
import { useRouter } from 'next/navigation';
import { haptics } from '@/lib/haptics';

type Tab = 'schedule' | 'templates' | 'discover';
type WorkoutCategoryFilter = WorkoutCategory | 'all';

const CATEGORIES: { value: WorkoutCategoryFilter; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: '🏋️' },
    { value: 'strength', label: 'Strength', icon: '💪' },
    { value: 'cardio', label: 'Cardio', icon: '🏃' },
    { value: 'hiit', label: 'HIIT', icon: '🔥' },
    { value: 'flexibility', label: 'Flexibility', icon: '🧘' },
];

// Common exercises for autocomplete
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

interface ExerciseItem {
    name: string;
    sets: number;
    reps: string;
}

interface AIRecommendation {
    title: string;
    exercises: { name: string; sets: number; reps: string }[];
    reason: string;
}

export default function WorkoutHubPage() {
    const router = useRouter();

    // Tab state
    const [activeTab, setActiveTab] = useState<Tab>('schedule');

    // Schedule state
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
    const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkout[]>([]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Templates state
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [publicTemplates, setPublicTemplates] = useState<PublicTemplate[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<WorkoutCategoryFilter>('all');

    // Template editor modal state
    const [showEditorModal, setShowEditorModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formExercises, setFormExercises] = useState<ExerciseItem[]>([]);
    const [exerciseInput, setExerciseInput] = useState('');
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Template preview modal state
    const [previewTemplate, setPreviewTemplate] = useState<WorkoutTemplate | PublicTemplate | null>(null);

    // Exercise autocomplete state
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteResults, setAutocompleteResults] = useState<string[]>([]);
    const autocompleteRef = useRef<HTMLDivElement>(null);

    // AI recommendations state
    const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // Loading state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const weekDays = eachDayOfInterval({
        start: currentWeekStart,
        end: addDays(currentWeekStart, 6),
    });

    useEffect(() => {
        loadData();
    }, [currentWeekStart, categoryFilter, activeTab]);

    // Close autocomplete when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
                setShowAutocomplete(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Update autocomplete results when input changes
    useEffect(() => {
        if (exerciseInput.trim().length > 0) {
            const filtered = COMMON_EXERCISES.filter(ex =>
                ex.toLowerCase().includes(exerciseInput.toLowerCase())
            ).slice(0, 6);
            setAutocompleteResults(filtered);
            setShowAutocomplete(filtered.length > 0);
        } else {
            setShowAutocomplete(false);
        }
    }, [exerciseInput]);

    async function loadData() {
        setLoading(true);
        try {
            const startStr = format(currentWeekStart, 'yyyy-MM-dd');
            const endStr = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');

            const [workouts, templateData, publicData] = await Promise.all([
                getScheduledWorkouts(startStr, endStr),
                getTemplates(),
                activeTab === 'discover' ? getPublicTemplates(categoryFilter === 'all' ? undefined : categoryFilter) : Promise.resolve([]),
            ]);

            setScheduledWorkouts(workouts);
            setTemplates(templateData);
            if (activeTab === 'discover') setPublicTemplates(publicData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function loadAIRecommendations() {
        setAiLoading(true);
        setAiError(null);
        try {
            const res = await fetch('/api/ai/recommend-workout', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to get recommendations');
            const data = await res.json();
            setAiRecommendations(data.recommendations || []);
        } catch (error) {
            console.error('Error loading AI recommendations:', error);
            setAiError('Unable to load recommendations');
        } finally {
            setAiLoading(false);
        }
    }

    function getWorkoutsForDay(day: Date) {
        const dayStr = format(day, 'yyyy-MM-dd');
        return scheduledWorkouts.filter(w => w.scheduled_date === dayStr);
    }

    // Schedule handlers
    function handlePrevWeek() { haptics.tap(); setCurrentWeekStart(addDays(currentWeekStart, -7)); }
    function handleNextWeek() { haptics.tap(); setCurrentWeekStart(addDays(currentWeekStart, 7)); }
    function handleDayClick(day: Date) { haptics.tap(); setSelectedDate(day); setShowScheduleModal(true); }

    async function handleDeleteScheduled(id: string) {
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

    // Template editor handlers
    function openCreateModal() {
        setEditingTemplate(null);
        setFormTitle('');
        setFormExercises([]);
        setShowEditorModal(true);
    }

    function openEditModal(template: WorkoutTemplate) {
        setEditingTemplate(template);
        setFormTitle(template.name);
        const exercises = (template.exercises || []).map((e: any) => ({
            name: e.name || e.exercise_name || '',
            sets: e.sets || e.target_sets || 3,
            reps: e.reps || e.target_reps || '10'
        }));
        setFormExercises(exercises);
        setShowEditorModal(true);
        setMenuOpen(null);
    }

    async function handleDuplicateTemplate(template: WorkoutTemplate) {
        haptics.tap();
        try {
            const exercises = (template.exercises || []).map((e: any) => ({
                exercise_name: e.name || e.exercise_name || '',
                target_sets: e.sets || e.target_sets || 3,
                target_reps: e.reps || e.target_reps || '10',
                order_index: 0
            }));
            await createTemplate(`${template.name} (Copy)`, exercises);
            loadData();
            setMenuOpen(null);
            haptics.success();
        } catch (error) {
            console.error('Error duplicating template:', error);
            haptics.error();
        }
    }

    async function handleSaveTemplate() {
        if (!formTitle.trim()) return;
        haptics.tap();
        setSaving(true);

        try {
            const exercisesData = formExercises.map(e => ({
                exercise_name: e.name,
                target_sets: e.sets,
                target_reps: e.reps,
                order_index: 0
            }));

            if (editingTemplate) {
                await updateTemplate(editingTemplate.id, {
                    name: formTitle,
                    exercises: formExercises,
                });
            } else {
                await createTemplate(formTitle, exercisesData);
            }

            setShowEditorModal(false);
            setEditingTemplate(null);
            loadData();
            haptics.success();
        } catch (e) {
            alert('Failed to save template');
            haptics.error();
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteTemplate(id: string) {
        if (!confirm('Delete this template?')) return;
        haptics.tap();
        try {
            await deleteTemplate(id);
            setTemplates(prev => prev.filter(t => t.id !== id));
            setMenuOpen(null);
        } catch (error) {
            console.error('Error deleting template:', error);
        }
    }

    function addExercise(name?: string) {
        const exerciseName = name || exerciseInput.trim();
        if (!exerciseName) return;
        setFormExercises([...formExercises, { name: exerciseName, sets: 3, reps: '10' }]);
        setExerciseInput('');
        setShowAutocomplete(false);
    }

    function removeExercise(index: number) {
        setFormExercises(formExercises.filter((_, i) => i !== index));
    }

    async function handleCopyTemplate(template: PublicTemplate) {
        haptics.tap();
        try {
            const exercises = (template.exercises || []).map((e: any) => ({
                exercise_name: e.name || e.exercise_name || '',
                target_sets: e.sets || e.target_sets || 3,
                target_reps: e.reps || e.target_reps || '10',
                order_index: 0
            }));
            await createTemplate(template.name, exercises);
            setCopiedId(template.id);
            setTimeout(() => setCopiedId(null), 2000);
            haptics.success();
        } catch (error) {
            console.error('Error copying template:', error);
            haptics.error();
        }
    }

    async function handleSaveAIRecommendation(rec: AIRecommendation) {
        haptics.tap();
        try {
            const exercises = rec.exercises.map(e => ({
                exercise_name: e.name,
                target_sets: e.sets,
                target_reps: e.reps,
                order_index: 0
            }));
            await createTemplate(rec.title, exercises);
            haptics.success();
            // Switch to templates tab to show the new template
            setActiveTab('templates');
            loadData();
        } catch (error) {
            console.error('Error saving AI recommendation:', error);
            haptics.error();
        }
    }

    function handleScheduleModalClose() { setShowScheduleModal(false); setSelectedDate(null); }
    function handleWorkoutScheduled() { setShowScheduleModal(false); setSelectedDate(null); loadData(); }

    return (
        <main className="p-6 pt-12 pb-24 space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <header className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Workout</h1>
                {activeTab === 'schedule' && (
                    <button
                        onClick={() => { setSelectedDate(new Date()); setShowScheduleModal(true); }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Schedule
                    </button>
                )}
                {activeTab === 'templates' && (
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl font-medium shadow-lg shadow-green-200 hover:bg-green-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Template
                    </button>
                )}
            </header>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                    onClick={() => { haptics.tap(); setActiveTab('schedule'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'schedule' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Calendar className="w-4 h-4" />
                    Schedule
                </button>
                <button
                    onClick={() => { haptics.tap(); setActiveTab('templates'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'templates' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <LayoutGrid className="w-4 h-4" />
                    My Templates
                </button>
                <button
                    onClick={() => { haptics.tap(); setActiveTab('discover'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'discover' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Sparkles className="w-4 h-4" />
                    Discover
                </button>
            </div>

            {/* ==================== SCHEDULE TAB ==================== */}
            {activeTab === 'schedule' && (
                <>
                    {/* Week Navigation */}
                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <button onClick={handlePrevWeek} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors">
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div className="text-center">
                            <span className="font-bold text-gray-900">
                                {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                            </span>
                        </div>
                        <button onClick={handleNextWeek} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors">
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>

                    {/* Week View */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative">
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
                                    <div className={`text-xs font-bold uppercase ${isToday(day) ? 'text-blue-600' : 'text-gray-400'}`}>
                                        {format(day, 'EEE')}
                                    </div>
                                    <div className={`text-lg font-bold mt-1 ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}`}>
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
                                        <div className={`text-sm font-bold mb-3 ${isToday(day) ? 'text-blue-600' : 'text-gray-500'}`}>
                                            {format(day, 'EEEE, MMM d')}
                                            {isToday(day) && <span className="ml-2 text-blue-500">• Today</span>}
                                        </div>

                                        <div className="space-y-2">
                                            {dayWorkouts.map(workout => (
                                                <div
                                                    key={workout.id}
                                                    className={`flex items-center justify-between p-3 rounded-xl ${workout.status === 'completed' ? 'bg-green-50 border border-green-200'
                                                        : workout.status === 'skipped' ? 'bg-gray-50 border border-gray-200 opacity-60'
                                                            : 'bg-gray-50 border border-gray-200'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${workout.status === 'completed' ? 'bg-green-100' : 'bg-blue-100'}`}>
                                                            <Dumbbell className={`w-4 h-4 ${workout.status === 'completed' ? 'text-green-600' : 'text-blue-600'}`} />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900">{workout.title}</div>
                                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {workout.scheduled_time.slice(0, 5)}
                                                                {workout.status === 'completed' && <span className="ml-2 text-green-600">✓ Completed</span>}
                                                                {workout.status === 'skipped' && <span className="ml-2 text-gray-500">Skipped</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {workout.status === 'scheduled' && (
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => handleStartWorkout(workout)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors" title="Start">
                                                                <Play className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleSkip(workout.id)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors" title="Skip">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleDeleteScheduled(workout.id)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="Delete">
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
                </>
            )}

            {/* ==================== MY TEMPLATES TAB ==================== */}
            {activeTab === 'templates' && (
                <div className="space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                            <Dumbbell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="font-medium text-gray-900">No workout templates yet</p>
                            <p className="text-sm text-gray-500 mt-1">Create your own or browse Discover</p>
                            <button
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Create Template
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {templates.map(template => (
                                <div key={template.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="p-2 bg-purple-100 rounded-xl flex-shrink-0">
                                                <Dumbbell className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-gray-900 truncate">{template.name}</h3>
                                                <p className="text-sm text-gray-500">
                                                    {Array.isArray(template.exercises) ? `${template.exercises.length} exercises` : 'Custom workout'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => setPreviewTemplate(template)}
                                                className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                                                title="Preview"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => { haptics.success(); router.push(`/workout/active/new?template=${template.id}`); }}
                                                className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                                title="Start workout"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setMenuOpen(menuOpen === template.id ? null : template.id)}
                                                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                {menuOpen === template.id && (
                                                    <div className="absolute right-0 top-10 bg-white shadow-xl rounded-xl border border-gray-100 py-2 z-20 min-w-[140px]">
                                                        <button
                                                            onClick={() => openEditModal(template)}
                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                                        >
                                                            <Edit2 className="w-4 h-4" /> Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDuplicateTemplate(template)}
                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                                        >
                                                            <Copy className="w-4 h-4" /> Duplicate
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteTemplate(template.id)}
                                                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                        >
                                                            <Trash2 className="w-4 h-4" /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Exercise preview */}
                                    {Array.isArray(template.exercises) && template.exercises.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            <div className="flex flex-wrap gap-2">
                                                {template.exercises.slice(0, 3).map((ex: any, idx: number) => (
                                                    <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
                                                        {ex.name || ex.exercise_name}
                                                    </span>
                                                ))}
                                                {template.exercises.length > 3 && (
                                                    <span className="px-2 py-1 text-gray-400 text-xs">+{template.exercises.length - 3} more</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Quick Start */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-4">
                        <h3 className="font-bold text-gray-900 mb-2">Quick Start</h3>
                        <p className="text-sm text-gray-600 mb-3">Start a workout without a template</p>
                        <button
                            onClick={() => { haptics.success(); router.push('/workout/active/new'); }}
                            className="flex items-center justify-between w-full p-3 bg-white rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <Play className="w-4 h-4 text-purple-600" />
                                </div>
                                <span className="font-medium text-gray-900">Empty Workout</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                </div>
            )}

            {/* ==================== DISCOVER TAB ==================== */}
            {activeTab === 'discover' && (
                <div className="space-y-4">
                    {/* AI Recommendations Section */}
                    <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 rounded-2xl border border-purple-200 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <Bot className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">AI Recommendations</h3>
                                    <p className="text-xs text-gray-500">Personalized workouts based on your history</p>
                                </div>
                            </div>
                            <button
                                onClick={loadAIRecommendations}
                                disabled={aiLoading}
                                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                {aiRecommendations.length > 0 ? 'Refresh' : 'Generate'}
                            </button>
                        </div>

                        {aiError && (
                            <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg mb-3">{aiError}</div>
                        )}

                        {aiRecommendations.length > 0 && (
                            <div className="space-y-2">
                                {aiRecommendations.map((rec, idx) => (
                                    <div key={idx} className="bg-white rounded-xl p-3 border border-purple-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold text-gray-900">{rec.title}</h4>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleSaveAIRecommendation(rec)}
                                                    className="p-1.5 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200"
                                                    title="Save to My Templates"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-purple-600 mb-2">{rec.reason}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {rec.exercises.slice(0, 4).map((ex, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded">
                                                    {ex.name}
                                                </span>
                                            ))}
                                            {rec.exercises.length > 4 && (
                                                <span className="text-xs text-purple-400">+{rec.exercises.length - 4}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!aiLoading && aiRecommendations.length === 0 && !aiError && (
                            <p className="text-sm text-gray-500 text-center py-4">
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
                                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${categoryFilter === cat.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {cat.icon} {cat.label}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                    ) : publicTemplates.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                            <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="font-medium text-gray-900">No templates found</p>
                            <p className="text-sm text-gray-500 mt-1">Try a different category</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {publicTemplates.map(template => (
                                <div key={template.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="p-2 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl flex-shrink-0">
                                                {template.is_featured ? (
                                                    <Star className="w-5 h-5 text-yellow-500" />
                                                ) : (
                                                    <Dumbbell className="w-5 h-5 text-blue-600" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-gray-900 truncate">{template.name}</h3>
                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                    {template.difficulty && (
                                                        <span className={`px-2 py-0.5 rounded-full text-xs ${template.difficulty === 'beginner' ? 'bg-green-100 text-green-700'
                                                            : template.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700'
                                                                : 'bg-red-100 text-red-700'
                                                            }`}>
                                                            {template.difficulty}
                                                        </span>
                                                    )}
                                                    {template.estimated_duration && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {template.estimated_duration}m
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => setPreviewTemplate(template)}
                                                className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                                                title="Preview"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => { haptics.success(); router.push(`/workout/active/new?template=${template.id}`); }}
                                                className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                                title="Start workout"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleCopyTemplate(template)}
                                                className={`p-2 rounded-lg transition-colors ${copiedId === template.id
                                                    ? 'bg-green-100 text-green-600'
                                                    : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                                    }`}
                                                title="Save to My Templates"
                                            >
                                                {copiedId === template.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {template.description && (
                                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{template.description}</p>
                                    )}

                                    {/* Exercise preview */}
                                    {Array.isArray(template.exercises) && template.exercises.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            <div className="flex flex-wrap gap-2">
                                                {template.exercises.slice(0, 4).map((ex: any, idx: number) => (
                                                    <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
                                                        {ex.name || ex.exercise_name}
                                                    </span>
                                                ))}
                                                {template.exercises.length > 4 && (
                                                    <span className="px-2 py-1 text-gray-400 text-xs">+{template.exercises.length - 4} more</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ==================== SCHEDULE MODAL ==================== */}
            {showScheduleModal && (
                <ScheduleWorkoutModal
                    selectedDate={selectedDate}
                    templates={templates}
                    onClose={handleScheduleModalClose}
                    onScheduled={handleWorkoutScheduled}
                />
            )}

            {/* ==================== TEMPLATE PREVIEW MODAL ==================== */}
            {previewTemplate && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewTemplate(null)}>
                    <div className="bg-white w-full max-w-md rounded-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{previewTemplate.name}</h2>
                                <p className="text-sm text-gray-500">
                                    {Array.isArray(previewTemplate.exercises) ? `${previewTemplate.exercises.length} exercises` : 'Custom workout'}
                                </p>
                            </div>
                            <button onClick={() => setPreviewTemplate(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {Array.isArray(previewTemplate.exercises) && previewTemplate.exercises.length > 0 ? (
                                <div className="space-y-3">
                                    {previewTemplate.exercises.map((ex: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
                                                    {idx + 1}
                                                </div>
                                                <span className="font-medium text-gray-900">{ex.name || ex.exercise_name}</span>
                                            </div>
                                            <span className="text-sm text-gray-500">
                                                {ex.sets || ex.target_sets} × {ex.reps || ex.target_reps}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-8">No exercises defined</p>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setPreviewTemplate(null)}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    haptics.success();
                                    router.push(`/workout/active/new?template=${previewTemplate.id}`);
                                }}
                                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 flex items-center justify-center gap-2"
                            >
                                <Play className="w-5 h-5" />
                                Start Workout
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== TEMPLATE EDITOR MODAL ==================== */}
            {showEditorModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowEditorModal(false)}>
                    <div className="bg-white w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">
                            {editingTemplate ? 'Edit Template' : 'New Template'}
                        </h2>

                        <div className="space-y-4">
                            {/* Workout Name */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Workout Name</label>
                                <input
                                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g. Push Day"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* Add Exercise with Autocomplete */}
                            <div ref={autocompleteRef}>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Exercises</label>
                                <div className="flex gap-2 relative">
                                    <div className="flex-1 relative">
                                        <input
                                            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200"
                                            placeholder="Type exercise name..."
                                            value={exerciseInput}
                                            onChange={e => setExerciseInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addExercise()}
                                            onFocus={() => exerciseInput && setShowAutocomplete(true)}
                                        />
                                        {showAutocomplete && autocompleteResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                                                {autocompleteResults.map((ex, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => addExercise(ex)}
                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
                                                    >
                                                        <Dumbbell className="w-4 h-4 text-gray-400" />
                                                        {ex}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => addExercise()}
                                        className="px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Exercise List */}
                            {formExercises.length > 0 && (
                                <div className="space-y-2">
                                    {formExercises.map((ex, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                            <span className="flex-1 font-medium text-gray-900">{ex.name}</span>
                                            <input
                                                type="number"
                                                className="w-16 p-2 bg-white rounded-lg border text-center"
                                                value={ex.sets}
                                                onChange={e => {
                                                    const updated = [...formExercises];
                                                    updated[i].sets = parseInt(e.target.value) || 0;
                                                    setFormExercises(updated);
                                                }}
                                            />
                                            <span className="text-gray-400">×</span>
                                            <input
                                                type="text"
                                                className="w-16 p-2 bg-white rounded-lg border text-center"
                                                value={ex.reps}
                                                onChange={e => {
                                                    const updated = [...formExercises];
                                                    updated[i].reps = e.target.value;
                                                    setFormExercises(updated);
                                                }}
                                            />
                                            <button
                                                onClick={() => removeExercise(i)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowEditorModal(false)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    disabled={!formTitle.trim() || saving}
                                    className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editingTemplate ? 'Save Changes' : 'Create Template'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
