'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, ChevronRight, Mic, Camera, Brain, Dumbbell, Settings, Utensils, UtensilsCrossed } from 'lucide-react';

export default function HelpPage() {
    const [openSection, setOpenSection] = useState<string | null>('quick-start');

    const toggle = (id: string) => setOpenSection(openSection === id ? null : id);

    return (
        <main className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
            {/* Header */}
            <div
                className="sticky top-0 z-10"
                style={{ background: 'var(--color-surface-elevated)', borderBottom: '1px solid var(--color-border)' }}
            >
                <div className="p-4 flex items-center gap-4">
                    <Link
                        href="/settings"
                        className="p-2 rounded-full transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
                        Help &amp; User Guide
                    </h1>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-6 space-y-4">

                <Section
                    id="quick-start"
                    title="Quick Start"
                    isOpen={openSection === 'quick-start'}
                    onClick={() => toggle('quick-start')}
                >
                    <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        <p>Welcome! Here is the fastest way to get value from the app:</p>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li><strong style={{ color: 'var(--color-text)' }}>Set your Goals:</strong> Go to Settings to define your target weight and protein.</li>
                            <li><strong style={{ color: 'var(--color-text)' }}>Log your first Meal:</strong> Tap the big "Log Today" button on the dashboard.</li>
                            <li><strong style={{ color: 'var(--color-text)' }}>Track a Workout:</strong> Ask the <strong style={{ color: 'var(--color-primary)' }}>Smart Coach</strong> to build you a routine.</li>
                            <li><strong style={{ color: 'var(--color-text)' }}>Plan your meals:</strong> Tap <strong style={{ color: 'var(--color-primary)' }}>Eat</strong> in the bottom nav, add pantry items, and generate a week of meals.</li>
                        </ol>
                    </div>
                </Section>

                <Section
                    id="food"
                    title="Smart Food Logging"
                    icon={<Utensils className="w-5 h-5" style={{ color: 'var(--color-success)' }} />}
                    isOpen={openSection === 'food'}
                    onClick={() => toggle('food')}
                >
                    <div className="space-y-3">
                        <FeatureCard
                            color="success"
                            icon={<Mic className="w-4 h-4" />}
                            title="Voice Logging"
                        >
                            Tap the Microphone icon and say what you ate.
                            {' '}<em>"I had 2 eggs, toast, and a black coffee."</em>
                            {' '}The AI calculates macros automatically.
                        </FeatureCard>
                        <FeatureCard
                            color="primary"
                            icon={<Camera className="w-4 h-4" />}
                            title="Snap & Track"
                        >
                            Take a photo of your meal. The AI analyses the image to estimate portions and nutrition.
                        </FeatureCard>
                        <FeatureCard
                            color="gold"
                            icon={<Brain className="w-4 h-4" />}
                            title="Menu Scanner"
                        >
                            At a restaurant? Scan the physical menu and the AI will recommend the highest-protein options.
                        </FeatureCard>
                    </div>
                </Section>

                <Section
                    id="nutrition"
                    title="Meal Planner"
                    icon={<UtensilsCrossed className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />}
                    isOpen={openSection === 'nutrition'}
                    onClick={() => toggle('nutrition')}
                >
                    <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        <p>Tap <strong style={{ color: 'var(--color-text)' }}>Eat</strong> in the bottom nav to access the Meal Planner.</p>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li><strong style={{ color: 'var(--color-text)' }}>Build your Pantry:</strong> Add foods you normally have at home. Use <em>Scan Photo</em> to take a picture of your fridge, or tap <em>Voice</em> and read out your ingredients — the AI categorises everything automatically.</li>
                            <li><strong style={{ color: 'var(--color-text)' }}>Generate a Plan:</strong> On the Today or This Week tabs, tap <em>Generate</em> and the AI creates meals using only your pantry items, respecting your prep time limits.</li>
                            <li><strong style={{ color: 'var(--color-text)' }}>Log a Meal:</strong> Tap <em>Log</em> on any meal card to add it directly to your daily food diary.</li>
                        </ol>
                    </div>
                </Section>

                <Section
                    id="workouts"
                    title="Workouts & Coach"
                    icon={<Dumbbell className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />}
                    isOpen={openSection === 'workouts'}
                    onClick={() => toggle('workouts')}
                >
                    <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        <p>
                            <strong style={{ color: 'var(--color-text)' }}>Smart Coach</strong> (Coach tab) is a full coaching session — ask for workout plans, advice, or analysis across your last 30 days of data.
                        </p>
                        <p>
                            <strong style={{ color: 'var(--color-text)' }}>Quick Workout Builder</strong> (Log tab → Workout icon) creates a single session on the spot, then saves it to your schedule.
                        </p>
                        <p>
                            <strong style={{ color: 'var(--color-text)' }}>Active Tracking:</strong> Go to <strong style={{ color: 'var(--color-text)' }}>Workout</strong> in the bottom nav → tap Start on a template → log your sets/reps in real-time → tap Finish to save.
                        </p>
                        <p>
                            <strong style={{ color: 'var(--color-text)' }}>Voice Spotter:</strong> During an active workout, tap the mic button and call out your sets hands-free: <em>"10 reps at 60 kg"</em>.
                        </p>
                    </div>
                </Section>

                <Section
                    id="settings"
                    title="Settings & Equipment"
                    icon={<Settings className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />}
                    isOpen={openSection === 'settings'}
                    onClick={() => toggle('settings')}
                >
                    <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        <p>
                            <strong style={{ color: 'var(--color-text)' }}>Available Equipment:</strong> In Settings, list what you have at home. The AI Coach will only suggest exercises you can perform.
                        </p>
                        <p>
                            <strong style={{ color: 'var(--color-text)' }}>Notifications:</strong> Enable daily reminders — add as many as you like, at any time of day.
                        </p>
                        <p>
                            <strong style={{ color: 'var(--color-text)' }}>Integrations:</strong> Connect Strava to automatically import runs and cycling sessions.
                        </p>
                        <p>
                            <strong style={{ color: 'var(--color-text)' }}>Cycle Tracking:</strong> Optionally track menstrual flow in daily logs. Off by default — enable in Settings.
                        </p>
                    </div>
                </Section>

            </div>
        </main>
    );
}

