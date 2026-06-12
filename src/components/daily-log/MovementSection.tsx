'use client';

import { Workout, addWorkout, deleteWorkout, updateWorkout } from '@/lib/api';
import { confirm } from '@/components/ConfirmDialog';
import { Loader2, Plus, Dumbbell, Clock, Trash2, Sparkles, Pencil, ChevronDown, ChevronUp, Check, X, BarChart2, Flame, Footprints, Bike, Waves, PersonStanding, Heart, Ruler } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';

interface MovementSectionProps {
    movementCompleted: boolean | null;
    setMovementCompleted: (val: boolean) => void;
    workouts: Workout[];
    setWorkouts: (workouts: Workout[]) => void;
    dateStr: string;
    onOpenAiCoach: () => void;
    onAddWorkoutStart: () => void;
    addingWorkout: boolean;
    onDeleteWorkoutStart: () => void;
}

export function MovementSection({
    movementCompleted,
    setMovementCompleted,
    workouts,
    setWorkouts,
    dateStr,
    onOpenAiCoach,
    onAddWorkoutStart,
    addingWorkout,
    onDeleteWorkoutStart,
}: MovementSectionProps) {
    const router = useRouter();
    const { t } = useLanguage();

    const [newWorkout, setNewWorkout] = useState<{ activity_type: string; duration: number; intensity: 'Moderate' | 'Light' | 'Hard' }>({ activity_type: '', duration: 30, intensity: 'Moderate' });
    const [localAdding, setLocalAdding] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ activity_type: string; duration: number; intensity: 'Moderate' | 'Light' | 'Hard' }>({ activity_type: '', duration: 30, intensity: 'Moderate' });

    const workoutPresets = [
        { icon: Footprints,     label: t.movement.presets.run,   activity: 'Running',  duration: 30 },
        { icon: Bike,           label: t.movement.presets.cycle,  activity: 'Cycling',  duration: 45 },
        { icon: Dumbbell,       label: t.movement.presets.gym,    activity: 'Gym',      duration: 60 },
        { icon: PersonStanding, label: t.movement.presets.yoga,   activity: 'Yoga',     duration: 30 },
        { icon: Waves,          label: t.movement.presets.swim,   activity: 'Swimming', duration: 30 },
        { icon: Footprints,     label: t.movement.presets.walk,   activity: 'Walking',  duration: 30 },
    ];

    const totalDuration = workouts.reduce((acc, w) => acc + w.duration, 0);

    async function handleAddWorkout() {
        if (!newWorkout.activity_type) return;
        setLocalAdding(true);
        onAddWorkoutStart();

        try {
            const added = await addWorkout({
                date: dateStr,
                activity_type: newWorkout.activity_type,
                duration: newWorkout.duration,
                intensity: newWorkout.intensity,
            });
            setWorkouts([...workouts, added]);
            setNewWorkout({ activity_type: '', duration: 30, intensity: 'Moderate' });
            setShowAddForm(false);
        } catch (error) {
            console.error('Error adding workout', error);
            toast.error('Failed to add workout');
        } finally {
            setLocalAdding(false);
        }
    }

    async function quickAddWorkout(preset: typeof workoutPresets[0]) {
        setLocalAdding(true);
        try {
            const added = await addWorkout({
                date: dateStr,
                activity_type: preset.activity,
                duration: preset.duration,
                intensity: 'Moderate',
            });
            setWorkouts([...workouts, added]);
        } catch (error) {
            console.error('Error adding workout', error);
            toast.error('Failed to add workout');
        } finally {
            setLocalAdding(false);
        }
    }

    async function handleDeleteWorkout(id: string) {
        if (!await confirm({ title: 'Delete Workout', message: 'Delete this workout?', danger: true })) return;
        onDeleteWorkoutStart();
        try {
            await deleteWorkout(id);
            setWorkouts(workouts.filter(w => w.id !== id));
        } catch (error) {
            console.error('Error deleting workout', error);
        }
    }

    function handleEditWorkout(workout: Workout) {
        setEditingId(workout.id!);
        setEditForm({
            activity_type: workout.activity_type,
            duration: workout.duration,
            intensity: workout.intensity as 'Light' | 'Moderate' | 'Hard',
        });
    }

    async function handleSaveEdit() {
        if (!editingId) return;
        try {
            await updateWorkout(editingId, {
                activity_type: editForm.activity_type,
                duration: editForm.duration,
                intensity: editForm.intensity,
            });
            setWorkouts(workouts.map(w =>
                w.id === editingId
                    ? { ...w, activity_type: editForm.activity_type, duration: editForm.duration, intensity: editForm.intensity }
                    : w
            ));
            setEditingId(null);
        } catch (error) {
            console.error('Error updating workout', error);
            toast.error('Failed to update workout');
        }
    }

    return (
        <section className="bg-[var(--color-surface-elevated)] p-6 rounded-2xl border border-[var(--color-border-light)] shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-[var(--color-text)]">
                <Flame className="w-5 h-5 text-[var(--color-gold-text)]" aria-hidden="true" /> {t.movement.title}
            </h3>

            <div className="flex gap-3 mb-6">
                <button
                    onClick={() => setMovementCompleted(true)}
                    className={`flex-1 py-3.5 rounded-xl font-bold transition-all border-2 ${movementCompleted === true
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20 scale-[1.02]'
                        : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-text)]'}`}
                >
                    {t.movement.yesIMoved}
                </button>
                <button
                    onClick={() => setMovementCompleted(false)}
                    className={`flex-1 py-3.5 rounded-xl font-bold transition-all border-2 ${movementCompleted === false
                        ? 'bg-[var(--color-text)] border-[var(--color-text)] text-[var(--color-bg)] shadow-lg scale-[1.02]'
                        : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-text)]'}`}
                >
                    {t.movement.restDay}
                </button>
            </div>

            {movementCompleted && (
                <div className="animate-in fade-in slide-in-from-top-4 space-y-6">

                    {workouts.length > 0 && (
                        <div className="space-y-3">
                            {workouts.map(workout => (
                                <div key={workout.id} className="p-4 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)]">
                                    {editingId === workout.id ? (
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={editForm.activity_type}
                                                onChange={e => setEditForm({ ...editForm, activity_type: e.target.value })}
                                                className="w-full p-2 bg-[var(--color-surface-elevated)] text-[var(--color-text)] rounded-lg border border-[var(--color-border)] font-medium focus:outline-none focus:border-[var(--color-primary)]"
                                                placeholder={t.movement.activity}
                                            />
                                            <div className="flex gap-3">
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{t.movement.duration}</label>
                                                    <input
                                                        type="number"
                                                        value={editForm.duration}
                                                        onChange={e => setEditForm({ ...editForm, duration: parseInt(e.target.value) || 0 })}
                                                        className="w-full p-2 bg-[var(--color-surface-elevated)] text-[var(--color-text)] rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{t.movement.intensity}</label>
                                                    <select
                                                        value={editForm.intensity}
                                                        onChange={e => setEditForm({ ...editForm, intensity: e.target.value as any })}
                                                        className="w-full p-2 bg-[var(--color-surface-elevated)] text-[var(--color-text)] rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                                                    >
                                                        <option value="Light">{t.movement.intensityOptions.light}</option>
                                                        <option value="Moderate">{t.movement.intensityOptions.moderate}</option>
                                                        <option value="Hard">{t.movement.intensityOptions.hard}</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="px-3 py-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-muted)] rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    <X className="w-4 h-4" /> {t.common.cancel}
                                                </button>
                                                <button
                                                    onClick={handleSaveEdit}
                                                    className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    <Check className="w-4 h-4" /> {t.common.save}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center">
                                                    <Dumbbell className="w-5 h-5 text-[var(--color-primary)]" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-[var(--color-text)]">{workout.activity_type}</h4>
                                                        {workout.source === 'strava' && (
                                                            <span className="text-[10px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded-full font-bold">Strava</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)] mt-1">
                                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {workout.duration} min</span>
                                                        {workout.distance && (
                                                            <span className="flex items-center gap-1 bg-[var(--color-bg-muted)] px-2 py-0.5 rounded-full">
                                                                <Ruler className="w-3 h-3" aria-hidden="true" /> {(workout.distance / 1000).toFixed(2)} km
                                                            </span>
                                                        )}
                                                        {workout.calories && (
                                                            <span className="flex items-center gap-1 bg-[var(--color-bg-muted)] px-2 py-0.5 rounded-full">
                                                                <Flame className="w-3 h-3" aria-hidden="true" /> {workout.calories} kcal
                                                            </span>
                                                        )}
                                                        {workout.average_heartrate && (
                                                            <span className="flex items-center gap-1 bg-[var(--color-bg-muted)] px-2 py-0.5 rounded-full">
                                                                <Heart className="w-3 h-3" aria-hidden="true" /> {Math.round(workout.average_heartrate)} bpm
                                                            </span>
                                                        )}
                                                        <span className="px-2 py-0.5 bg-[var(--color-bg-muted)] rounded-full font-medium">{workout.intensity}</span>
                                                    </div>
                                                    {workout.notes && <p className="text-xs text-[var(--color-text-muted)] mt-1 italic line-clamp-1">{workout.notes}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => router.push(`/workout/active/${workout.id}`)}
                                                    className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors"
                                                    title={t.movement.editSets}
                                                >
                                                    <BarChart2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEditWorkout(workout)}
                                                    className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors"
                                                    title={t.movement.editDetails}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteWorkout(workout.id!)}
                                                    className="p-2 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div className="text-right text-sm text-[var(--color-text-muted)] font-medium pt-2 border-t border-[var(--color-border-light)]">
                                {t.movement.total}: <span className="text-[var(--color-primary)] font-bold">{totalDuration} min</span>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t.movement.quickAdd}</h4>
                        <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
                            {workoutPresets.map((preset) => (
                                <div key={preset.label} className="contents">
                                    <button
                                        onClick={() => quickAddWorkout(preset)}
                                        className="flex flex-col items-center justify-center p-3 bg-[var(--color-bg-subtle)] hover:bg-[var(--color-primary)]/5 border border-[var(--color-border-light)] hover:border-[var(--color-primary)]/30 rounded-xl transition-all tap-target active:scale-95"
                                    >
                                        <preset.icon className="w-6 h-6 mb-1 text-[var(--color-primary)]" aria-hidden="true" />
                                        <span className="text-xs font-bold text-[var(--color-text)]">{preset.label}</span>
                                        <span className="text-[10px] text-[var(--color-text-muted)]">{preset.duration}m</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex-1 flex items-center justify-center gap-2 p-3 text-sm font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 rounded-xl hover:bg-[var(--color-primary)]/15 transition-colors tap-target"
                        >
                            {showAddForm ? (
                                <>{t.movement.closeForm} <ChevronUp className="w-4 h-4" /></>
                            ) : (
                                <>{t.movement.customWorkout} <ChevronDown className="w-4 h-4" /></>
                            )}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onOpenAiCoach(); }}
                            className="px-4 text-white rounded-xl font-bold shadow-md active:scale-95 transition-all flex items-center gap-2 tap-target"
                            style={{ background: 'var(--color-navy)' }}
                        >
                            <Sparkles className="w-4 h-4" /> {t.movement.aiCoach}
                        </button>
                    </div>

                    {showAddForm && (
                        <div className="bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] overflow-hidden p-5 space-y-4 animate-in slide-in-from-top-2">
                            <div>
                                <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{t.movement.activity}</label>
                                <input
                                    type="text"
                                    placeholder={t.movement.activityPlaceholder}
                                    value={newWorkout.activity_type}
                                    onChange={e => setNewWorkout({ ...newWorkout, activity_type: e.target.value })}
                                    className="w-full mt-1 p-3 bg-[var(--color-surface-elevated)] text-[var(--color-text)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all"
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{t.movement.durationShort}</label>
                                    <input
                                        type="number"
                                        value={newWorkout.duration}
                                        onChange={e => setNewWorkout({ ...newWorkout, duration: parseInt(e.target.value) || 0 })}
                                        className="w-full mt-1 p-3 bg-[var(--color-surface-elevated)] text-[var(--color-text)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{t.movement.intensity}</label>
                                    <select
                                        value={newWorkout.intensity}
                                        onChange={e => setNewWorkout({ ...newWorkout, intensity: e.target.value as any })}
                                        className="w-full mt-1 p-3 bg-[var(--color-surface-elevated)] text-[var(--color-text)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                    >
                                        <option value="Light">{t.movement.intensityOptions.light}</option>
                                        <option value="Moderate">{t.movement.intensityOptions.moderate}</option>
                                        <option value="Hard">{t.movement.intensityOptions.hard}</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={handleAddWorkout}
                                disabled={!newWorkout.activity_type || localAdding}
                                className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg shadow-[var(--color-primary)]/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none tap-target"
                            >
                                {localAdding ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t.movement.addWorkout}
                            </button>
                        </div>
                    )}
                    <div className="pt-4 border-t border-[var(--color-border-light)]">
                        <button
                            onClick={() => router.push('/workout')}
                            className="w-full py-4 bg-[var(--color-text)] text-[var(--color-bg)] rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                        >
                            <Dumbbell className="w-5 h-5" aria-hidden="true" />
                            {t.movement.openWorkoutHub}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
