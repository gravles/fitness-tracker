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
            <h3 id="weekly-summary-heading" className="sr-only">Weekly Summary</h3>
            <div className="grid grid-cols-4 gap-2">
                {cards.map((card, idx) => (
                    <div
                        key={idx}
                        className="glass-card p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1 hover:scale-[1.02] transition-transform"
                    >
                        {card.icon ? (
                            <card.icon className={`w-5 h-5 ${card.iconColor} mb-1`} aria-hidden="true" />
                        ) : (
                            <span className="text-xl mb-1" aria-hidden="true">{card.emoji}</span>
                        )}
                        <span className="text-xl font-bold text-[var(--color-text)]">{card.value}</span>
                        <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">{card.label}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