function Section({ id, title, icon, isOpen, onClick, children }: any) {
    return (
        <div
            className="rounded-2xl border overflow-hidden shadow-sm"
            style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
        >
            <button
                onClick={onClick}
                className="w-full p-4 flex items-center justify-between transition-colors"
                style={{ background: 'transparent' }}
            >
                <div className="flex items-center gap-3">
                    {icon}
                    <span className="font-bold" style={{ color: 'var(--color-text)' }}>{title}</span>
                </div>
                {isOpen
                    ? <ChevronDown className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                    : <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                }
            </button>
            {isOpen && (
                <div
                    className="px-4 pb-4 pt-0 animate-in fade-in slide-in-from-top-2 duration-200"
                    style={{ borderTop: '1px solid var(--color-border-light)' }}
                >
                    <div className="mt-4">{children}</div>
                </div>
            )}
        </div>
    );
}

function FeatureCard({ color, icon, title, children }: { color: 'success' | 'primary' | 'gold'; icon: React.ReactNode; title: string; children: React.ReactNode }) {
    const colors = {
        success: { bg: 'rgba(34,197,94,0.07)', border: 'rgba(34,197,94,0.15)', icon: 'var(--color-success)', title: 'var(--color-success)' },
        primary: { bg: 'rgba(77,137,226,0.07)', border: 'rgba(77,137,226,0.15)', icon: 'var(--color-primary)', title: 'var(--color-primary)' },
        gold: { bg: 'var(--color-gold-muted)', border: 'var(--color-gold-border)', icon: 'var(--color-gold)', title: 'var(--color-gold)' },
    }[color];

    return (
        <div className="p-4 rounded-xl border" style={{ background: colors.bg, borderColor: colors.border }}>
            <h4 className="font-bold flex items-center gap-2 mb-1.5 text-sm" style={{ color: colors.title }}>
                <span style={{ color: colors.icon }}>{icon}</span>
                {title}
            </h4>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{children}</p>
        </div>
    );
}
