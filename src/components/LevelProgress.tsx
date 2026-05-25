'use client';

import { Zap } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface LevelProgressProps {
    level: number;
    xp: number;
    /** XP earned per day for the last 7 days, oldest → newest */
    weeklyXP?: number[];
    onClick?: () => void;
}

const DAY_LABELS = Array.from({ length: 7 }, (_, i) =>
    format(subDays(new Date(), 6 - i), 'EEE')[0]
);

/** Mirror of xpForLevel in api.ts — inlined to avoid importing supabase in a client component */
function xpForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.round(100 * (Math.pow(1.15, level - 1) - 1) / 0.15);
}

export function LevelProgress({ level, xp, weeklyXP, onClick }: LevelProgressProps) {
    const currentLevelXP  = xpForLevel(level);
    const nextLevelXP     = xpForLevel(level + 1);
    const neededForLevel  = nextLevelXP - currentLevelXP;
    const progressXP      = xp - currentLevelXP;
    const percent         = Math.min(100, Math.max(0, (progressXP / neededForLevel) * 100));
    const toNext          = nextLevelXP - xp;

    const maxWeekly = weeklyXP ? Math.max(...weeklyXP, 1) : 1;

    return (
        <div
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
            aria-label={onClick ? `Level ${level} XP progress. Click to view history.` : undefined}
            className={`bg-[var(--color-surface-elevated)] p-4 rounded-xl border border-[var(--color-border-light)] shadow-sm transition-all ${onClick ? 'cursor-pointer hover:border-[var(--color-primary)]/30 hover:shadow-md focus-ring tap-target' : ''}`}
        >
            {/* Level header */}
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 font-bold rounded-xl flex items-center justify-center shadow-sm text-lg"
                        style={{ background: 'var(--color-gold)', color: 'var(--color-navy)' }}
                    >
                        {level}
                    </div>
                    <div>
                        <h4 className="font-bold text-[var(--color-text)] text-sm">Level {level}</h4>
                        <p className="text-xs text-[var(--color-text-muted)]">{xp.toLocaleString()} Lifetime XP</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-sm font-bold text-[var(--color-primary)]">{toNext}</span>
                    <span className="text-xs text-[var(--color-text-muted)]"> XP to next</span>
                </div>
            </div>

            {/* XP progress bar */}
            <div className="h-2 w-full bg-[var(--color-bg-muted)] rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${percent}%`, background: 'var(--color-primary)' }}
                    role="progressbar"
                    aria-valuenow={progressXP}
                    aria-valuemin={0}
                    aria-valuemax={100}
                />
            </div>

            {/* Weekly XP mini bars */}
            {weeklyXP && weeklyXP.length === 7 && (
                <div className="mt-3">
                    <div className="flex items-end gap-1 h-8">
                        {weeklyXP.map((dayXP, i) => {
                            const heightPx = Math.max(3, Math.round((dayXP / maxWeekly) * 28));
                            const isToday = i === 6;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                    <div
                                        className="w-full rounded-t transition-all duration-300"
                                        style={{
                                            height: `${heightPx}px`,
                                            background: dayXP > 0
                                                ? isToday ? 'var(--color-primary)' : 'rgba(29,95,168,0.45)'
                                                : 'var(--color-bg-muted)',
                                        }}
                                        title={`${dayXP} XP`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex gap-1 mt-1">
                        {DAY_LABELS.map((d, i) => (
                            <div
                                key={i}
                                className="flex-1 text-center"
                                style={{
                                    fontSize: 9,
                                    color: i === 6 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                    fontWeight: i === 6 ? 700 : 400,
                                }}
                            >
                                {d}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
