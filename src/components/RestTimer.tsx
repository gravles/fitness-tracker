'use client';

import { useState, useEffect, useRef } from 'react';
import { Timer, Bell, X, Play, RotateCcw } from 'lucide-react';

export function RestTimer() {
    const [timeLeft, setTimeLeft] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [showControls, setShowControls] = useState(false);

    // Default rest times
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
        // PWA Notification
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                // Determine if we should vibrate (mobile only)
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

                new Notification('Rest Completed! ⚡️', {
                    body: 'Time to crush your next set!',
                    icon: '/icon-192x192.png', // Assuming pwa icon exists, browsers handle this fallback often
                    tag: 'rest-timer'
                });
            } catch (e) {
                console.error("Notification failed", e);
            }
        }

        // Audio Fallback (simple beep) - OPTIONAL: could add real sound file later
    };

    const startTimer = async (seconds: number) => {
        await requestPermission(); // Ask on first interaction
        setTimeLeft(seconds);
        setIsRunning(true);
        setShowControls(false); // Minify to show countdown
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (timeLeft > 0) {
        // Active Countdown UI
        return (
            <div className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-full font-mono text-sm shadow-lg font-bold animate-in fade-in slide-in-from-top-2">
                <Timer className="w-4 h-4 animate-pulse" />
                {formatTime(timeLeft)}
                <button
                    onClick={() => {
                        setIsRunning(false);
                        setTimeLeft(0);
                    }}
                    className="ml-2 hover:bg-blue-700 rounded-full p-1"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        );
    }

    if (!showControls) {
        // Idle Button
        return (
            <button
                onClick={() => setShowControls(true)}
                className="bg-gray-100 text-gray-500 p-2 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                title="Start Rest Timer"
            >
                <Timer className="w-5 h-5" />
            </button>
        );
    }

    // Expanded Controls
    return (
        <div className="absolute top-14 right-4 z-50 bg-white shadow-xl border border-gray-100 rounded-2xl p-4 w-48 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Rest Timer</h4>
                <button onClick={() => setShowControls(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {PRESETS.map(s => (
                    <button
                        key={s}
                        onClick={() => startTimer(s)}
                        className="p-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-transparent rounded-lg text-sm font-bold transition-all"
                    >
                        {s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`}
                    </button>
                ))}
            </div>
        </div>
    );
}
