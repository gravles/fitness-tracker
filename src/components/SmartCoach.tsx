'use client';

import { CoachingTip } from '@/lib/smartCoach';
import { Sparkles, Flame, AlertCircle, Lightbulb, ChartNoAxesColumn } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { Card } from '@/components/ui';

interface SmartCoachProps {
    tip: CoachingTip | null;
    onWeeklyAnalysis?: () => void;
    stagger?: number;
}

export function SmartCoach({ tip, onWeeklyAnalysis, stagger }: SmartCoachProps) {
    const { t } = useLanguage();
    if (!tip) return null;

    const accents = {
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        info: 'var(--color-gold-text)',
    };

    const icons = {
        success: Flame,
        warning: AlertCircle,
        info: Lightbulb,
    };

    const Icon = icons[tip.type] ?? Sparkles;
    const accent = accents[tip.type] ?? 'var(--color-gold-text)';

    return (
        <Card stagger={stagger} padding="sm">
            <div role="status" aria-live="polite" className="flex gap-3 items-start">
                <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accent }} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--color-text)]">{tip.title}</p>
                    <p className="text-sm mt-0.5 leading-relaxed text-[var(--color-text-secondary)]">{tip.message}</p>
                </div>
            </div>
            {onWeeklyAnalysis && (
                <button
                    onClick={onWeeklyAnalysis}
                    className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline focus-ring rounded"
                >
                    <ChartNoAxesColumn className="w-3.5 h-3.5" aria-hidden="true" />
                    {t.dashboard.weeklyAnalysis}
                </button>
            )}
        </Card>
    );
}
