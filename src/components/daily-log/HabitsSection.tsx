'use client';

import { Check, Settings } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';

interface HabitsSectionProps {
    habits: string[];
    setHabits: (habits: string[]) => void;
    availableHabits: string[];
}

export function HabitsSection({ habits, setHabits, availableHabits }: HabitsSectionProps) {
    const { t } = useLanguage();

    function toggleHabit(habit: string) {
        if (habits.includes(habit)) {
            setHabits(habits.filter(h => h !== habit));
        } else {
            setHabits([...habits, habit]);
        }
    }

    if (!availableHabits || availableHabits.length === 0) {
        return (
            <section className="bg-[var(--color-surface-elevated)] p-6 rounded-2xl border border-[var(--color-border-light)] shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-[var(--color-text)]">
                    <span className="text-xl">✅</span> {t.habits.title}
                </h3>
                <div className="text-center py-6">
                    <p className="text-[var(--color-text-muted)] mb-3">{t.habits.noHabits}</p>
                    <Link
                        href="/profile#habits"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors text-[var(--color-text)]"
                        style={{ background: 'var(--color-bg-subtle)' }}
                    >
                        <Settings className="w-4 h-4" />
                        {t.habits.setUpHabits}
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-[var(--color-surface-elevated)] p-6 rounded-2xl border border-[var(--color-border-light)] shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-[var(--color-text)]">
                <span className="text-xl">✅</span> {t.habits.title}
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {availableHabits.map((habit) => {
                    const isCompleted = habits.includes(habit);
                    return (
                        <button
                            key={habit}
                            onClick={() => toggleHabit(habit)}
                            className="p-3 rounded-xl border text-left transition-all flex items-center justify-between"
                            style={isCompleted ? {
                                background: 'var(--color-success-muted, rgba(34,197,94,0.08))',
                                borderColor: 'var(--color-success)',
                                color: 'var(--color-success)',
                            } : {
                                background: 'var(--color-bg-subtle)',
                                borderColor: 'var(--color-border-light)',
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            <span className="font-medium text-sm">{habit}</span>
                            <div
                                className="w-6 h-6 rounded-full border flex items-center justify-center transition-colors"
                                style={isCompleted ? {
                                    background: 'var(--color-success)',
                                    borderColor: 'var(--color-success)',
                                    color: 'white',
                                } : {
                                    background: 'var(--color-surface-elevated)',
                                    borderColor: 'var(--color-border)',
                                }}
                            >
                                {isCompleted && <Check className="w-3.5 h-3.5" />}
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
