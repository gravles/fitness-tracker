'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Palette, Watch, Gauge, Users, Pill, HeartPulse } from 'lucide-react';
import { Modal } from './ui/Modal';

const APP_VERSION = '2.7';
const STORAGE_KEY = 'lifelogger_seen_version';

interface Slide {
    icon: React.ReactNode;
    title: string;
    body: string;
    accent: string;
}

const SLIDES: Slide[] = [
    {
        icon: <Palette className="w-6 h-6" />,
        title: 'Say Hello to Kinetic',
        body: 'Life Logger has been reborn as Kinetic — a full rebrand, a redesigned Home, and a new Eat screen for all your food logging.',
        accent: 'var(--color-gold)',
    },
    {
        icon: <Watch className="w-6 h-6" />,
        title: 'Now on Your Wrist',
        body: 'A native WearOS companion app: live workout sessions, voice food logging, and a Today tile — pair it from Settings → Pair a Device.',
        accent: 'var(--color-primary)',
    },
    {
        icon: <Gauge className="w-6 h-6" />,
        title: 'Daily Readiness Score',
        body: 'A 0–100 readiness score from your sleep, energy, alcohol, and training load — no wearable required. Check in each morning to keep it accurate.',
        accent: 'var(--chart-2)',
    },
    {
        icon: <Users className="w-6 h-6" />,
        title: 'Workout Partners & Challenges',
        body: 'Team up with a friend for shared stats, encouragement pushes, and group challenges with an anonymous leaderboard.',
        accent: 'var(--color-primary)',
    },
    {
        icon: <Pill className="w-6 h-6" />,
        title: 'Supplement & Medication Tracking',
        body: 'Schedule doses, get reminders, and track adherence from the new Supplements page.',
        accent: 'var(--color-gold)',
    },
    {
        icon: <HeartPulse className="w-6 h-6" />,
        title: 'Health Connect on Android',
        body: 'Steps, resting heart rate, and sleep now sync automatically from a paired Galaxy Watch via Health Connect.',
        accent: 'var(--color-primary)',
    },
];

interface WhatsNewModalProps {
    onClose: () => void;
}

export function WhatsNewModal({ onClose }: WhatsNewModalProps) {
    const [slide, setSlide] = useState(0);
    const isLast = slide === SLIDES.length - 1;
    const current = SLIDES[slide];

    function dismiss() {
        localStorage.setItem(STORAGE_KEY, APP_VERSION);
        onClose();
    }

    function next() {
        if (isLast) {
            dismiss();
        } else {
            setSlide(s => s + 1);
        }
    }

    return (
        <Modal
            isOpen
            onClose={dismiss}
            aria-label="What's new in Kinetic"
            size="sm"
            padding={false}
            className="overflow-hidden"
        >
            <div style={{ background: 'var(--color-navy)', margin: '-1px' }} className="rounded-[inherit]">
                {/* Progress dots */}
                <div className="flex gap-1.5 justify-center pt-5 pb-1">
                    {SLIDES.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setSlide(i)}
                            aria-label={`Go to slide ${i + 1}`}
                            className="rounded-full transition-all duration-300"
                            style={{
                                width: i === slide ? '20px' : '6px',
                                height: '6px',
                                background: i === slide ? current.accent : 'rgba(255,255,255,0.2)',
                            }}
                        />
                    ))}
                </div>

                <div className="p-8 pt-6 text-center">
                    {/* Icon hero */}
                    <div
                        className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center [&>svg]:w-8 [&>svg]:h-8"
                        style={{ background: `color-mix(in srgb, ${current.accent} 14%, transparent)`, color: current.accent }}
                        aria-hidden="true"
                    >
                        {current.icon}
                    </div>

                    {/* Icon badge */}
                    <div
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-4"
                        style={{ background: `color-mix(in srgb, ${current.accent} 14%, transparent)`, color: current.accent }}
                    >
                        {current.icon}
                        <span>New in v{APP_VERSION}</span>
                    </div>

                    <h2
                        className="text-2xl font-bold text-white mb-3"
                        style={{ fontFamily: 'var(--font-display)' }}
                    >
                        {current.title}
                    </h2>

                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {current.body}
                    </p>
                </div>

                <div className="px-8 pb-8 space-y-3">
                    <button
                        onClick={next}
                        className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                        style={{ background: current.accent, color: 'var(--color-navy)' }}
                    >
                        {isLast ? (
                            <span>Get Started</span>
                        ) : (
                            <><span>Next</span><ChevronRight className="w-5 h-5" /></>
                        )}
                    </button>

                    {!isLast && (
                        <button
                            onClick={dismiss}
                            className="w-full text-sm font-medium py-1"
                            style={{ color: 'rgba(255,255,255,0.35)' }}
                        >
                            Skip
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
}

export function useWhatsNew(): [boolean, () => void] {
    const [show, setShow] = useState(false);

    useEffect(() => {
        try {
            const seen = localStorage.getItem(STORAGE_KEY);
            if (!seen || parseFloat(seen) < parseFloat(APP_VERSION)) {
                setShow(true);
            }
        } catch {
            // localStorage unavailable — skip
        }
    }, []);

    function dismiss() {
        try { localStorage.setItem(STORAGE_KEY, APP_VERSION); } catch { /* noop */ }
        setShow(false);
    }

    return [show, dismiss];
}
