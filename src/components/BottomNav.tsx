'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, Scale, Dumbbell, UtensilsCrossed } from 'lucide-react';

export function BottomNav() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

    const navItems = [
        { href: '/',          icon: Home,            label: 'Home'    },
        { href: '/log',       icon: PlusCircle,      label: 'Log'     },
        { href: '/schedule',  icon: Dumbbell,        label: 'Workout' },
        { href: '/nutrition', icon: UtensilsCrossed, label: 'Eat'     },
        { href: '/metrics',   icon: Scale,           label: 'Metrics' },
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 pb-safe pt-2 px-2 flex justify-around items-end z-50 max-w-2xl mx-auto"
            style={{
                background: 'var(--color-surface-elevated)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderTop: '1px solid var(--color-border)',
            }}
            role="navigation"
            aria-label="Main navigation"
        >
            {navItems.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        className="relative flex flex-col items-center gap-0.5 py-1 px-3 tap-target focus-ring min-w-[56px]"
                        aria-current={active ? 'page' : undefined}
                        aria-label={label}
                    >
                        {/* Gold indicator bar */}
                        {active && (
                            <span
                                className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                                style={{ background: 'var(--color-gold)' }}
                            />
                        )}

                        <div
                            className="p-2 rounded-xl transition-all duration-200"
                            style={active ? { background: 'var(--color-gold-muted)' } : {}}
                        >
                            <Icon
                                className="w-5 h-5 transition-colors duration-200"
                                style={{ color: active ? 'var(--color-gold)' : 'var(--color-text-muted)' }}
                                strokeWidth={active ? 2.5 : 1.75}
                                aria-hidden="true"
                            />
                        </div>

                        <span
                            className="text-[10px] font-semibold tracking-wide transition-colors duration-200"
                            style={{ color: active ? 'var(--color-gold)' : 'var(--color-text-muted)' }}
                        >
                            {label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
