'use client';

import { CoachingTip } from '@/lib/smartCoach';
import { ChartNoAxesColumn } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

interface SmartCoachProps {
    tip: CoachingTip | null;
    onWeeklyAnalysis?: () => void;
    stagger?: number;
}

/** Kinetic Coach banner — gold-tint strip with the tip and the Weekly Analysis link. */
export function SmartCoach({ tip, onWeeklyAnalysis, stagger }: SmartCoachProps) {
    const { t } = useLanguage();
    if (!tip) return null;

    return (
        <section
            aria-label="Coach"
            className="px-3.5 py-3 animate-in"
            style={{
                background: 'color-mix(in srgb, var(--color-gold) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-gold) 25%, transparent)',
                borderRadius: 'var(--radius-card)',
                ['--stagger' as string]: `${stagger ?? 0}ms`,
            }}
        >
            <div role="status" aria-live="polite" className="flex gap-2.5 items-start">
                <span className="text-xs font-bold shrink-0 mt-px" style={{ color: 'var(--color-gold-text)' }}>
                    Coach
                </span>
                <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                        <span className="font-semibold text-[var(--color-text)]">{tip.title}</span>
                        {' — '}
                        {tip.message}
                    </p>
                    {onWeeklyAnalysis && (
                        <button
                            onClick={onWeeklyAnalysis}
                            className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline focus-ring rounded"
                        >
                            <ChartNoAxesColumn className="w-3.5 h-3.5" aria-hidden="true" />
                            {t.dashboard.weeklyAnalysis}
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}
