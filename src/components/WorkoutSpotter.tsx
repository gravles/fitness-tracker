'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Volume2, StopCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface WorkoutSpotterProps {
    onSetDetected: (set: { exercise?: string, reps: number, weight: number, weight_unit: string }) => void;
}

export function WorkoutSpotter({ onSetDetected }: WorkoutSpotterProps) {
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
    const [transcript, setTranscript] = useState('');
    const [lastAction, setLastAction] = useState('');

    const recognitionRef = useRef<any>(null);
    const wakeLockRef = useRef<any>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isActiveRef = useRef(isActive);

    useEffect(() => {
        isActiveRef.current = isActive;
    }, [isActive]);

    useEffect(() => {
        if (isActive) {
            requestWakeLock();
        } else {
            releaseWakeLock();
        }
        return () => releaseWakeLock();
    }, [isActive]);

    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                // @ts-ignore
                wakeLockRef.current = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.error('Wake Lock failed', err);
        }
    }

    function releaseWakeLock() {
        if (wakeLockRef.current) {
            wakeLockRef.current.release();
            wakeLockRef.current = null;
        }
    }

    useEffect(() => {
        if (!isActive) return;

        let recognition: any = null;

        const SpeechRecognitionAPI =
            typeof window !== 'undefined'
                ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
                : null;

        if (SpeechRecognitionAPI) {
            recognition = new SpeechRecognitionAPI();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => { setStatus('listening'); };

            recognition.onresult = (event: any) => {
                const current = event.resultIndex;
                const text = event.results[current][0].transcript;
                setTranscript(text);
                processCommand(text);
            };

            recognition.onend = () => {
                if (isActiveRef.current) {
                    if (status === 'speaking') return;
                    retryTimeoutRef.current = setTimeout(() => {
                        if (recognitionRef.current && isActiveRef.current) {
                            try { recognitionRef.current.start(); } catch (e) { console.warn("Restart failed", e); }
                        }
                    }, 100);
                } else {
                    setStatus('idle');
                }
            };

            recognition.onerror = (e: any) => {
                console.warn("Speech error", e);
                if (e.error === 'not-allowed') {
                    setIsActive(false);
                    toast.error("Microphone access denied. Please check permission settings.");
                }
            };

            recognitionRef.current = recognition;
            try { recognition.start(); } catch (e) { console.error("Start error", e); }
        }

        return () => {
            if (recognition) recognition.stop();
            recognitionRef.current = null;
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
            setStatus('idle');
        };
    }, [isActive]);

    const lastProcessedRef = useRef<{ text: string, time: number }>({ text: '', time: 0 });

    async function processCommand(text: string) {
        if (text.toLowerCase().includes('stop') || text.toLowerCase().includes('cancel')) {
            setIsActive(false);
            window.speechSynthesis.cancel();
            setStatus('idle');
            return;
        }

        const now = Date.now();
        if (text === lastProcessedRef.current.text && (now - lastProcessedRef.current.time) < 2000) {
            return;
        }

        setStatus('processing');

        try {
            const res = await fetch('/api/ai/process-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: text })
            });
            const data = await res.json();

            if (data.intent === 'log_set' && data.data) {
                const { reps, weight, weight_unit } = data.data;
                lastProcessedRef.current = { text: text, time: now };
                onSetDetected(data.data);
                const msg = `Logged ${reps} reps at ${weight} ${weight_unit || 'pounds'}`;
                setLastAction(msg);
                speak(msg);
            } else {
                setStatus('idle');
                if (isActive) setTimeout(() => setStatus('listening'), 500);
            }

        } catch (error) {
            console.error(error);
            setStatus('idle');
        }
    }

    function speak(text: string) {
        if (recognitionRef.current) {
            setStatus('speaking');
            recognitionRef.current.stop();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.onend = () => {
            if (isActive && recognitionRef.current) {
                setStatus('listening');
                try { recognitionRef.current.start(); } catch (e) { console.warn("Restart after speak failed", e); }
            } else if (isActive) {
                setStatus('idle');
            }
        };
        window.speechSynthesis.speak(utterance);
    }

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const isSpeechSupported = typeof window !== 'undefined' &&
        ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

    if (!isActive) {
        if (!isSpeechSupported) {
            return (
                <div
                    className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--color-gold)', border: '1px solid rgba(234,179,8,0.3)' }}
                    title="Voice spotter requires Chrome or Safari"
                >
                    🎙️ Voice spotter not supported in this browser — use Chrome or Safari
                </div>
            );
        }
        return (
            <button
                onClick={() => setIsActive(true)}
                className="flex items-center gap-2 text-white px-4 py-2 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
                style={{ background: 'var(--color-navy)' }}
            >
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Start Spotter
            </button>
        );
    }

    if (!mounted) return null;

    return createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3 w-full max-w-sm px-4 animate-in slide-in-from-bottom">
            <div className="bg-black/90 backdrop-blur text-white p-4 rounded-3xl shadow-2xl w-full flex items-center justify-between border border-white/10">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status === 'listening' ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`}>
                        {status === 'listening' ? <Mic className="w-5 h-5 text-white" /> :
                            status === 'processing' ? <Zap className="w-5 h-5 text-yellow-400" /> :
                                status === 'speaking' ? <Volume2 className="w-5 h-5 text-blue-400" /> :
                                    <MicOff className="w-5 h-5 text-white/50" />}
                    </div>
                    <div>
                        <p className="font-bold text-sm">
                            {status === 'listening' ? 'Listening...' :
                                status === 'processing' ? 'Thinking...' :
                                    status === 'speaking' ? 'Speaking...' : 'Paused'}
                        </p>
                        <p className="text-xs text-white/60 line-clamp-1 h-4">
                            {transcript || "Say '12 reps 150 lbs'"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setIsActive(false); window.speechSynthesis.cancel(); }}
                        className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-red-400 border border-white/10"
                        title="Stop Spotter"
                    >
                        <StopCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {lastAction && (
                <div
                    className="text-xs font-bold px-3 py-1 rounded-full shadow-sm animate-in fade-in"
                    style={{ color: 'var(--color-success)', background: 'rgba(34,197,94,0.08)' }}
                >
                    ✓ {lastAction}
                </div>
            )}
        </div>,
        document.body
    );
}
