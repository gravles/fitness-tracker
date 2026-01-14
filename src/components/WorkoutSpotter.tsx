'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, StopCircle, Zap } from 'lucide-react';

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

    // 1. Wake Lock Management
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
                console.log('Wake Lock active');
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

    // 2. Speech Recognition Setup
    useEffect(() => {
        if (!isActive) return;

        let recognition: any = null;

        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            // @ts-ignore
            recognition = new window.webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                setStatus('listening');
            };

            recognition.onresult = (event: any) => {
                const current = event.resultIndex;
                const text = event.results[current][0].transcript;
                setTranscript(text);
                processCommand(text);
            };

            recognition.onend = () => {
                // Check if we should still be active
                if (isActive) {
                    // Don't restart if we are speaking (we will manually restart after speech)
                    if (status === 'speaking') return;

                    retryTimeoutRef.current = setTimeout(() => {
                        // Check ref to ensure we haven't been unmounted/stopped in the meantime
                        if (recognitionRef.current && isActive) {
                            try {
                                recognitionRef.current.start();
                            } catch (e) {
                                console.warn("Restart failed", e);
                            }
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
                    alert("Microphone access denied. Please check permission settings.");
                }
            };

            recognitionRef.current = recognition;
            try {
                recognition.start();
            } catch (e) {
                console.error("Start error", e);
            }
        }

        return () => {
            if (recognition) recognition.stop();
            recognitionRef.current = null;
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
            setStatus('idle');
        };
    }, [isActive]); // CRITICAL: Only depend on isActive

    // 3. Removed redundant Control Logic effect since lifecycle is handled above

    // 4. Processing & Feedback
    async function processCommand(text: string) {
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
                onSetDetected(data.data);

                const msg = `Logged ${reps} reps at ${weight} ${weight_unit || 'pounds'}`;
                setLastAction(msg);
                speak(msg);
            } else {
                setStatus('idle'); // Will trigger restart via onend if recognition stops? 
                // Wait, if recognition is continuous, it won't stop. 
                // We just update status for UI.

                // If the user stopped talking but recognition is 'continuous', it might not fire 'onend' immediately.
                // But we want to go back to 'listening'.

                // If recognition is still running (it should be), we just set status back.
                setTimeout(() => setStatus('listening'), 500);
            }

        } catch (error) {
            console.error(error);
            setStatus('idle');
        }
    }

    function speak(text: string) {
        // Stop listening while speaking to avoid feedback loop
        if (recognitionRef.current) {
            // We set status FIRST so onend knows to ignore the stop
            setStatus('speaking');
            recognitionRef.current.stop();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.onend = () => {
            // Resume listening after speaking
            if (isActive && recognitionRef.current) {
                setStatus('listening');
                try {
                    recognitionRef.current.start();
                } catch (e) { console.warn("Restart after speak failed", e); }
            } else if (isActive) {
                // Should trigger re-init if ref is gone but active? No, ref is stable.
                setStatus('idle');
            }
        };
        window.speechSynthesis.speak(utterance);
    }

    if (!isActive) {
        return (
            <button
                onClick={() => setIsActive(true)}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
            >
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Start Spotter
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 w-full max-w-sm px-4 animate-in slide-in-from-bottom">
            <div className="bg-black/90 backdrop-blur text-white p-4 rounded-3xl shadow-2xl w-full flex items-center justify-between border border-white/10">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status === 'listening' ? 'bg-red-500 animate-pulse' : 'bg-gray-700'}`}>
                        {status === 'listening' ? <Mic className="w-5 h-5 text-white" /> :
                            status === 'processing' ? <Zap className="w-5 h-5 text-yellow-400" /> :
                                status === 'speaking' ? <Volume2 className="w-5 h-5 text-blue-400" /> :
                                    <MicOff className="w-5 h-5 text-gray-400" />}
                    </div>
                    <div>
                        <p className="font-bold text-sm">
                            {status === 'listening' ? 'Listening...' :
                                status === 'processing' ? 'Thinking...' :
                                    status === 'speaking' ? 'Speaking...' : ' paused'}
                        </p>
                        <p className="text-xs text-gray-400 line-clamp-1 h-4">
                            {transcript || "Say '12 reps 150 lbs'"}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => {
                        setIsActive(false);
                        window.speechSynthesis.cancel();
                    }}
                    className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 text-red-400"
                >
                    <StopCircle className="w-6 h-6" />
                </button>
            </div>

            {lastAction && (
                <div className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full shadow-sm animate-in fade-in">
                    ✓ {lastAction}
                </div>
            )}
        </div>
    );
}
