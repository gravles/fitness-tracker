'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Languages, Plug, Dumbbell, Trash2 } from 'lucide-react';

const APP_VERSION = '2.1';
const STORAGE_KEY = 'lifelogger_seen_version';

interface Slide {
    emoji: string;
    icon: React.ReactNode;
    title: string;
    body: string;
    accent: string;
}

const SLIDES: Slide[] = [
    {
        emoji: '🌐',
        icon: <Languages className="w-6 h-6" />,
        title: 'English & French',
        body: 'Switch the entire app between English and French from Settings → Customisation. Your AI coach speaks your language too.',
        accent: 'var(--color-primary)',
    },
    {
        emoji: '🔌',
        icon: <Plug className="w-6 h-6" />,
        title: 'Claude AI Connector',
        body: 'Generate an API key in Settings and connect Life Logger directly to Claude.ai. Ask Claude to log a meal, review your week, or plan your next workout — using your real data.',
        accent: 'var(--color-gold)',
    },
    {
        emoji: '💾',
        icon: <Dumbbell className="w-6 h-6" />,
        title: 'Workout Autosave',
        body: 'Every set is saved the moment you log it — no more lost progress from navigating away. Reopen any past workout to edit sets, or tap × to remove one.',
        accent: '#22c55e',
    },
    {
        emoji: '🛠️',
        icon: <Trash2 className="w-6 h-6" />,
        title: 'Reliability Fixes',
        body: 'iOS push notifications fixed, food camera restored with a gallery picker option, and AI weekly analysis is now faster and more consistent.',
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
                    {/* Emoji hero */}
                    <div className="text-6xl mb-5" aria-hidden="true">{current.emoji}</div>

                    {/* Icon badge */}
                    <div
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-4"
                        style={{ background: `${current.accent}22`, color: current.accent }}
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
