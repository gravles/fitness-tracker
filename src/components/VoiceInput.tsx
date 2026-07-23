'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as NativeSpeech } from '@capacitor-community/speech-recognition';
import { authHeaders } from '@/lib/supabase';

interface VoiceInputProps {
    onIntentDetected: (intent: any) => void;
    autoStart?: boolean;
    customTrigger?: (onClick: () => void, isListening: boolean, isProcessing: boolean) => React.ReactNode;
    onStateChange?: (listening: boolean, processing: boolean) => void;
}

type Engine = 'native' | 'web' | 'none';

/**
 * Voice capture → /api/ai/process-intent.
 *
 * Engine selection:
 * - Capacitor native app → @capacitor-community/speech-recognition (the
 *   Android WebView exposes webkitSpeechRecognition but its speech service
 *   doesn't work, which is why voice silently failed on the phone).
 * - Browser with a working Web Speech API → webkitSpeechRecognition.
 * - Neither → the trigger stays visible and explains itself on tap.
 */
export function VoiceInput({ onIntentDetected, autoStart = false, customTrigger, onStateChange }: VoiceInputProps) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [webRecognition, setWebRecognition] = useState<any>(null);
    const engineRef = useRef<Engine>('none');
    const hasAutoStarted = useRef(false);

    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            engineRef.current = 'native';
            return;
        }
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            // @ts-ignore
            const recognition = new window.webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                setTranscript(text);
                handleProcess(text);
            };

            recognition.onerror = (event: any) => {
                setIsListening(false);
                onStateChange?.(false, false);
                // 'no-speech' just means silence — not worth an error toast
                if (event.error && event.error !== 'no-speech' && event.error !== 'aborted') {
                    toast.error(`Voice input failed (${event.error}). Check microphone permission.`);
                }
            };

            recognition.onend = () => {
                setIsListening(false);
                // onStateChange will be set to processing next, so don't call here
            };

            engineRef.current = 'web';
            setWebRecognition(recognition);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function startNative() {
        try {
            const { available } = await NativeSpeech.available();
            if (!available) {
                toast.error('Speech recognition is not available on this device.');
                return;
            }
            const perm = await NativeSpeech.requestPermissions();
            if (perm.speechRecognition !== 'granted') {
                toast.error('Microphone permission is needed for voice logging.');
                return;
            }
            setIsListening(true);
            onStateChange?.(true, false);
            setTranscript('');
            const result = await NativeSpeech.start({
                language: 'en-US',
                partialResults: false,
                popup: false,
            });
            setIsListening(false);
            const text = result?.matches?.[0];
            if (text) {
                setTranscript(text);
                await handleProcess(text);
            } else {
                onStateChange?.(false, false);
                toast("Didn't catch that — try again.");
            }
        } catch (e: any) {
            setIsListening(false);
            onStateChange?.(false, false);
            console.error('Native speech error', e);
            const msg = String(e?.message ?? e);
            if (!/cancel/i.test(msg)) {
                toast.error('Voice input failed: ' + msg);
            }
        }
    }

    async function stopNative() {
        try {
            await NativeSpeech.stop();
        } catch { /* already stopped */ }
        setIsListening(false);
        onStateChange?.(false, false);
    }

    const toggleListening = () => {
        const engine = engineRef.current;

        if (engine === 'native') {
            if (isListening) stopNative();
            else startNative();
            return;
        }

        if (engine === 'web' && webRecognition) {
            if (isListening) {
                webRecognition.stop();
            } else {
                webRecognition.start();
                setIsListening(true);
                onStateChange?.(true, false);
                setTranscript('');
            }
            return;
        }

        toast.error('Voice input is not supported in this browser.');
    };

    // Deep-link auto start (/log?action=voice)
    useEffect(() => {
        if (!autoStart || hasAutoStarted.current || isListening || isProcessing) return;
        const engine = engineRef.current;
        if (engine === 'native') {
            hasAutoStarted.current = true;
            startNative();
        } else if (engine === 'web' && webRecognition) {
            hasAutoStarted.current = true;
            try {
                webRecognition.start();
                setIsListening(true);
                setTranscript('');
            } catch (e) {
                console.warn('Auto-start failed', e);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart, webRecognition, isListening, isProcessing]);

    const handleProcess = async (text: string) => {
        setIsProcessing(true);
        onStateChange?.(false, true);
        try {
            const res = await fetch('/api/ai/process-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                body: JSON.stringify({ transcript: text })
            });
            const data = await res.json();
            onIntentDetected(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
            onStateChange?.(false, false);
        }
    };

    if (customTrigger) {
        return <>{customTrigger(toggleListening, isListening, isProcessing)}</>;
    }

    return (
        <div className="flex flex-col items-center">
            <button
                onClick={toggleListening}
                disabled={isProcessing}
                className={`p-4 rounded-full transition-all shadow-lg ${isListening ? 'bg-red-500 animate-pulse text-white' : ''} ${isProcessing ? 'opacity-50' : ''}`}
                style={!isListening ? { background: 'var(--color-primary)', color: 'white' } : undefined}
            >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <p className="mt-2 text-xs text-[var(--color-text-muted)] font-medium">
                {isProcessing ? 'Thinking...' : isListening ? 'Listening...' : 'Tap to Speak'}
            </p>
            {transcript && <p className="text-xs text-[var(--color-text-muted)] mt-1 italic opacity-70">"{transcript}"</p>}
        </div>
    );
}
