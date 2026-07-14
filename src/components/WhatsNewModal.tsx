'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Users, Heart, Gift, Trophy, Image as ImageIcon } from 'lucide-react';

const APP_VERSION = '2.2';
const STORAGE_KEY = 'lifelogger_seen_version';

interface Slide {
    icon: React.ReactNode;
    title: string;
    body: string;
    accent: string;
}

const SLIDES: Slide[] = [
    {
        icon: <Users className="w-6 h-6" />,
        title: 'Workout Partners',
        body: 'Invite a friend and keep each other accountable — see each other\'s weekly stats and streaks, with privacy you each control. Find it in Settings → Workout Partners.',
        accent: 'var(--color-primary)',
    },
    {
        icon: <Heart className="w-6 h-6" />,
        title: 'Cheer Each Other On',
        body: 'Send one-tap encouragement 💪 and get a heads-up when your partner\'s streak is at risk so you can rally them.',
        accent: 'var(--color-gold)',
    },
    {
        icon: <Gift className="w-6 h-6" />,
        title: 'Share Workouts & Meals',
        body: 'Send a workout template or a saved meal to your partner — they can add it to their own library with one tap.',
        accent: 'var(--chart-2)',
    },
    {
        icon: <Trophy className="w-6 h-6" />,
        title: 'Group Challenges',
        body: 'Challenge 2–8 friends: logging streaks, protein days, or workout counts, tracked on an anonymous leaderboard.',
        accent: 'var(--color-gold)',
    },
    {
        icon: <ImageIcon className="w-6 h-6" />,
        title: 'Progress Photos from Your Gallery',
        body: 'Add progress photos straight from your phone\'s photo library — no more camera-only. Big photos are compressed automatically.',
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
