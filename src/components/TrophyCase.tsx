'use client';

import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { BADGES, BadgeDefinition, getNewlyEarnedBadges } from '@/lib/gamification';
import { UserBadge, getUserBadges, getStreak, getMonthlyLogs, awardBadge, getSettings, getLifetimeLogCount } from '@/lib/api';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

interface TrophyCaseProps {
    earnedBadges: UserBadge[];
    onBadgesUpdated?: (badges: UserBadge[]) => void;
}

export function TrophyCase({ earnedBadges: initialBadges, onBadgesUpdated }: TrophyCaseProps) {
    const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>(initialBadges);
    const [syncing, setSyncing] = useState(false);
    const earnedIds = new Set(earnedBadges.map(b => b.badge_id));

    async function syncBadges() {
        setSyncing(true);
        try {
            const today = new Date();
            const startStr = format(subDays(today, 30), 'yyyy-MM-dd');
            const endStr = format(today, 'yyyy-MM-dd');

            const [streak, recentLogs, currentBadges, settings, totalLogs] = await Promise.all([
                getStreak(),
                getMonthlyLogs(startStr, endStr),
                getUserBadges(),
                getSettings(),
                getLifetimeLogCount(),
            ]);

            const alreadyEarned = new Set(currentBadges.map((b: UserBadge) => b.badge_id));
            const newBadges = getNewlyEarnedBadges(recentLogs, streak, {
                totalLogs,
                proteinGoal: settings?.target_protein || undefined,
            }, alreadyEarned);

            if (newBadges.length === 0) {
                toast('No new badges — keep logging to unlock more!', { icon: '🏆' });
            } else {
                await Promise.all(newBadges.map((b: BadgeDefinition) => awardBadge(b.id)));
                newBadges.forEach((b: BadgeDefinition) =>
                    toast.success(`${b.icon} Badge unlocked: ${b.name}!`, { duration: 5000 })
                );
            }

            // Refresh badge list
            const updated = await getUserBadges();
            setEarnedBadges(updated);
            onBadgesUpdated?.(updated);
        } catch (e) {
            console.error('Badge sync failed', e);
            toast.error('Failed to sync badges');
        } finally {
            setSyncing(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                    🏆 Trophy Case
                    <span className="text-xs font-normal text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] px-2 py-1 rounded-full">
                        {earnedIds.size} / {BADGES.length}
                    </span>
                </h3>
                <button
                    onClick={syncBadges}
                    disabled={syncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                    style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                >
                    {syncing
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RefreshCw className="w-3.5 h-3.5" />
                    }
                    {syncing ? 'Checking…' : 'Sync'}
                </button>
            </div>

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
