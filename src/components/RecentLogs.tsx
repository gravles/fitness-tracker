import { DailyLog } from '@/lib/api';
import { format, parse } from 'date-fns';
import { Activity, Pencil, X } from 'lucide-react';
import { useState } from 'react';

export function RecentLogs({ logs }: { logs: DailyLog[] }) {
    const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
    const [editForm, setEditForm] = useState<any>(null);
    const [loadingEdit, setLoadingEdit] = useState(false);

    const recent = [...logs].reverse().slice(0, 3); // Show last 3, newest first

    if (recent.length === 0) return null;

    const handleEditClick = async (log: DailyLog) => {
        setLoadingEdit(true);
        try {
            // Try to find the specific workout for this day
            const { getWorkoutByDate } = await import('@/lib/api');
            const workout = await getWorkoutByDate(log.date);

            if (workout) {
                setEditForm({
                    type: 'workout',
                    id: workout.id,
                    date: log.date,
                    activity_type: workout.activity_type,
                    duration: workout.duration,
                    notes: workout.notes || '',
                    intensity: workout.intensity || 'Moderate'
                });
            } else {
                // Fallback to daily log data if no specific workout row found
                setEditForm({
                    type: 'daily_log',
                    date: log.date,
                    activity_type: log.movement_type || 'Workout',
                    duration: log.movement_duration || 0,
                    notes: log.movement_notes || '',
                    intensity: log.movement_intensity || 'Moderate'
                });
            }
            setEditingLog(log);
        } catch (e) {
            console.error(e);
            alert('Failed to load workout details');
        } finally {
            setLoadingEdit(false);
        }
    };

    const handleSave = async () => {
        if (!editForm) return;
        setLoadingEdit(true);
        try {
            const { updateWorkout, upsertDailyLog } = await import('@/lib/api');

            // 1. Update Workout Table if it exists
            if (editForm.type === 'workout' && editForm.id) {
                await updateWorkout(editForm.id, {
                    activity_type: editForm.activity_type,
                    duration: parseInt(editForm.duration),
                    notes: editForm.notes,
                    intensity: editForm.intensity
                });
            }

            // 2. Always update Daily Log to keep summary in sync
            await upsertDailyLog({
                date: editForm.date,
                movement_completed: true,
                movement_type: editForm.activity_type,
                movement_duration: parseInt(editForm.duration),
                movement_notes: editForm.notes,
                movement_intensity: editForm.intensity
            });

            // Reload - ideally we'd lift state but window reload is safe for now to refresh parent dashboard
            window.location.reload();

        } catch (e) {
            console.error(e);
            alert('Failed to save changes');
        } finally {
            setLoadingEdit(false);
            setEditingLog(null);
            setEditForm(null);
        }
    };

    if (recent.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="font-bold text-gray-900 px-1">Recent Activity</h3>
            <div className="space-y-2">
                {recent.map(log => (
                    <div key={log.date} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${log.movement_completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="font-bold text-sm text-gray-800">{format(parse(log.date, 'yyyy-MM-dd', new Date()), 'EEEE')}</p>
                                <p className="text-xs text-gray-500">{log.movement_completed ? log.movement_type || 'Workout' : 'Rest Day'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {log.movement_duration && (
                                <span className="text-sm font-bold text-gray-900">{log.movement_duration}m</span>
                            )}
                            <button
                                onClick={() => handleEditClick(log)}
                                className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {editingLog && editForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">Edit Workout</h3>
                            <button onClick={() => setEditingLog(null)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Activity</label>
                                <input
                                    value={editForm.activity_type}
                                    onChange={e => setEditForm({ ...editForm, activity_type: e.target.value })}
                                    className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-900 border border-gray-100"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Duration (min)</label>
                                    <input
                                        type="number"
                                        value={editForm.duration}
                                        onChange={e => setEditForm({ ...editForm, duration: e.target.value })}
                                        className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-900 border border-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Intensity</label>
                                    <select
                                        value={editForm.intensity}
                                        onChange={e => setEditForm({ ...editForm, intensity: e.target.value })}
                                        className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-900 border border-gray-100"
                                    >
                                        <option>Light</option>
                                        <option>Moderate</option>
                                        <option>Hard</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Notes / Details</label>
                                <textarea
                                    rows={4}
                                    value={editForm.notes}
                                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                    className="w-full p-3 bg-gray-50 rounded-xl text-sm border border-gray-100"
                                />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={loadingEdit}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {loadingEdit ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
