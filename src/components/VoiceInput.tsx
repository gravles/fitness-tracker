'use client';

import { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceInputProps {
    onIntentDetected: (intent: any) => void;
}

export function VoiceInput({ onIntentDetected }: VoiceInputProps) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [recognition, setRecognition] = useState<any>(null);

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
            };

            setRecognition(recognition);
        }
    }, []);

    const toggleListening = () => {
        if (!recognition) {
            alert("Voice input not supported in this browser.");
            return;
        }

        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
            setIsListening(true);
            setTranscript('');
        }
    };

    const handleProcess = async (text: string) => {
        setIsProcessing(true);
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
        }
    };

    if (!recognition) return null;

    return (
        <div className="flex flex-col items-center">
            <button
                onClick={toggleListening}
                disabled={isProcessing}
                className={`p-4 rounded-full transition-all ${isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-blue-600 text-white'
                    } ${isProcessing ? 'opacity-50' : ''} shadow-lg`}
            >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <p className="mt-2 text-xs text-gray-500 font-medium">
                {isProcessing ? 'Thinking...' : isListening ? 'Listening...' : 'Tap to Speak'}
            </p>
            {transcript && <p className="text-xs text-gray-400 mt-1 italic">"{transcript}"</p>}
        </div>
    );
}
