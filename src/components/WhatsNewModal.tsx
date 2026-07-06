'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Palette, Bot, CalendarCheck, Globe, Save } from 'lucide-react';

const APP_VERSION = '2.1';
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
        title: 'A Whole New Look',
        body: 'Refreshed typography, colors, and an animated Today dashboard with progress rings and quick actions.',
        accent: 'var(--color-gold)',
    },
    {
        icon: <Bot className="w-6 h-6" />,
        title: 'Claude AI Connector',
        body: 'Connect your own Claude account under Settings → Claude AI Connector to read and log your data from any conversation.',
        accent: 'var(--color-primary)',
    },
    {
        icon: <CalendarCheck className="w-6 h-6" />,
        title: 'Your Coach Can Plan Ahead',
        body: 'A connected AI coach can now schedule workouts and plan meals for you — they show up right on your calendar and Meal Planner.',
        accent: 'var(--chart-2)',
    },
    {
        icon: <Globe className="w-6 h-6" />,
        title: 'Now in French',
        body: 'Switch between English and French anytime in Settings → Customisation.',
        accent: 'var(--color-gold)',
    },
    {
        icon: <Save className="w-6 h-6" />,
        title: 'Smarter Workout Logging',
        body: 'Sets autosave as you go, and you can now edit or delete sets on any completed workout.',
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
        <div
            className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md"
            aria-modal="true"
            role="dialog"
            aria-label="What's new in Life Logger"
        >
            <div
                className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
                style={{ background: 'var(--color-navy)' }}
            >
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
        </div>
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
