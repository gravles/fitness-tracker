'use client';

import { useState, useEffect, useRef } from 'react';
import { Timer, X } from 'lucide-react';

export function RestTimer() {
    const [timeLeft, setTimeLeft] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [showControls, setShowControls] = useState(false);

    const PRESETS = [30, 60, 90, 180];

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
        setIsRunning(true);
        setShowControls(false);
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

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
