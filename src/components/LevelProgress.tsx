'use client';

import { Zap } from 'lucide-react';

interface LevelProgressProps {
    level: number;
    xp: number;
    onClick?: () => void;
}

export function LevelProgress({ level, xp, onClick }: LevelProgressProps) {
    const startXP = (level - 1) * 100;
    const endXP = level * 100;
    const progressXP = xp - startXP;
    const percent = Math.min(100, Math.max(0, (progressXP / 100) * 100));

    return (
        <div
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
            aria-label={onClick ? `Level ${level} XP progress. Click to view history.` : undefined}
            className={`bg-[var(--color-surface-elevated)] p-4 rounded-xl border border-[var(--color-border-light)] shadow-sm transition-all ${onClick ? 'cursor-pointer hover:border-[var(--color-primary)]/30 hover:shadow-md focus-ring tap-target' : ''}`}
        >
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
                    <span className="text-sm font-bold text-[var(--color-primary)]">{100 - progressXP}</span>
                    <span className="text-xs text-[var(--color-text-muted)]"> XP to next</span>
                </div>
            </div>

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
        </div>
    );
}
