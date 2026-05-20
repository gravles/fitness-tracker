'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Calendar, Dumbbell, Sparkles, Clock } from 'lucide-react';
import Link from 'next/link';

export default function WorkoutHubPage() {
    const router = useRouter();

    return (
        <main className="min-h-screen pb-24" style={{ background: 'var(--color-bg)' }}>
            {/* Header */}
            <header
                className="sticky top-0 z-10 backdrop-blur-lg border-b px-4 py-4 safe-top"
                style={{
                    background: 'var(--color-surface-elevated)',
                    borderColor: 'var(--color-border)',
                }}
            >
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-xl transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1
                        className="text-xl font-bold"
                        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
                    >
                        Workout Hub
                    </h1>
                    <div className="w-10" />
                </div>
            </header>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
                {/* Quick Start Section */}
                <section className="space-y-3">
                    <h2
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        Quick Start
                    </h2>

                    <Link
                        href="/workout/active/new"
                        className="block p-5 rounded-2xl text-white shadow-xl active:scale-[0.98] transition-all"
                        style={{ background: 'var(--color-navy)' }}
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl" style={{ background: 'rgba(201,168,76,0.15)' }}>
                                <Play className="w-6 h-6" style={{ color: 'var(--color-gold)' }} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-white">Start New Workout</h3>
                                <p className="text-sm" style={{ color: 'rgba(228,234,242,0.6)' }}>
                                    Begin a blank workout session
                                </p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/coach"
                        className="block p-5 rounded-2xl shadow-lg active:scale-[0.98] transition-all"
                        style={{
                            background: 'var(--color-primary)',
                            boxShadow: '0 8px 24px rgba(29,95,168,0.25)',
                        }}
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/15 rounded-xl">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-white">AI Coach</h3>
                                <p className="text-sm text-white/70">Get a personalized workout recommendation</p>
                            </div>
                        </div>
                    </Link>
                </section>

                {/* Navigation Section */}
                <section className="space-y-3">
                    <h2
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        Manage
                    </h2>

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            {
                                href: '/schedule',
                                icon: Calendar,
                                iconColor: 'var(--color-primary)',
                                title: 'Schedule',
                                sub: 'Plan your week',
                            },
                            {
                                href: '/schedule#templates',
                                icon: Dumbbell,
                                iconColor: 'var(--color-gold)',
                                title: 'Templates',
                                sub: 'Saved workouts',
                            },
                            {
                                href: '/progress',
                                icon: Clock,
                                iconColor: 'var(--color-success)',
                                title: 'History',
                                sub: 'Past workouts',
                            },
                            {
                                href: '/log',
                                icon: ArrowLeft,
                                iconColor: 'var(--color-text-muted)',
                                title: 'Back to Log',
                                sub: "Today's log",
                            },
                        ].map(({ href, icon: Icon, iconColor, title, sub }) => (
                            <Link
                                key={href}
                                href={href}
                                className="p-4 rounded-2xl border transition-all hover:shadow-md active:scale-[0.98]"
                                style={{
                                    background: 'var(--color-surface-elevated)',
                                    borderColor: 'var(--color-border-light)',
                                }}
                            >
                                <Icon className="w-6 h-6 mb-2" style={{ color: iconColor }} />
                                <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>{title}</h3>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
