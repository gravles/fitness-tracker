'use client';

import { Zap } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { StatTile } from '@/components/ui';

interface LevelProgressProps {
    level: number;
    xp: number;
    onClick?: () => void;
    stagger?: number;
}

function xpForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.round(100 * (Math.pow(1.15, level - 1) - 1) / 0.15);
}

export function LevelProgress({ level, xp, onClick, stagger }: LevelProgressProps) {
    const { t } = useLanguage();

    const currentLevelXP  = xpForLevel(level);
    const nextLevelXP     = xpForLevel(level + 1);
    const neededForLevel  = nextLevelXP - currentLevelXP;
    const progressXP      = xp - currentLevelXP;
    const percent         = Math.min(100, Math.max(0, (progressXP / neededForLevel) * 100));
    const toNext          = nextLevelXP - xp;

    return (
        <StatTile
            icon={Zap}
            iconColor="var(--color-gold-text)"
            label={`${t.dashboard.level} ${level}`}
            value={<>{toNext.toLocaleString()} <span className="text-[11px] font-normal text-[var(--color-text-muted)]">{t.levelProgress.xpToNext}</span></>}
            sub={`${xp.toLocaleString()} ${t.levelProgress.lifetimeXP}`}
            onClick={onClick}
            stagger={stagger}
            aria-label={`Level ${level} XP progress. Click to view history.`}
        >
            <div
                className="h-1.5 w-full bg-[var(--color-bg-muted)] rounded-full overflow-hidden mt-2"
                role="progressbar"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${percent}%`, background: 'var(--color-gold)' }}
                />
            </div>
        </StatTile>
    );
}
