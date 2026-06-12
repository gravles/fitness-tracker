'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Plus, Dumbbell, UtensilsCrossed, ChartLine } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export function BottomNav() {
    const pathname = usePathname();
    const { t } = useLanguage();

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

    const leftItems = [
        { href: '/',          icon: Home,            label: t.nav.home    },
        { href: '/schedule',  icon: Dumbbell,        label: t.nav.workout },
    ];
    const rightItems = [
        { href: '/nutrition', icon: UtensilsCrossed, label: t.nav.eat     },
        { href: '/trends',    icon: ChartLine,       label: t.nav.trends  },
    ];

    const renderItem = ({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) => {
        const active = href === '/' ? pathname === '/' : isActive(href);
        return (
            <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center gap-0.5 py-1 px-3 tap-target focus-ring min-w-[56px]"
                aria-current={active ? 'page' : undefined}
                aria-label={label}
            >
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
                        style={{ color: active ? 'var(--color-gold-text)' : 'var(--color-text-muted)' }}
                        strokeWidth={active ? 2.5 : 1.75}
                        aria-hidden="true"
                    />
                </div>
                <span
                    className="text-[10px] font-semibold tracking-wide transition-colors duration-200"
                    style={{ color: active ? 'var(--color-gold-text)' : 'var(--color-text-muted)' }}
                >
                    {label}
                </span>
            </Link>
        );
    };

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 pb-safe pt-2 px-2 flex justify-around items-end z-50 max-w-2xl mx-auto"
            style={{
                background: 'var(--color-surface-elevated)',
                borderTop: '1px solid var(--color-border)',
            }}
            role="navigation"
            aria-label="Main navigation"
        >
            {leftItems.map(renderItem)}

            <Link
                href="/log"
                aria-label={t.nav.log}
                aria-current={isActive('/log') ? 'page' : undefined}
                className="relative -mt-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform focus-ring"
                style={{
                    background: 'var(--color-primary)',
                    border: '3px solid var(--color-surface-elevated)',
                    boxShadow: 'var(--shadow-lg)',
                }}
            >
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} aria-hidden="true" />
            </Link>

            {rightItems.map(renderItem)}
        </nav>
    );
}
