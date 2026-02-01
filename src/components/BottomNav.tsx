'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, Bot, Dumbbell, TrendingUp } from 'lucide-react';

export function BottomNav() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

    const navItems = [
        { href: '/', icon: Home, label: 'Home' },
        { href: '/log', icon: PlusCircle, label: 'Log' },
        { href: '/coach', icon: Bot, label: 'Coach' },
        { href: '/workout/templates', icon: Dumbbell, label: 'Workouts' },
        { href: '/trends', icon: TrendingUp, label: 'Trends' },
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 bg-[var(--color-surface-elevated)]/90 backdrop-blur-lg border-t border-[var(--color-border)] pb-safe pt-2 px-4 flex justify-around items-center z-50 max-w-2xl mx-auto"
            role="navigation"
            aria-label="Main navigation"
        >
            {navItems.map(({ href, icon: Icon, label }) => (
                <Link
                    key={href}
                    href={href}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all tap-target focus-ring ${isActive(href)
                        ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]'
                        }`}
                    aria-current={isActive(href) ? 'page' : undefined}
                    aria-label={label}
                >
                    <Icon className="w-6 h-6" aria-hidden="true" />
                    <span className="text-[10px] font-semibold tracking-wide">{label}</span>
                </Link>
            ))}
        </nav>
    );
}
