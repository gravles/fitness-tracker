'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Loader2, Bell, Pill, FileText, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    saveSupplement, scheduleDoses, cancelFutureDoses,
    Supplement, SupplementKind, DOSE_UNITS, SUPPLEMENT_FORMS,
} from '@/lib/supplement-api';
import { haptics } from '@/lib/haptics';
import { Modal } from './ui/Modal';

const WEEKDAYS: { key: string; label: string }[] = [
    { key: 'mon', label: 'M' }, { key: 'tue', label: 'T' }, { key: 'wed', label: 'W' },
    { key: 'thu', label: 'T' }, { key: 'fri', label: 'F' }, { key: 'sat', label: 'S' },
    { key: 'sun', label: 'S' },
];

const ALL_DAYS = WEEKDAYS.map(d => d.key);

interface SupplementModalProps {
    /** null = create a new catalogue entry */
    supplement: Supplement | null;
    onClose: () => void;
    onSaved: () => void;
}

export function SupplementModal({ supplement, onClose, onSaved }: SupplementModalProps) {
    const isEdit = supplement !== null;
    const today = format(new Date(), 'yyyy-MM-dd');

    // Catalogue fields
    const [name, setName] = useState(supplement?.name ?? '');
    const [kind, setKind] = useState<SupplementKind>(supplement?.kind ?? 'supplement');
    const [doseAmount, setDoseAmount] = useState(supplement?.dose_amount != null ? String(supplement.dose_amount) : '');
    const [doseUnit, setDoseUnit] = useState(supplement?.dose_unit ?? 'mg');
    const [form, setForm] = useState(supplement?.form ?? 'capsule');
    const [notes, setNotes] = useState(supplement?.notes ?? '');

    // Schedule fields — on by default when creating; editing starts catalogue-only
    const [scheduleEnabled, setScheduleEnabled] = useState(!isEdit);
    const [times, setTimes] = useState<string[]>(['08:00']);
    const [daysOfWeek, setDaysOfWeek] = useState<string[]>(ALL_DAYS);
    const [startDate, setStartDate] = useState(today);
    const [until, setUntil] = useState(format(new Date(Date.now() + 56 * 86_400_000), 'yyyy-MM-dd'));
    const [remind, setRemind] = useState(true);

    const [saving, setSaving] = useState(false);

    function toggleDay(day: string) {
        setDaysOfWeek(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    }

    function setTime(idx: number, value: string) {
        setTimes(prev => prev.map((t, i) => i === idx ? value : t));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Please enter a name');
            return;
        }
        if (scheduleEnabled && daysOfWeek.length === 0) {
            toast.error('Pick at least one weekday');
            return;
        }

        setSaving(true);
        haptics.tap();
        try {
            const saved = await saveSupplement({
                id: supplement?.id,
                name,
                kind,
                doseAmount: doseAmount.trim() === '' ? null : Number(doseAmount),
                doseUnit: doseUnit || null,
                form: form || null,
                notes: notes.trim() || null,
            });

            if (scheduleEnabled) {
                // Editing replaces the future plan: drop remaining planned doses, re-insert
                if (isEdit) await cancelFutureDoses(saved.id, today);
                await scheduleDoses({
                    supplement: saved,
                    startDate,
                    times: times.filter(Boolean),
                    daysOfWeek,
                    until,
                    remind,
                });
            }

            haptics.success();
            toast.success(`${saved.name} saved`);
            onSaved();
        } catch (error) {
            console.error('Error saving supplement:', error);
            haptics.error();
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal isOpen onClose={onClose} title={isEdit ? 'Edit Supplement' : 'Add Supplement'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Kind toggle */}
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type">
                    {(['supplement', 'medication'] as const).map(k => (
                        <button
                            key={k}
                            type="button"
                            role="radio"
                            aria-checked={kind === k}
                            onClick={() => setKind(k)}
                            className="py-2.5 rounded-xl text-sm font-bold capitalize transition-all"
                            style={kind === k
                                ? { background: 'var(--color-navy)', color: 'var(--color-gold)' }
                                : { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)' }}
                        >
                            {k}
                        </button>
                    ))}
                </div>

                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
                        <Pill className="w-4 h-4 inline mr-1" />
                        Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={kind === 'medication' ? 'e.g., Levothyroxine' : 'e.g., Creatine'}
                        className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl placeholder:text-[var(--color-text-muted)]"
                    />
                </div>

                {/* Dose + form */}
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">Dose</label>
                        <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={doseAmount}
                            onChange={(e) => setDoseAmount(e.target.value)}
                            placeholder="500"
                            className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl placeholder:text-[var(--color-text-muted)]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">Unit</label>
                        <select
                            value={doseUnit}
                            onChange={(e) => setDoseUnit(e.target.value)}
                            className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl"
                        >
                            {DOSE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">Form</label>
                        <select
                            value={form}
                            onChange={(e) => setForm(e.target.value)}
                            className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl capitalize"
                        >
                            {SUPPLEMENT_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
                        <FileText className="w-4 h-4 inline mr-1" />
                        Notes (Optional)
                    </label>
                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g., take with food"
                        className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl placeholder:text-[var(--color-text-muted)]"
                    />
                </div>

                {/* Schedule section */}
                <div
                    className="rounded-xl border p-3 space-y-3"
                    style={{ borderColor: 'var(--color-border-light)', background: 'var(--color-bg-subtle)' }}
                >
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                        <span className="text-sm font-bold text-[var(--color-text)]">
                            <Calendar className="w-4 h-4 inline mr-1.5" />
                            {isEdit ? 'Replace future schedule' : 'Schedule doses'}
                        </span>
                        <input
                            type="checkbox"
                            checked={scheduleEnabled}
                            onChange={(e) => setScheduleEnabled(e.target.checked)}
                            className="w-5 h-5 accent-[var(--color-primary)]"
                        />
                    </label>

                    {scheduleEnabled && (
                        <>
                            {/* Times of day */}
                            <div>
                                <span className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Times of day</span>
                                <div className="space-y-2">
                                    {times.map((time, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input
                                                type="time"
                                                value={time}
                                                onChange={(e) => setTime(i, e.target.value)}
                                                className="flex-1 p-2.5 bg-[var(--color-surface-elevated)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl"
                                            />
                                            {times.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setTimes(prev => prev.filter((_, idx) => idx !== i))}
                                                    aria-label="Remove time"
                                                    className="p-2 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)]"
                                                >
                                                    <X className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTimes(prev => [...prev, '20:00'])}
                                    className="mt-2 text-xs font-bold flex items-center gap-1"
                                    style={{ color: 'var(--color-primary)' }}
                                >
                                    <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add another time
                                </button>
                            </div>

                            {/* Weekdays */}
                            <div>
                                <span className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Days</span>
                                <div className="flex gap-1.5">
                                    {WEEKDAYS.map(({ key, label }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            aria-label={key}
                                            aria-pressed={daysOfWeek.includes(key)}
                                            onClick={() => toggleDay(key)}
                                            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                                            style={daysOfWeek.includes(key)
                                                ? { background: 'var(--color-primary)', color: 'white' }
                                                : { background: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-light)' }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Date range */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">From</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        min={today}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full p-2.5 bg-[var(--color-surface-elevated)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Until</label>
                                    <input
                                        type="date"
                                        value={until}
                                        min={startDate}
                                        onChange={(e) => setUntil(e.target.value)}
                                        className="w-full p-2.5 bg-[var(--color-surface-elevated)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl"
                                    />
                                </div>
                            </div>

                            {/* Reminder toggle */}
                            <label className="flex items-center justify-between gap-3 cursor-pointer">
                                <span className="text-xs font-medium text-[var(--color-text-muted)]">
                                    <Bell className="w-4 h-4 inline mr-1" />
                                    Push reminder at each dose time
                                </span>
                                <input
                                    type="checkbox"
                                    checked={remind}
                                    onChange={(e) => setRemind(e.target.checked)}
                                    className="w-5 h-5 accent-[var(--color-primary)]"
                                />
                            </label>
                        </>
                    )}
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={saving || !name.trim()}
                    className="w-full py-3.5 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Pill className="w-5 h-5" />
                            {isEdit ? 'Save Changes' : 'Add Supplement'}
                        </>
                    )}
                </button>

                <p className="text-[11px] leading-snug text-center" style={{ color: 'var(--color-text-muted)' }}>
                    For personal tracking only — not medical advice. Follow your prescriber&apos;s directions.
                </p>
            </form>
        </Modal>
    );
}
