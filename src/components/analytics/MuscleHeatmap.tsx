'use client';

import { useMemo } from 'react';
import { MUSCLE_GROUPS, MuscleGroup, calculateMuscleVolume } from '@/lib/muscleMapping';

interface MuscleHeatmapProps {
    workouts: any[];
}

export function MuscleHeatmap({ workouts }: MuscleHeatmapProps) {
    const volume = useMemo(() => calculateMuscleVolume(workouts), [workouts]);

    const maxVol = Math.max(...Object.values(volume), 1);

    const getIntensityColor = (muscle: MuscleGroup) => {
        const val = volume[muscle] || 0;
        if (val === 0) return '#e5e7eb';

        const intensity = val / maxVol;
        if (intensity < 0.3) return '#fde047';
        if (intensity < 0.6) return '#fb923c';
        return '#ef4444';
    };

    return (
        <div className="flex flex-col md:flex-row gap-8 items-center justify-center p-4">
            {/* Front View */}
            <div className="relative h-96 w-48">
                <h4 className="text-center font-bold text-[var(--color-text-muted)] mb-2">Front</h4>
                <svg viewBox="0 0 200 400" className="w-full h-full drop-shadow-sm">
                    <circle cx="100" cy="30" r="20" fill="#d1d5db" />

                    <path d="M60 60 Q50 70 45 90 L55 95 Q65 75 70 65 Z" fill={getIntensityColor(MUSCLE_GROUPS.SHOULDERS)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M140 60 Q150 70 155 90 L145 95 Q135 75 130 65 Z" fill={getIntensityColor(MUSCLE_GROUPS.SHOULDERS)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M70 65 Q100 80 130 65 L130 95 Q100 110 70 95 Z" fill={getIntensityColor(MUSCLE_GROUPS.CHEST)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M75 100 L125 100 L120 150 L80 150 Z" fill={getIntensityColor(MUSCLE_GROUPS.ABS)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M55 95 L40 130 L50 135 L65 100 Z" fill={getIntensityColor(MUSCLE_GROUPS.BICEPS)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M145 95 L160 130 L150 135 L135 100 Z" fill={getIntensityColor(MUSCLE_GROUPS.BICEPS)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M40 130 L30 170 L40 175 L50 135 Z" fill={getIntensityColor(MUSCLE_GROUPS.FOREARMS)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M160 130 L170 170 L160 175 L150 135 Z" fill={getIntensityColor(MUSCLE_GROUPS.FOREARMS)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M70 160 L130 160 L120 240 L80 240 Z" fill={getIntensityColor(MUSCLE_GROUPS.QUADS)} className="transition-colors duration-500 ease-in-out" />
                    <line x1="100" y1="160" x2="100" y2="240" stroke="white" strokeWidth="2" />
                    <path d="M80 250 L120 250 L115 320 L85 320 Z" fill={getIntensityColor(MUSCLE_GROUPS.CALVES)} className="transition-colors duration-500 ease-in-out" />
                    <line x1="100" y1="250" x2="100" y2="320" stroke="white" strokeWidth="2" />
                </svg>
            </div>

            {/* Back View */}
            <div className="relative h-96 w-48">
                <h4 className="text-center font-bold text-[var(--color-text-muted)] mb-2">Back</h4>
                <svg viewBox="0 0 200 400" className="w-full h-full drop-shadow-sm">
                    <circle cx="100" cy="30" r="20" fill="#d1d5db" />
                    <path d="M60 60 L140 60 L130 110 L70 110 Z" fill={getIntensityColor(MUSCLE_GROUPS.BACK)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M50 65 L60 60 L70 80 L55 90 Z" fill={getIntensityColor(MUSCLE_GROUPS.SHOULDERS)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M150 65 L140 60 L130 80 L145 90 Z" fill={getIntensityColor(MUSCLE_GROUPS.SHOULDERS)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M55 90 L40 130 L50 135 L65 95 Z" fill={getIntensityColor(MUSCLE_GROUPS.TRICEPS)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M145 90 L160 130 L150 135 L135 95 Z" fill={getIntensityColor(MUSCLE_GROUPS.TRICEPS)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M70 150 L130 150 L135 180 L65 180 Z" fill={getIntensityColor(MUSCLE_GROUPS.GLUTES)} className="transition-colors duration-500 ease-in-out" />
                    <path d="M70 185 L130 185 L125 250 L75 250 Z" fill={getIntensityColor(MUSCLE_GROUPS.HAMSTRINGS)} className="transition-colors duration-500 ease-in-out" />
                    <line x1="100" y1="185" x2="100" y2="250" stroke="white" strokeWidth="2" />
                    <path d="M75 255 L125 255 L120 310 L80 310 Z" fill={getIntensityColor(MUSCLE_GROUPS.CALVES)} className="transition-colors duration-500 ease-in-out" />
                    <line x1="100" y1="255" x2="100" y2="330" stroke="white" strokeWidth="2" />
                </svg>
            </div>

            {/* Legend */}
            <div className="absolute bottom-0 right-0 p-4 md:static md:p-0">
                <div className="bg-[var(--color-surface-elevated)] p-3 rounded-lg border border-[var(--color-border-light)] shadow-sm text-xs space-y-2">
                    <div className="font-bold mb-1 text-[var(--color-text)]">Activity Level</div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[var(--color-border)]"></div>
                        <span className="text-[var(--color-text-muted)]">None</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-300"></div>
                        <span className="text-[var(--color-text-muted)]">Low</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                        <span className="text-[var(--color-text-muted)]">Medium</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-[var(--color-text-muted)]">High</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
