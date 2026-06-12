import { Dumbbell, Utensils, Scale, Beer } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

interface WeeklyStats {
    avgWeight: number;
    totalMovement: number;
    avgProtein: number;
    totalAlcohol: number;
}

export function WeeklySummary({ stats }: { stats: WeeklyStats }) {
    const { t } = useLanguage();

    const cards = [
        {
            icon: Scale,
            iconStyle: { color: 'var(--color-gold-text)' },
            value: stats.avgWeight > 0 ? stats.avgWeight : '--',
            label: t.weeklyStats.avgLbs,
        },
        {
            icon: Dumbbell,
            iconStyle: { color: 'var(--color-primary)' },
            value: stats.totalMovement,
            label: t.weeklyStats.mins,
        },
        {
            icon: Utensils,
            iconStyle: { color: 'var(--color-success)' },
            value: stats.avgProtein,
            label: t.weeklyStats.prot,
        },
        {
            icon: Beer,
            iconStyle: { color: 'var(--chart-5)' },
            value: stats.totalAlcohol,
            label: t.weeklyStats.drinks,
        },
    ];

    return (
        <section aria-labelledby="weekly-summary-heading" className="animate-in" style={{ ['--stagger' as string]: '300ms' }}>
            <h3 id="weekly-summary-heading" className="font-semibold text-sm text-[var(--color-text)] uppercase tracking-wide mb-3 px-1">{t.dashboard.thisWeek}</h3>
            <div className="grid grid-cols-4 gap-2">
                {cards.map((card, idx) => (
                    <div
                        key={idx}
                        className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-light)] p-3 flex flex-col items-center justify-center text-center gap-1 shadow-sm hover:border-[var(--color-border)] hover:shadow-md transition-all"
                        style={{ borderRadius: 'var(--radius-control)' }}
                    >
                        <card.icon className="w-4 h-4 mb-0.5" style={card.iconStyle} aria-hidden="true" />
                        <span className="text-lg font-semibold text-[var(--color-text)] tabular-nums">{card.value}</span>
                        <span className="text-[9px] uppercase font-semibold tracking-wide text-[var(--color-text-muted)]">{card.label}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
