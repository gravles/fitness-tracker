'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, X, Dumbbell, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { WorkoutChatState } from '@/lib/ai';
import { useLanguage } from '@/components/LanguageProvider';
import { Modal } from './ui/Modal';
import { supabase } from '@/lib/supabase';

interface WorkoutChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (workout: any) => void;
    initialData?: string;
}

export function WorkoutChatModal({ isOpen, onClose, onSave, initialData }: WorkoutChatModalProps) {
    const { lang } = useLanguage();
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [chatState, setChatState] = useState<WorkoutChatState>({
        history: [],
        missing_fields: [],
        status: 'continue',
        reply: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            // @ts-ignore
            const recognition = new window.webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                setInput(text);
                handleSend(text);
            };
            recognition.onend = () => setIsListening(false);
            recognitionRef.current = recognition;
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            if (initialData) {
                handleSend(initialData);
            } else {
                setMessages([{ role: 'assistant', content: "Hi! I'm your AI Coach. Tell me what workout you did today!" }]);
            }
        }
    }, [isOpen, initialData]);

    const toggleListening = () => {
        if (!recognitionRef.current) { toast.error("Voice input not supported in this browser."); return; }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleSend = async (text: string) => {
        if (!text.trim()) return;
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/ai/workout-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                body: JSON.stringify({ state: chatState, message: text, lang })
            });
            const newState: WorkoutChatState = await res.json();
            setChatState(newState);
            setMessages(prev => [...prev, { role: 'assistant', content: newState.reply }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I had trouble connecting. Try again?" }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!chatState.workoutData) return;
        setIsSaving(true);
        try {
            // Strip fields that don't exist on the Workout DB table (e.g. muscles)
            const { muscles, ...cleanWorkout } = chatState.workoutData as any;
            await onSave(cleanWorkout);
        } finally { setIsSaving(false); }
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

    if (!mounted || !isOpen) return null;

    const content = (
        <Modal isOpen onClose={onClose} aria-label="Quick Workout Builder" size="md" sheet={false} padding={false} className="flex flex-col max-h-[80dvh] overflow-hidden">

                {/* Header */}
                <div className="p-4 flex justify-between items-center text-white" style={{ background: 'var(--color-navy)' }}>
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-full" style={{ background: 'var(--color-gold-border)' }}>
                            <Sparkles className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
                        </div>
                        <div>
                            <h3 className="font-bold leading-tight">Quick Workout Builder</h3>
                            <p className="text-xs opacity-60">Build a workout now · Full coaching in the Coach tab</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--color-bg)]">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className="max-w-[80%] p-3 rounded-2xl text-sm"
                                style={m.role === 'user' ? {
                                    background: 'var(--color-primary)',
                                    color: 'white',
                                    borderRadius: '16px 16px 4px 16px'
                                } : {
                                    background: 'var(--color-surface-elevated)',
                                    color: 'var(--color-text)',
                                    border: '1px solid var(--color-border-light)',
                                    borderRadius: '16px 16px 16px 4px'
                                }}
                            >
                                {m.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-[var(--color-surface-elevated)] p-3 rounded-2xl border border-[var(--color-border-light)] flex gap-1">
                                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--color-text-muted)' }} />
                                <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.1s]" style={{ background: 'var(--color-text-muted)' }} />
                                <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.2s]" style={{ background: 'var(--color-text-muted)' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Completion State */}
                {chatState.status === 'completed' && chatState.workoutData && (
                    <div className="p-4 border-t border-[var(--color-border-light)] animate-in slide-in-from-bottom" style={{ background: 'rgba(34,197,94,0.05)' }}>
                        <div className="flex gap-4 items-center mb-4">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' }}>
                                <Dumbbell className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-[var(--color-text)]">{chatState.workoutData.activity_type}</h4>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    {chatState.workoutData.duration || '--'} min • {chatState.workoutData.intensity || 'Moderate'} • ~{chatState.workoutData.calories || '--'} kcal
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                            className="w-full py-3 text-white rounded-xl font-bold active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                            style={{ background: 'var(--color-primary)' }}
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm & Log Workout"}
                        </button>
                    </div>
                )}

                {/* Input Area */}
                {chatState.status !== 'completed' && (
                    <div className="p-4 bg-[var(--color-surface-elevated)] border-t border-[var(--color-border-light)]">
                        <div className="flex gap-2">
                            <button
                                onClick={toggleListening}
                                className="p-3 rounded-full transition-all"
                                style={isListening ? { background: 'var(--color-danger)', color: 'white' } : { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                            >
                                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend(input)}
                                placeholder="Type or speak..."
                                className="flex-1 bg-[var(--color-bg-subtle)] rounded-xl px-4 outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
                                style={{ border: '1px solid var(--color-border)' }}
                                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
                            />
                            <button
                                onClick={() => handleSend(input)}
                                disabled={!input.trim() || isLoading}
                                className="p-3 text-white rounded-xl disabled:opacity-50 active:scale-95 transition-all"
                                style={{ background: 'var(--color-primary)' }}
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
        </Modal>
    );

    return createPortal(content, document.body);
}
