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
        { href: '/schedule', icon: Dumbbell, label: 'Workout' },
        { href: '/coach', icon: Bot, label: 'Coach' },
        { href: '/trends', icon: TrendingUp, label: 'Trends' },
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 bg-[var(--color-surface-elevated)]/90 backdrop-blur-lg border-t border-[var(--color-border)] pb-safe pt-2 px-4 flex justify-around items-center z-50 max-w-2xl mx-auto"
            role="navigation"
            aria-label="Main navigation"
        >
            {navItems.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        className="flex flex-col items-center gap-1 py-1 px-3 tap-target focus-ring"
                        aria-current={active ? 'page' : undefined}
                        aria-label={label}
                    >
                        <div className={`p-2 rounded-2xl transition-all duration-200 ${
                            active
                                ? 'bg-[var(--color-primary)]/15 scale-110'
                                : 'hover:bg-[var(--color-bg-muted)]'
                        }`}>
                            <Icon
                                className={`w-5 h-5 transition-colors duration-200 ${
                                    active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
                                }`}
                                aria-hidden="true"
                            />
                        </div>
                        <span className={`text-[10px] font-semibold tracking-wide transition-colors duration-200 ${
                            active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
                        }`}>
                            {label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
