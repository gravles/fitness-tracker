import { DailyLog } from '@/lib/api';
import { format, parse } from 'date-fns';
import { Activity, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';

export function RecentLogs({ logs }: { logs: DailyLog[] }) {
    const router = useRouter();
    const { t } = useLanguage();
    const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
    const [editForm, setEditForm] = useState<any>(null);
    const [loadingEdit, setLoadingEdit] = useState(false);

    const recent = [...logs].reverse().slice(0, 3);

    if (recent.length === 0) return null;

    const handleEditClick = async (log: DailyLog) => {
        setLoadingEdit(true);
        try {
            const { getWorkoutByDate } = await import('@/lib/api');
            const workout = await getWorkoutByDate(log.date);

            if (workout) {
                router.push(`/workout/active/${workout.id}`);
                return;
            }

            setEditForm({
                type: 'daily_log',
                date: log.date,
                activity_type: log.movement_type || 'Workout',
                duration: log.movement_duration || 0,
                notes: log.movement_notes || '',
                intensity: log.movement_intensity || 'Moderate',
            });
            setEditingLog(log);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingEdit(false);
        }
    };

    const handleSave = async () => {
        if (!editForm) return;
        setLoadingEdit(true);
        try {
            const { updateWorkout, upsertDailyLog } = await import('@/lib/api');

            if (editForm.type === 'workout' && editForm.id) {
                await updateWorkout(editForm.id, {
                    activity_type: editForm.activity_type,
                    duration: parseInt(editForm.duration),
                    notes: editForm.notes,
                    intensity: editForm.intensity,
                });
            }

            await upsertDailyLog({
                date: editForm.date,
                movement_completed: true,
                movement_type: editForm.activity_type,
                movement_duration: parseInt(editForm.duration),
                movement_notes: editForm.notes,
                movement_intensity: editForm.intensity,
            });

            window.location.reload();
        } catch (e) {
            console.error(e);
            toast.error('Failed to save changes');
        } finally {
            setLoadingEdit(false);
            setEditingLog(null);
            setEditForm(null);
        }
    };

    return (
        <div className="space-y-3">
            <h3 className="font-bold text-[var(--color-text)] px-1">{t.recentLogs.title}</h3>
            <div className="space-y-2">
                {recent.map(log => (
                    <div key={log.date} className="bg-[var(--color-surface-elevated)] p-4 rounded-xl border border-[var(--color-border-light)] shadow-sm flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${log.movement_completed ? 'bg-green-500/10 text-green-500' : 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]'}`}>
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="font-bold text-sm text-[var(--color-text)]">{format(parse(log.date, 'yyyy-MM-dd', new Date()), 'EEEE')}</p>
                                <p className="text-xs text-[var(--color-text-muted)]">{log.movement_completed ? log.movement_type || t.recentLogs.workout : t.recentLogs.restDay}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {log.movement_duration && (
                                <span className="text-sm font-bold text-[var(--color-text)]">{log.movement_duration}m</span>
                            )}
                            <button
                                onClick={() => handleEditClick(log)}
                                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {editingLog && editForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--color-surface-elevated)] rounded-2xl w-full max-w-md shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-bold text-lg text-[var(--color-text)]">{t.recentLogs.editWorkout}</h3>
                            <button onClick={() => setEditingLog(null)} className="p-2 hover:bg-[var(--color-bg-muted)] rounded-full text-[var(--color-text-muted)] transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">{t.recentLogs.activity}</label>
                                <input
                                    value={editForm.activity_type}
                                    onChange={e => setEditForm({ ...editForm, activity_type: e.target.value })}
                                    className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl font-medium text-[var(--color-text)] border border-[var(--color-border-light)] focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">{t.recentLogs.duration}</label>
                                    <input
                                        type="number"
                                        value={editForm.duration}
                                        onChange={e => setEditForm({ ...editForm, duration: e.target.value })}
                                        className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl font-medium text-[var(--color-text)] border border-[var(--color-border-light)] focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">{t.recentLogs.intensity}</label>
                                    <select
                                        value={editForm.intensity}
                                        onChange={e => setEditForm({ ...editForm, intensity: e.target.value })}
                                        className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl font-medium text-[var(--color-text)] border border-[var(--color-border-light)] focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                    >
                                        <option value="Light">{t.movement.intensityOptions.light}</option>
                                        <option value="Moderate">{t.movement.intensityOptions.moderate}</option>
                                        <option value="Hard">{t.movement.intensityOptions.hard}</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">{t.recentLogs.notes}</label>
                                <textarea
                                    rows={4}
                                    value={editForm.notes}
                                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                    className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl text-sm text-[var(--color-text)] border border-[var(--color-border-light)] focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={loadingEdit}
                                className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {loadingEdit ? t.recentLogs.saving : t.recentLogs.saveChanges}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
