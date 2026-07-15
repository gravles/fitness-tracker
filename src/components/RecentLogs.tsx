import { DailyLog } from '@/lib/api';
import { format, parse } from 'date-fns';
import { Activity, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Input, Select, Textarea, Modal } from '@/components/ui';

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
            <h3 className="font-semibold text-sm text-[var(--color-text)] uppercase tracking-wide px-1">{t.recentLogs.title}</h3>
            <div className="space-y-2">
                {recent.map(log => (
                    <div key={log.date} className="bg-[var(--color-surface-elevated)] p-4 rounded-xl border border-[var(--color-border-light)] shadow-sm flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${log.movement_completed ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]'}`}>
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
                <Modal isOpen onClose={() => setEditingLog(null)} title={t.recentLogs.editWorkout} size="md" sheet={false}>
                        <div className="space-y-4">
                            <Input
                                label={t.recentLogs.activity}
                                value={editForm.activity_type}
                                onChange={e => setEditForm({ ...editForm, activity_type: e.target.value })}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label={t.recentLogs.duration}
                                    type="number"
                                    inputMode="numeric"
                                    value={editForm.duration}
                                    onChange={e => setEditForm({ ...editForm, duration: e.target.value })}
                                />
                                <Select
                                    label={t.recentLogs.intensity}
                                    value={editForm.intensity}
                                    onChange={e => setEditForm({ ...editForm, intensity: e.target.value })}
                                >
                                    <option value="Light">{t.movement.intensityOptions.light}</option>
                                    <option value="Moderate">{t.movement.intensityOptions.moderate}</option>
                                    <option value="Hard">{t.movement.intensityOptions.hard}</option>
                                </Select>
                            </div>
                            <Textarea
                                label={t.recentLogs.notes}
                                rows={4}
                                value={editForm.notes}
                                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                            />

                            <Button fullWidth onClick={handleSave} disabled={loadingEdit}>
                                {loadingEdit ? t.recentLogs.saving : t.recentLogs.saveChanges}
                            </Button>
                        </div>
                </Modal>
            )}
        </div>
    );
}
