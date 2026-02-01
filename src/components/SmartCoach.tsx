import { CoachingTip } from '@/lib/smartCoach';
import { Lightbulb, Info, Flame, AlertCircle } from 'lucide-react';

export function SmartCoach({ tip }: { tip: CoachingTip | null }) {
    if (!tip) return null;

    const styles = {
        success: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/25',
        warning: 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-orange-500/25',
        info: 'bg-[var(--color-surface-elevated)] text-[var(--color-text)] border border-[var(--color-border-light)] shadow-sm'
    };

    const icons = {
        success: Flame,
        warning: AlertCircle,
        info: Lightbulb
    };

    const Icon = icons[tip.type] || Info;

    return (
        <div
            className={`p-5 rounded-2xl shadow-lg ${styles[tip.type]} relative overflow-hidden transition-all duration-300 hover:scale-[1.01]`}
            role="status"
            aria-live="polite"
        >
            <div className="relative z-10 flex gap-4 items-start">
                <div
                    className={`p-2.5 rounded-xl ${tip.type === 'info'
                            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                            : 'bg-white/20 text-white'
                        }`}
                    aria-hidden="true"
                >
                    <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-lg ${tip.type === 'info' ? 'text-[var(--color-text)]' : 'text-white'
                        }`}>
                        {tip.title}
                    </h3>
                    <p className={`text-sm mt-1 leading-relaxed ${tip.type === 'info' ? 'text-[var(--color-text-secondary)]' : 'text-white/90'
                        }`}>
                        {tip.message}
                    </p>
                </div>
            </div>

            {/* Decorative background element */}
            {tip.type !== 'info' && (
                <div className="absolute -right-8 -bottom-8 opacity-10 rotate-12" aria-hidden="true">
                    <Icon className="w-32 h-32" />
                </div>
            )}
        </div>
    );
}
