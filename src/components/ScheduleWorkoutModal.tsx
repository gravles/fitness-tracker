'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { X, Calendar, Clock, Dumbbell, FileText, Loader2 } from 'lucide-react';
import { scheduleWorkout } from '@/lib/schedule-api';
import { haptics } from '@/lib/haptics';

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
    const [time, setTime] = useState('09:00');
    const [title, setTitle] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) {
            alert('Please enter a title');
            return;
        }

        setSaving(true);
        haptics.tap();

        try {
            await scheduleWorkout({
                templateId: templateId || undefined,
                date,
                time: time + ':00', // Add seconds
                title: title.trim(),
                notes: notes.trim() || undefined,
            });

            haptics.success();
            onScheduled();
        } catch (error) {
            console.error('Error scheduling workout:', error);
            haptics.error();
            alert('Failed to schedule workout');
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">Schedule Workout</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Date
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Clock className="w-4 h-4 inline mr-1" />
                                Time
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Template Selection */}
                    {templates.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Dumbbell className="w-4 h-4 inline mr-1" />
                                Template (Optional)
                            </label>
                            <select
                                value={templateId}
                                onChange={(e) => handleTemplateSelect(e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                                <option value="">No template - custom workout</option>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Workout Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Morning Strength Training"
                            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <FileText className="w-4 h-4 inline mr-1" />
                            Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any notes for this workout..."
                            rows={2}
                            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={saving || !title.trim()}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            </div>
        </div>
    );
}
