'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useLanguage } from '@/components/LanguageProvider';
import { Modal } from '@/components/ui';
import { FoodItem } from '@/lib/api';

interface Props {
    item: FoodItem;
    /** The day (yyyy-MM-dd) this entry currently lives on — anchors the time field */
    entryDate?: string;
    /** Show a date field and report moves to another day via onSave's targetDate */
    allowDateMove?: boolean;
    /** targetDate is set only when the user moved the entry to a different day */
    onSave: (updated: FoodItem, targetDate?: string) => void;
    onClose: () => void;
}

/**
 * Shared food-item editor (name, portion, quantity, macros, logged date/time) —
 * used by the daily-log NutritionSection and the Kinetic Eat timeline.
 * Macro inputs are per unit; the totals row shows the quantity-scaled result live.
 */
export function FoodItemEditModal({ item, entryDate, allowDateMove = false, onSave, onClose }: Props) {
    const { t } = useLanguage();
    const [editForm, setEditForm] = useState<FoodItem>({ ...item, quantity: item.quantity || 1 });
    const [dateStr, setDateStr] = useState(() =>
        item.logged_at ? format(new Date(item.logged_at), 'yyyy-MM-dd') : (entryDate ?? '')
    );
    const [timeStr, setTimeStr] = useState(() =>
        item.logged_at ? format(new Date(item.logged_at), 'HH:mm') : ''
    );

    const qty = (() => {
        const q = parseFloat(String(editForm.quantity ?? 1));
        return isNaN(q) ? 0 : q;
    })();
    const total = (perUnit: number | undefined) => Math.round((perUnit || 0) * qty);

    function handleSave() {
        const updated: FoodItem = { ...editForm };
        const anchorDate = dateStr || entryDate;
        if (anchorDate && timeStr) {
            updated.logged_at = new Date(`${anchorDate}T${timeStr}:00`).toISOString();
        } else if (anchorDate && item.logged_at) {
            // date may have changed with the time left as-is
            updated.logged_at = new Date(`${anchorDate}T${format(new Date(item.logged_at), 'HH:mm:ss')}`).toISOString();
        }
        const moved = allowDateMove && !!entryDate && !!dateStr && dateStr !== entryDate;
        onSave(updated, moved ? dateStr : undefined);
    }

    return (
        <Modal isOpen onClose={onClose} title={t.nutrition.editFoodItem} size="sm" sheet={false} zTier="top">
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">{t.nutrition.name}</label>
                    <input
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] font-bold text-[var(--color-text)] outline-none"
                        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                        onBlur={e => { e.target.style.borderColor = ''; }}
                    />
                </div>

                {/* Logged date & time */}
                {(entryDate || item.logged_at) && (
                    <div className="grid grid-cols-2 gap-3">
                        {allowDateMove ? (
                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">Date</label>
                                <input
                                    type="date"
                                    value={dateStr}
                                    onChange={e => setDateStr(e.target.value)}
                                    className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] text-sm font-medium text-[var(--color-text)] outline-none"
                                    onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                    onBlur={e => { e.target.style.borderColor = ''; }}
                                />
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">Date</label>
                                <p className="p-3 text-sm font-medium text-[var(--color-text-muted)]">
                                    {format(new Date(`${dateStr || entryDate}T00:00:00`), 'EEE, MMM d')}
                                </p>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">Time</label>
                            <input
                                type="time"
                                value={timeStr}
                                onChange={e => setTimeStr(e.target.value)}
                                className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] text-sm font-medium text-[var(--color-text)] outline-none"
                                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                onBlur={e => { e.target.style.borderColor = ''; }}
                            />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">{t.nutrition.portionUnit}</label>
                        <input
                            type="text"
                            value={editForm.portion_estimate || ''}
                            onChange={e => setEditForm({ ...editForm, portion_estimate: e.target.value })}
                            placeholder="e.g. 1 slice"
                            className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] text-sm text-[var(--color-text)] outline-none"
                            onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                            onBlur={e => { e.target.style.borderColor = ''; }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">{t.nutrition.quantity}</label>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            value={editForm.quantity as number}
                            onChange={e => setEditForm({ ...editForm, quantity: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] text-sm font-bold text-[var(--color-text)] outline-none"
                            onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                            onBlur={e => { e.target.style.borderColor = ''; }}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--chart-5)' }}>{t.nutrition.calPerUnit}</label>
                        <input
                            type="number"
                            inputMode="decimal"
                            value={editForm.calories}
                            onChange={e => setEditForm({ ...editForm, calories: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 rounded-xl border text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg-subtle)] border-[var(--color-border)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--chart-1)' }}>{t.nutrition.proteinG}</label>
                        <input
                            type="number"
                            inputMode="decimal"
                            value={editForm.protein}
                            onChange={e => setEditForm({ ...editForm, protein: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 rounded-xl border text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg-subtle)] border-[var(--color-border)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--color-warning)' }}>{t.nutrition.carbsG}</label>
                        <input
                            type="number"
                            inputMode="decimal"
                            value={editForm.carbs}
                            onChange={e => setEditForm({ ...editForm, carbs: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 rounded-xl border text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg-subtle)] border-[var(--color-border)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--chart-3)' }}>{t.nutrition.fatG}</label>
                        <input
                            type="number"
                            inputMode="decimal"
                            value={editForm.fat}
                            onChange={e => setEditForm({ ...editForm, fat: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 rounded-xl border text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg-subtle)] border-[var(--color-border)]"
                        />
                    </div>
                </div>

                {/* Live totals — macros scale proportionally with quantity */}
                <div
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-center"
                    style={{ background: 'var(--color-gold-muted)', border: '1px solid var(--color-gold-border)' }}
                    aria-live="polite"
                >
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-gold-text)' }}>
                        This entry ×{qty || 0}
                    </span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text)' }}>
                        {total(editForm.calories)} kcal · {total(editForm.protein)}g P · {total(editForm.carbs)}g C · {total(editForm.fat)}g F
                    </span>
                </div>

                <button
                    onClick={handleSave}
                    className="w-full py-4 text-white rounded-xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg mt-2"
                    style={{ background: 'var(--color-navy)' }}
                >
                    {t.nutrition.saveChanges}
                </button>
            </div>
        </Modal>
    );
}
