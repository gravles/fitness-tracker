'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceInputProps {
    onIntentDetected: (intent: any) => void;
    autoStart?: boolean;
    customTrigger?: (onClick: () => void, isListening: boolean, isProcessing: boolean) => React.ReactNode;
    onStateChange?: (listening: boolean, processing: boolean) => void;
}

export function VoiceInput({ onIntentDetected, autoStart = false, customTrigger, onStateChange }: VoiceInputProps) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [recognition, setRecognition] = useState<any>(null);
    const hasAutoStarted = useRef(false);

    useEffect(() => {
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

            recognition.onend = () => {
                setIsListening(false);
                // onStateChange will be set to processing next, so don't call here
            };

            setRecognition(recognition);
        }
    }, []);

    useEffect(() => {
        if (autoStart && recognition && !isListening && !isProcessing && !hasAutoStarted.current) {
            try {
                recognition.start();
                setIsListening(true);
                setTranscript('');
                hasAutoStarted.current = true;
            } catch (e) {
                console.warn("Auto-start failed", e);
            }
        }
    }, [autoStart, recognition, isListening, isProcessing]);

    const toggleListening = () => {
        if (!recognition) {
            toast.error("Voice input not supported in this browser.");
            return;
        }

        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
            setIsListening(true);
            onStateChange?.(true, false);
            setTranscript('');
        }
    };

    const handleProcess = async (text: string) => {
        setIsProcessing(true);
        onStateChange?.(false, true);
        try {
            const res = await fetch('/api/ai/process-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    if (!recognition) return null;

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
