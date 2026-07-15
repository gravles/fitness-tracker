'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, Dumbbell, FileText, Loader2, Bell, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { scheduleWorkout } from '@/lib/schedule-api';
import { haptics } from '@/lib/haptics';
import { Modal } from './ui/Modal';

interface Template {
    id: string;
    name: string;
    exercises?: any[];
}

interface ScheduleWorkoutModalProps {
    selectedDate: Date | null;
    templates: Template[];
    onClose: () => void;
    onScheduled: () => void;
}

export function ScheduleWorkoutModal({
    selectedDate,
    templates,
    onClose,
    onScheduled,
}: ScheduleWorkoutModalProps) {
    const [date, setDate] = useState(selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    const [time, setTime] = useState('12:00');
    const [title, setTitle] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [notes, setNotes] = useState('');
    const [remindMinutes, setRemindMinutes] = useState<number>(15);
    const [durationMinutes, setDurationMinutes] = useState<number>(60);
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Please enter a title');
            return;
        }

        setSaving(true);
        haptics.tap();

        try {
            await scheduleWorkout({
                templateId: templateId || undefined,
                date,
                time: time + ':00',
                title: title.trim(),
                notes: notes.trim() || undefined,
                remindMinutes,
                durationMinutes,
            });

            haptics.success();
            onScheduled();
        } catch (error) {
            console.error('Error scheduling workout:', error);
            haptics.error();
            toast.error('Failed to schedule workout');
        } finally {
            setSaving(false);
        }
    }

    function handleTemplateSelect(id: string) {
        setTemplateId(id);
        const template = templates.find(t => t.id === id);
        if (template && !title) {
            setTitle(template.name);
        }
    }

    return (
        <Modal isOpen onClose={onClose} title="Schedule Workout">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Date
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
                                <Clock className="w-4 h-4 inline mr-1" />
                                Time
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl"
                            />
                        </div>
                    </div>

                    {/* Template Selection */}
                    {templates.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
                                <Dumbbell className="w-4 h-4 inline mr-1" />
                                Template (Optional)
                            </label>
                            <select
                                value={templateId}
                                onChange={(e) => handleTemplateSelect(e.target.value)}
                                className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl"
                            >
                                <option value="">No template — custom workout</option>
                                {templates.map(template => (
                                    <option key={template.id} value={template.id}>
                                        {template.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
                            Workout Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Morning Strength Training"
                            className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl placeholder:text-[var(--color-text-muted)]"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
                            <FileText className="w-4 h-4 inline mr-1" />
                            Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any notes for this workout..."
                            rows={2}
                            className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl resize-none placeholder:text-[var(--color-text-muted)]"
                        />
                    </div>

                    {/* Duration + Reminder side by side */}
                    <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
                            <Timer className="w-4 h-4 inline mr-1" />
                            Duration
                        </label>
                        <select
                            value={durationMinutes}
                            onChange={(e) => setDurationMinutes(Number(e.target.value))}
                            className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl"
                        >
                            <option value={30}>30 min</option>
                            <option value={45}>45 min</option>
                            <option value={60}>1 hour</option>
                            <option value={75}>75 min</option>
                            <option value={90}>90 min</option>
                            <option value={120}>2 hours</option>
                        </select>
                    </div>

                    {/* Reminder */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
                            <Bell className="w-4 h-4 inline mr-1" />
                            Remind Me
                        </label>
                        <select
                            value={remindMinutes}
                            onChange={(e) => setRemindMinutes(Number(e.target.value))}
                            className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl"
                        >
                            <option value={0}>At start time</option>
                            <option value={5}>5 minutes before</option>
                            <option value={15}>15 minutes before</option>
                            <option value={30}>30 minutes before</option>
                            <option value={60}>1 hour before</option>
                            <option value={1440}>1 day before</option>
                        </select>
                    </div>
                    </div>{/* end grid */}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={saving || !title.trim()}
                        className="w-full py-3.5 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Scheduling...
                            </>
                        ) : (
                            <>
                                <Calendar className="w-5 h-5" />
                                Schedule Workout
                            </>
                        )}
                    </button>
                </form>
        </Modal>
    );
}
