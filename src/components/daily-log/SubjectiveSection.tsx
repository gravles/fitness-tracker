'use client';

import { Brain, Moon, Zap, Activity, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

interface SubjectiveSectionProps {
    subjective: {
        sleep: number;
        energy: number;
        motivation: number;
        stress: number;
        note: string;
    };
    setSubjective: (val: any) => void;
}

export function SubjectiveSection({ subjective, setSubjective }: SubjectiveSectionProps) {
    const { t } = useLanguage();

    const metrics = [
        {
            label: t.subjective.metrics.sleep,
            icon: <Moon className="w-4 h-4" />,
            key: 'sleep',
            emojis: ['😴', '😐', '🙂', '😊', '🌟'],
        },
        {
            label: t.subjective.metrics.energy,
            icon: <Zap className="w-4 h-4" />,
            key: 'energy',
            emojis: ['🔋', '😑', '🙂', '😃', '⚡'],
        },
        {
            label: t.subjective.metrics.motivation,
            icon: <Activity className="w-4 h-4" />,
            key: 'motivation',
            emojis: ['😩', '😕', '🙂', '💪', '🔥'],
        },
        {
            label: t.subjective.metrics.stress,
            icon: <AlertCircle className="w-4 h-4" />,
            key: 'stress',
            emojis: ['😌', '🙂', '😐', '😟', '😤'],
        },
    ];

    function getEmoji(metric: typeof metrics[0], value: number) {
        return metric.emojis[value - 1] || '😐';
    }

    return (
        <section className="bg-[var(--color-surface-elevated)] p-6 rounded-2xl border border-[var(--color-border-light)] shadow-sm">
            <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-[var(--color-text)]">
                <Brain className="w-5 h-5" style={{ color: 'var(--color-primary)' }} /> {t.subjective.title}
            </h3>

            <div className="space-y-6">
                {metrics.map((metric) => {
                    const value = (subjective as any)[metric.key];
                    return (
                        <div key={metric.key}>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium text-[var(--color-text-muted)] flex items-center gap-2">
                                    {metric.icon} {metric.label}
                                </label>
                                <span className="font-bold text-[var(--color-text)] flex items-center gap-1">
                                    <span className="text-lg">{getEmoji(metric, value)}</span>
                                    <span className="text-sm text-[var(--color-text-muted)]">{value}/5</span>
                                </span>
                            </div>
                            <input
                                type="range"
                                min="1" max="5" step="1"
                                value={value}
                                onChange={(e) => setSubjective({ ...subjective, [metric.key]: parseInt(e.target.value) })}
                                className="w-full h-2 bg-[var(--color-bg-muted)] rounded-lg appearance-none cursor-pointer"
                                style={{ accentColor: 'var(--color-primary)' }}
                            />
                            <div className="flex justify-between text-sm mt-2 px-1">
                                {metric.emojis.map((emoji, idx) => (
                                    <span
                                        key={idx}
                                        className={`transition-all duration-150 ${value === idx + 1 ? 'scale-125' : 'opacity-40'}`}
                                    >
                                        {emoji}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}

                <div>
                    <label className="text-sm font-medium text-[var(--color-text-muted)] mb-2 block">{t.subjective.dailyNotes}</label>
                    <textarea
                        value={subjective.note}
                        onChange={(e) => setSubjective({ ...subjective, note: e.target.value })}
                        placeholder={t.subjective.notesPlaceholder}
                        className="w-full p-3 bg-[var(--color-bg-subtle)] text-[var(--color-text)] rounded-xl border border-[var(--color-border-light)] outline-none h-24 resize-none placeholder:text-[var(--color-text-muted)]"
                        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                        onBlur={e => { e.target.style.borderColor = ''; }}
                    />
                </div>
            </div>
        </section>
    );
}
