'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/LanguageProvider';
import { Modal, Button, Input } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { getWorkouts, Workout } from '@/lib/api';
import { checkAndAwardBadges } from '@/lib/badges';
import { SharedItem, LoggedMealPayload, LoggedActivityPayload, logSharedItem } from '@/lib/partner-api';
import { scaleFoodItems, mealTotals, findLikelyDuplicate } from '@/lib/partner-log-share';

const PORTIONS = [
    { value: 0.25, label: '¼' },
    { value: 1 / 3, label: '⅓' },
    { value: 0.5, label: '½' },
    { value: 0.75, label: '¾' },
    { value: 1, label: null },
];

interface LogSharedItemModalProps {
    item: SharedItem | null;
    onClose: () => void;
    onLogged: (item: SharedItem) => void;
}

/** Review step before copying a partner's meal or activity into my own log. */
export function LogSharedItemModal({ item, onClose, onLogged }: LogSharedItemModalProps) {
    const { t } = useLanguage();
    const [date, setDate] = useState('');
    const [portion, setPortion] = useState(1);
    const [duration, setDuration] = useState('');
    const [calories, setCalories] = useState('');
    const [duplicate, setDuplicate] = useState<Workout | null>(null);
    const [saving, setSaving] = useState(false);

    const isMeal = item?.item_type === 'logged_meal';
    const meal = isMeal ? item!.payload as LoggedMealPayload : null;
    const activity = item?.item_type === 'logged_activity' ? item.payload as LoggedActivityPayload : null;

    useEffect(() => {
        if (!item) return;
        const p = item.payload as LoggedMealPayload | LoggedActivityPayload;
        setDate(p.date);
        setPortion(1);
        setCalories('');
        setDuration(activity ? String(activity.duration) : '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item?.id]);

    useEffect(() => {
        if (!activity || !date) {
            setDuplicate(null);
            return;
        }
        let cancelled = false;
        getWorkouts(date)
            .then(existing => { if (!cancelled) setDuplicate(findLikelyDuplicate(existing, { ...activity, date })); })
            .catch(() => { if (!cancelled) setDuplicate(null); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item?.id, date]);

    if (!item || (!meal && !activity)) return null;

    const scaled = meal ? scaleFoodItems(meal.food_items, portion) : [];
    const totals = mealTotals(scaled);
    const durationNum = parseInt(duration, 10);
    const canSave = !!date && (meal ? portion > 0 : durationNum > 0);

    async function handleConfirm() {
        if (!item || !canSave) return;
        setSaving(true);
        haptics.tap();
        try {
            if (meal) {
                await logSharedItem(item, { date, portion });
            } else {
                const kcal = parseInt(calories, 10);
                await logSharedItem(item, { date, duration: durationNum, ...(kcal > 0 ? { calories: kcal } : {}) });
            }
            checkAndAwardBadges();
            haptics.success();
            toast.success(t.partner.logShare.logged);
            onLogged(item);
        } catch (error) {
            haptics.error();
            toast.error(error instanceof Error ? error.message : 'Failed to log');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal isOpen onClose={onClose} title={t.partner.logShare.title} size="md" className="space-y-4">
            <div>
                <p className="text-xs text-[var(--color-text-muted)]">
                    {item.fromName || 'Your partner'} · {meal ? t.partner.inbox.loggedMeal : t.partner.inbox.loggedActivity}
                </p>
                <p className="font-bold text-[var(--color-text)]">{meal?.name ?? activity?.name}</p>
                {item.message && (
                    <p className="text-xs italic text-[var(--color-text-secondary)] mt-1">“{item.message}”</p>
                )}
            </div>

            <Input
                label={t.partner.logShare.date}
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
            />

            {meal && (
                <>
                    <div>
                        <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">
                            {t.partner.logShare.yourPortion}
                        </p>
                        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t.partner.logShare.yourPortion}>
                            {PORTIONS.map(p => (
                                <button
                                    key={p.value}
                                    role="radio"
                                    aria-checked={portion === p.value}
                                    onClick={() => setPortion(p.value)}
                                    className="py-2 rounded-xl text-sm font-bold border transition-all focus-ring"
                                    style={portion === p.value
                                        ? { background: 'var(--color-gold-muted)', borderColor: 'var(--color-gold)', color: 'var(--color-gold-text)' }
                                        : { background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-light)', color: 'var(--color-text)' }}
                                >
                                    {p.label ?? t.partner.logShare.portionWhole}
                                </button>
                            ))}
                        </div>
                    </div>
                    <ul className="text-sm space-y-1">
                        {scaled.map((food, i) => (
                            <li key={i} className="flex justify-between gap-2 text-[var(--color-text-secondary)]">
                                <span className="truncate">{food.name}</span>
                                <span className="shrink-0 tabular-nums">
                                    {Math.round((food.calories || 0) * Number(food.quantity))} kcal
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-sm font-bold text-[var(--color-text)]">
                        {t.partner.logShare.yourTotal(Math.round(totals.calories), Math.round(totals.protein))}
                    </p>
                </>
            )}

            {activity && (
                <>
                    {activity.distance ? (
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            {activity.intensity} · {t.partner.logShare.distance((activity.distance / 1000).toFixed(1))}
                        </p>
                    ) : (
                        <p className="text-sm text-[var(--color-text-secondary)]">{activity.intensity}</p>
                    )}
                    <Input
                        label={t.partner.logShare.duration}
                        type="number"
                        inputMode="numeric"
                        value={duration}
                        onChange={e => setDuration(e.target.value)}
                    />
                    <div>
                        <Input
                            label={t.partner.logShare.calories}
                            type="number"
                            inputMode="numeric"
                            value={calories}
                            onChange={e => setCalories(e.target.value)}
                        />
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">{t.partner.logShare.caloriesHint}</p>
                    </div>
                    {duplicate && (
                        <div
                            role="alert"
                            className="p-3 rounded-xl flex items-start gap-2 text-sm"
                            style={{ background: 'var(--color-gold-muted)', color: 'var(--color-text)' }}
                        >
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-gold)' }} aria-hidden="true" />
                            <p>{t.partner.logShare.duplicateWarning(duplicate.activity_type, duplicate.duration)}</p>
                        </div>
                    )}
                </>
            )}

            <Button fullWidth disabled={!canSave || saving} onClick={handleConfirm}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t.partner.logShare.confirm}
            </Button>
        </Modal>
    );
}
