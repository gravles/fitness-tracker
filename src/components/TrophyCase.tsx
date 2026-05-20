'use client';

import { BADGES, BadgeDefinition } from '@/lib/gamification';
import { UserBadge } from '@/lib/api';

interface TrophyCaseProps {
    earnedBadges: UserBadge[];
}

export function TrophyCase({ earnedBadges }: TrophyCaseProps) {
    const earnedIds = new Set(earnedBadges.map(b => b.badge_id));

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                🏆 Trophy Case
                <span className="text-xs font-normal text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] px-2 py-1 rounded-full">
                    {earnedIds.size} / {BADGES.length}
                </span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {BADGES.map(badge => {
                    const isUnlocked = earnedIds.has(badge.id);
                    return (
                        <div
                            key={badge.id}
                            className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all ${
                                isUnlocked
                                    ? 'border-[var(--color-gold)] shadow-sm scale-100 opacity-100'
                                    : 'border-[var(--color-border-light)] opacity-50 grayscale'
                            }`}
                            style={isUnlocked ? { background: 'var(--color-gold-muted)' } : { background: 'var(--color-bg-subtle)' }}
                        >
                            <div className="text-3xl mb-2 filter drop-shadow-sm">{badge.icon}</div>
                            <h4 className={`font-bold text-xs ${isUnlocked ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
                                {badge.name}
                            </h4>
                            {isUnlocked ? (
                                <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--color-gold)' }}>Unlocked!</p>
                            ) : (
                                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{badge.description}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
