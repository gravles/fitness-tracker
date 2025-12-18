'use client';

import { Zap } from 'lucide-react';

interface LevelProgressProps {
    level: number;
    xp: number;
}

export function LevelProgress({ level, xp }: LevelProgressProps) {
    // Determine bounds for current level
    // Level 1: 0-100
    // Level 2: 100-200
    // Level N: (N-1)*100 to N*100
    const startXP = (level - 1) * 100;
    const endXP = level * 100;
    const progressXP = xp - startXP;
    const percent = Math.min(100, Math.max(0, (progressXP / 100) * 100));

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-yellow-400 text-yellow-900 font-bold rounded-lg flex items-center justify-center shadow-sm">
                        {level}
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 text-sm">Level {level}</h4>
                        <p className="text-xs text-gray-500">{xp} Lifetime XP</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-xs font-bold text-blue-600">{100 - progressXP} XP</span>
                    <span className="text-xs text-gray-400"> to next level</span>
                </div>
            </div>

            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500 ease-out relative"
                    style={{ width: `${percent}%` }}
                >
                    <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse"></div>
                </div>
            </div>
        </div>
    );
}
