'use client';

import { useState, useEffect, useRef } from 'react';
import { Timer, X } from 'lucide-react';

interface RestTimerProps {
    /** 'bar' renders the running state as the Kinetic 6px gradient bar (in-card) */
    variant?: 'chip' | 'bar';
    /** Increment to auto-start a rest countdown (e.g. after logging a set) */
    startSignal?: number;
    defaultSeconds?: number;
}

export function RestTimer({ variant = 'chip', startSignal = 0, defaultSeconds = 90 }: RestTimerProps) {
    const [timeLeft, setTimeLeft] = useState(0);
    const [total, setTotal] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [showControls, setShowControls] = useState(false);

    const PRESETS = [30, 60, 90, 180];

    // Auto-start when the parent signals (logging a set)
    const lastSignal = useRef(startSignal);
    useEffect(() => {
        if (startSignal !== lastSignal.current) {
            lastSignal.current = startSignal;
            if (startSignal > 0) startTimer(defaultSeconds);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startSignal]);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        tryTriggerNotification();
                        setIsRunning(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (timeLeft === 0) {
            setIsRunning(false);
        }

        return () => clearInterval(interval);
    }, [isRunning, timeLeft]);

    const requestPermission = async () => {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    };

    const tryTriggerNotification = () => {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                new Notification('Rest completed', {
                    body: 'Time to crush your next set!',
                    icon: '/icon-192x192.png',
                    tag: 'rest-timer'
                });
            } catch (e) {
                console.error("Notification failed", e);
            }
        }
    };

    const startTimer = async (seconds: number) => {
        await requestPermission();
        setTimeLeft(seconds);
        setTotal(seconds);
        setIsRunning(true);
        setShowControls(false);
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (timeLeft > 0 && variant === 'bar') {
        const elapsedPct = total > 0 ? ((total - timeLeft) / total) * 100 : 0;
        return (
            <div className="flex items-center gap-2.5 w-full">
                <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'var(--color-bg-muted)' }}
                    role="progressbar"
                    aria-label="Rest timer"
                    aria-valuenow={Math.round(elapsedPct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <div
                        className="h-full rounded-full transition-all duration-1000 ease-linear"
                        style={{
                            width: `${elapsedPct}%`,
                            background: 'linear-gradient(90deg, var(--color-gold), var(--color-primary))',
                        }}
                    />
                </div>
                <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: 'var(--color-gold-text)' }}>
                    Rest {formatTime(timeLeft)}
                </span>
                <button
                    onClick={() => { setIsRunning(false); setTimeLeft(0); }}
                    aria-label="Cancel rest timer"
                    className="p-1 -m-1 rounded-full shrink-0"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
            </div>
        );
    }

    if (timeLeft > 0) {
        return (
            <div
                className="flex items-center gap-2 text-white px-3 py-1.5 rounded-full font-mono text-sm shadow-lg font-bold animate-in fade-in slide-in-from-top-2"
                style={{ background: 'var(--color-primary)' }}
            >
                <Timer className="w-4 h-4 animate-pulse" aria-hidden="true" />
                {formatTime(timeLeft)}
                <button
                    onClick={() => { setIsRunning(false); setTimeLeft(0); }}
                    aria-label="Cancel rest timer"
                    className="ml-1 -my-2 -mr-2 rounded-full p-3 hover:bg-white/20"
                >
                    <X className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>
        );
    }

    if (!showControls) {
        return (
            <button
                onClick={() => setShowControls(true)}
                className="bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] p-2 rounded-full hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-colors"
                title="Start Rest Timer"
            >
                <Timer className="w-5 h-5" />
            </button>
        );
    }

    return (
        <div className="absolute top-14 right-4 z-50 bg-[var(--color-surface-elevated)] shadow-xl border border-[var(--color-border-light)] rounded-2xl p-4 w-48 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-[var(--color-text)] text-xs uppercase tracking-wider">Rest Timer</h4>
                <button onClick={() => setShowControls(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {PRESETS.map(s => (
                    <button
                        key={s}
                        onClick={() => startTimer(s)}
                        className="p-2 bg-[var(--color-bg-subtle)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] border border-transparent hover:border-[var(--color-primary)]/30 rounded-lg text-sm font-bold text-[var(--color-text)] transition-all"
                    >
                        {s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`}
                    </button>
                ))}
            </div>
        </div>
    );
}
