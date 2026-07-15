'use client';

import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
    lines?: number;
}

/**
 * Skeleton loading placeholder component
 * Uses shimmer animation defined in globals.css
 */
export function Skeleton({
    className = '',
    variant = 'rectangular',
    width,
    height,
    lines = 1
}: SkeletonProps) {
    const baseClasses = 'skeleton';

    const variantClasses = {
        text: 'h-4 rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-xl',
    };

    const style: React.CSSProperties = {
        width: width || (variant === 'text' ? '100%' : undefined),
        height: height || (variant === 'circular' ? width : undefined),
    };

    if (lines > 1 && variant === 'text') {
        return (
            <div className="space-y-2">
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
                        style={{
                            ...style,
                            width: i === lines - 1 ? '75%' : '100%'
                        }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
        />
    );
}

/**
 * Pre-built skeleton for dashboard cards
 */
export function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Level Progress Skeleton */}
            <div className="bg-[var(--color-surface-elevated)] p-4 rounded-xl border border-[var(--color-border-light)]">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <Skeleton variant="rectangular" width={32} height={32} />
                        <div className="space-y-1">
                            <Skeleton variant="text" width={80} height={14} />
                            <Skeleton variant="text" width={60} height={12} />
                        </div>
                    </div>
                    <Skeleton variant="text" width={80} height={12} />
                </div>
                <Skeleton variant="rectangular" width="100%" height={12} className="rounded-full" />
            </div>

            {/* Smart Coach Skeleton */}
            <Skeleton variant="rectangular" width="100%" height={100} />

            {/* Streak Card Skeleton */}
            <Skeleton variant="rectangular" width="100%" height={140} className="rounded-2xl" />

            {/* Weekly Summary Skeleton */}
            <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} variant="rectangular" width="100%" height={70} />
                ))}
            </div>

            {/* Quick Add Skeleton */}
            <div className="grid grid-cols-2 gap-3">
                <Skeleton variant="rectangular" width="100%" height={90} />
                <Skeleton variant="rectangular" width="100%" height={90} />
            </div>

            {/* Log Today Card Skeleton */}
            <Skeleton variant="rectangular" width="100%" height={80} />
        </div>
    );
}

/**
 * Tab-page skeleton: mirrors the common "tab bar + stacked cards" layout of
 * schedule/nutrition/trends so page loads don't shift content.
 */
export function TabPageSkeleton({ cards = 3 }: { cards?: number }) {
    return (
        <div className="space-y-4" aria-hidden="true">
            <Skeleton variant="rectangular" width="100%" height={44} className="rounded-xl" />
            {Array.from({ length: cards }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" width="100%" height={i === 0 ? 220 : 110} className="rounded-2xl" />
            ))}
        </div>
    );
}

/**
 * Settings skeleton: header + stacked section cards.
 */
export function SettingsSkeleton() {
    return (
        <div className="p-6 pt-12 space-y-5 max-w-2xl mx-auto" aria-hidden="true">
            <Skeleton variant="text" width={160} height={28} />
            {[220, 180, 260, 140].map((h, i) => (
                <Skeleton key={i} variant="rectangular" width="100%" height={h} className="rounded-2xl" />
            ))}
        </div>
    );
}
