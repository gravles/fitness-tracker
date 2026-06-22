'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Paintbrush, Languages, Bot, Dumbbell } from 'lucide-react';

const APP_VERSION = '3.0';
const STORAGE_KEY = 'lifelogger_seen_version';

interface Slide {
    icon: React.ReactNode;
    title: string;
    body: string;
    accent: string;
}

const SLIDES: Slide[] = [
    {
        icon: <Paintbrush className="w-6 h-6" />,
        title: 'Fresh New Look',
        body: 'The app has a completely redesigned interface — new navy & gold palette, animated dashboard with progress rings, and a cleaner bottom nav.',
        accent: 'var(--color-gold)',
    },
    {
        icon: <Languages className="w-6 h-6" />,
        title: 'English & French',
        body: 'Switch the full app UI to French in Settings → Customisation. Your language preference is also applied to all AI coaching responses.',
        accent: 'var(--color-primary)',
    },
    {
        icon: <Bot className="w-6 h-6" />,
        title: 'Claude MCP Connector',
        body: 'Connect Claude.ai directly to your fitness data. Generate an API key in Settings → Claude AI Connector to read logs, workouts, and metrics — or log right from Claude.',
        accent: 'var(--chart-2)',
    },
    {
        icon: <Dumbbell className="w-6 h-6" />,
        title: 'Workout Autosave & Edit',
        body: 'Every set is saved the moment you log it — crashes and navigating away no longer lose your session. You can also re-open any past workout to edit its sets.',
        accent: 'var(--color-gold)',
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
