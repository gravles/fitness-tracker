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
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                🏆 Trophy Case
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {earnedIds.size} / {BADGES.length}
                </span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {BADGES.map(badge => {
                    const isUnlocked = earnedIds.has(badge.id);
                    return (
                        <div
                            key={badge.id}
                            className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all
                                ${isUnlocked
                                    ? 'bg-yellow-50/50 border-yellow-200 shadow-sm scale-100 opacity-100'
                                    : 'bg-gray-50 border-gray-100 opacity-60 grayscale'
                                }
                            `}
                        >
                            <div className="text-3xl mb-2 filter drop-shadow-sm">{badge.icon}</div>
                            <h4 className={`font-bold text-xs ${isUnlocked ? 'text-gray-900' : 'text-gray-400'}`}>
                                {badge.name}
                            </h4>
                            {isUnlocked ? (
                                <p className="text-[10px] text-yellow-600 font-medium mt-1">Unlocked!</p>
                            ) : (
                                <p className="text-[10px] text-gray-400 mt-1">{badge.description}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
