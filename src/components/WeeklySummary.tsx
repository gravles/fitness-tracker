import { Dumbbell, Utensils, Scale } from 'lucide-react';

interface WeeklyStats {
    avgWeight: number;
    totalMovement: number;
    avgProtein: number;
    totalAlcohol: number;
}

export function WeeklySummary({ stats }: { stats: WeeklyStats }) {
    const cards = [
        {
            icon: Scale,
            iconColor: 'text-purple-500',
            value: stats.avgWeight > 0 ? stats.avgWeight : '--',
            label: 'Avg Lbs'
        },
        {
            icon: Dumbbell,
            iconColor: 'text-blue-500',
            value: stats.totalMovement,
            label: 'Mins'
        },
        {
            icon: Utensils,
            iconColor: 'text-green-500',
            value: stats.avgProtein,
            label: 'g Prot'
        },
        {
            emoji: '🍺',
            value: stats.totalAlcohol,
            label: 'Drinks'
        },
    ];

    return (
        <section aria-labelledby="weekly-summary-heading">
            <h3 id="weekly-summary-heading" className="font-bold text-[var(--color-text)] mb-3 px-1">This Week</h3>
            <div className="grid grid-cols-4 gap-2">
                {cards.map((card, idx) => (
                    <div
                        key={idx}
                        className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-light)] p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1 shadow-sm hover:border-[var(--color-border)] hover:shadow-md transition-all"
                    >
                        {card.icon ? (
                            <card.icon className={`w-4 h-4 ${card.iconColor} mb-0.5`} aria-hidden="true" />
                        ) : (
                            <span className="text-lg mb-0.5" aria-hidden="true">{card.emoji}</span>
                        )}
                        <span className="text-lg font-bold text-[var(--color-text)]">{card.value}</span>
                        <span className="text-[9px] uppercase font-bold tracking-wide text-[var(--color-text-muted)]">{card.label}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
