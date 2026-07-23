'use client';

import Link from 'next/link';
import {
    Bot, Trophy, Users, Camera, Scale, Calendar, CircleHelp, Settings,
    Pill, ChevronRight, Zap, UtensilsCrossed, type LucideIcon,
} from 'lucide-react';
import { useXpRowEnabled, setXpRowEnabled } from '@/components/kinetic/XpRow';

interface HubItem {
    href: string;
    icon: LucideIcon;
    title: string;
    sub: string;
}

const SECTIONS: { heading: string; items: HubItem[] }[] = [
    {
        heading: 'Training',
        items: [
            { href: '/coach',    icon: Bot,    title: 'AI Coach',    sub: 'Chat, plans & weekly insights' },
            { href: '/programs', icon: Trophy, title: 'Programs',    sub: '12-week training plans' },
            { href: '/nutrition/planner', icon: UtensilsCrossed, title: 'Meal Planner', sub: 'AI meal plans, saved meals & pantry' },
        ],
    },
    {
        heading: 'Progress',
        items: [
            { href: '/progress',    icon: Camera,   title: 'Progress Photos',   sub: 'Visual journey & comparisons' },
            { href: '/metrics',     icon: Scale,    title: 'Body Metrics',      sub: 'Weight & measurements' },
            { href: '/supplements', icon: Pill,     title: 'Supplements & Meds', sub: 'Doses, schedules & reminders' },
            { href: '/calendar',    icon: Calendar, title: 'History',           sub: 'Monthly activity calendar' },
        ],
    },
    {
        heading: 'Social',
        items: [
            { href: '/partner', icon: Users, title: 'Workout Partners', sub: 'Shared progress & challenges' },
        ],
    },
    {
        heading: 'App',
        items: [
            { href: '/settings', icon: Settings,   title: 'Settings', sub: 'Profile, targets & integrations' },
            { href: '/help',     icon: CircleHelp, title: 'Help',     sub: 'Guides & tips' },
        ],
    },
];

function XpHomeToggle() {
    const enabled = useXpRowEnabled();

    function toggle() {
        setXpRowEnabled(!enabled);
    }

    return (
        <button
            onClick={toggle}
            role="switch"
            aria-checked={enabled}
            className="w-full flex items-center gap-4 p-4 transition-colors hover:bg-[var(--color-bg-subtle)] focus-ring text-left"
        >
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold-text)' }}
            >
                <Zap className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Show XP on Home</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    Compact level & XP row on the dashboard
                </p>
            </div>
            <span
                aria-hidden="true"
                className="w-11 h-6 rounded-full p-0.5 flex-shrink-0 transition-colors"
                style={{ background: enabled ? 'var(--color-gold)' : 'var(--color-bg-muted)' }}
            >
                <span
                    className="block w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0)' }}
                />
            </span>
        </button>
    );
}

export default function MorePage() {
    return (
        <main className="p-6 pt-12 pb-28 space-y-6 max-w-2xl mx-auto">
            <header>
                <h1
                    className="text-2xl font-semibold"
                    style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                >
                    More
                </h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                    Everything that isn&apos;t on the main tabs
                </p>
            </header>

            <section aria-label="Preferences">
                <h2 className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--color-text-muted)' }}>
                    Preferences
                </h2>
                <div
                    className="rounded-2xl border overflow-hidden shadow-sm"
                    style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                >
                    <XpHomeToggle />
                </div>
            </section>

            {SECTIONS.map(({ heading, items }) => (
                <section key={heading} aria-label={heading}>
                    <h2 className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--color-text-muted)' }}>
                        {heading}
                    </h2>
                    <div
                        className="rounded-2xl border overflow-hidden shadow-sm"
                        style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
                    >
                        {items.map(({ href, icon: Icon, title, sub }, i) => (
                            <Link
                                key={href}
                                href={href}
                                className="flex items-center gap-4 p-4 transition-colors hover:bg-[var(--color-bg-subtle)] focus-ring"
                                style={i > 0 ? { borderTop: '1px solid var(--color-border-light)' } : undefined}
                            >
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold-text)' }}
                                >
                                    <Icon className="w-5 h-5" aria-hidden="true" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{title}</p>
                                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
                            </Link>
                        ))}
                    </div>
                </section>
            ))}
        </main>
    );
}
