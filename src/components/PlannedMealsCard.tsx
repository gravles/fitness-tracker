'use client';

import { useState, useEffect } from 'react';
import { Salad, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getTodaysPlannedMeals, logPlannedMealAsEaten, PlannedMeal } from '@/lib/meal-plan-api';
import { haptics } from '@/lib/haptics';
import { useLanguage } from '@/components/LanguageProvider';
import { Card } from '@/components/ui';

const SLOT_LABELS: Record<string, string> = {
    break_fast: 'Breakfast',
    lunch: 'Lunch',
    snack: 'Snack',
    dinner: 'Dinner',
    closer: 'Closer',
};

function slotLabel(slot: string): string {
    return SLOT_LABELS[slot] ?? slot.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function PlannedMealsCard({ stagger, onLogged }: { stagger?: number; onLogged?: () => void }) {
    const { t } = useLanguage();
    const [meals, setMeals] = useState<PlannedMeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [loggingId, setLoggingId] = useState<string | null>(null);

    useEffect(() => {
        getTodaysPlannedMeals()
            .then(setMeals)
            .catch(err => console.error('Error loading planned meals:', err))
            .finally(() => setLoading(false));
    }, []);

    async function handleLog(entry: PlannedMeal) {
        haptics.tap();
        setLoggingId(entry.id);
        try {
            await logPlannedMealAsEaten(entry);
            setMeals(prev => prev.map(m => m.id === entry.id ? { ...m, status: 'logged' } : m));
            toast.success(`${entry.name} logged!`);
            onLogged?.();
        } catch {
            toast.error('Failed to log meal');
        } finally {
            setLoggingId(null);
        }
    }

    if (loading || meals.length === 0) return null;

    return (
        <Card stagger={stagger} aria-label={t.dashboard.plannedMeals}>
            <div className="flex items-center gap-2 mb-3">
                <Salad className="w-4 h-4" style={{ color: 'var(--color-success)' }} aria-hidden="true" />
                <h3 className="font-semibold text-sm text-[var(--color-text)] uppercase tracking-wide">{t.dashboard.plannedMeals}</h3>
            </div>

            <div className="space-y-2">
                {meals.map(meal => (
                    <div
                        key={meal.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl border"
                        style={{ borderColor: 'var(--color-border-light)', background: 'var(--color-bg-subtle)' }}
                    >
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                <span>{slotLabel(meal.slot)}</span>
                                {meal.scheduled_time && <span>· {meal.scheduled_time.slice(0, 5)}</span>}
                            </div>
                            <p className="font-bold text-sm text-[var(--color-text)] truncate mt-0.5">{meal.name}</p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {meal.calories} cal · {meal.protein}g P
                            </p>
                        </div>

                        {meal.status === 'planned' && (
                            <button
                                onClick={() => handleLog(meal)}
                                disabled={loggingId === meal.id}
                                className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                                style={{ background: 'var(--color-primary)', color: 'white' }}
                            >
                                {loggingId === meal.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : t.dashboard.logAsPlanned
                                }
                            </button>
                        )}
                        {meal.status === 'logged' && (
                            <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-success)' }}>
                                <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> {t.dashboard.mealLogged}
                            </span>
                        )}
                        {meal.status === 'skipped' && (
                            <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                                <XCircle className="w-4 h-4" aria-hidden="true" /> {t.dashboard.mealSkipped}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
}
