'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Send, Bot, User, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getMonthlyLogs, getSettings, getWorkoutsRange, getCoachMessages, saveCoachMessage, clearCoachMessages } from '@/lib/api';
import { getTemplates, createTemplate } from '@/lib/workout-api';
import { subDays, format } from 'date-fns';
import { useLanguage } from '@/components/LanguageProvider';
import { supabase } from '@/lib/supabase';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    suggested_workout?: {
        title: string;
        exercises: { name: string; sets: number; reps: string; }[];
    };
}

export default function CoachPage() {
    const { lang } = useLanguage();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [context, setContext] = useState<any>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const [historyLoading, setHistoryLoading] = useState(true);

    useEffect(() => {
        async function loadHistory() {
            try {
                const saved = await getCoachMessages();
                if (saved.length > 0) {
                    setMessages(saved.map(m => ({
                        role: m.role,
                        content: m.content,
                        suggested_workout: m.suggested_workout ?? undefined,
                    })));
                } else {
                    setMessages([{ role: 'assistant', content: "Hi! I'm your Smart Coach. I've analyzed your last 30 days of activity. How can I help you today? (Try asking me to build a workout!)" }]);
                }
            } catch (e) {
                // Fallback to localStorage if Supabase fails
                const saved = localStorage.getItem('coach_history');
                if (saved) {
                    try { setMessages(JSON.parse(saved)); } catch { setMessages([{ role: 'assistant', content: "Hi! I'm your Smart Coach." }]); }
                } else {
                    setMessages([{ role: 'assistant', content: "Hi! I'm your Smart Coach. I've analyzed your last 30 days of activity. How can I help you today? (Try asking me to build a workout!)" }]);
                }
            } finally {
                setHistoryLoading(false);
            }
        }
        loadHistory();
    }, []);

    // Prefetch Context
    useEffect(() => {
        async function loadContext() {
            try {
                const end = new Date();
                const start = subDays(end, 30);
                const [logs, workouts, settings, templates] = await Promise.all([
                    getMonthlyLogs(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')),
                    getWorkoutsRange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')),
                    getSettings(),
                    getTemplates()
                ]);
                setContext({ recentLogs: logs, recentWorkouts: workouts, userSettings: settings, templates });
            } catch (e) {
                console.error("Failed to load context", e);
                toast.error("Couldn't load your recent activity — coach replies may be less personalised.");
            }
        }
        loadContext();
    }, []);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function handleSend() {
        if (!input.trim() || loading) return;

        const newMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, newMsg]);
        setInput('');
        setLoading(true);
        // Persist user message
        saveCoachMessage({ role: 'user', content: input }).catch(() => {});

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/ai/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                body: JSON.stringify({ messages: [...messages, newMsg], context, lang })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setMessages(prev => [...prev, data]);
            // Persist assistant reply
            saveCoachMessage({ role: 'assistant', content: data.content, suggested_workout: data.suggested_workout ?? null }).catch(() => {});

        } catch (error) {
            console.error(error);
            const errMsg = { role: 'assistant' as const, content: `Sorry, there was an error: ${(error as any).message || 'Connection failed'}` };
            setMessages(prev => [...prev, errMsg]);
            saveCoachMessage(errMsg).catch(() => {});
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="h-screen flex flex-col bg-[var(--color-bg)] pb-20">

            {/* Header */}
            <div className="bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)] p-4 pt-12 sticky top-0 z-10 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl" style={{ background: 'var(--color-navy)' }}>
                        <Bot className="w-6 h-6" style={{ color: 'var(--color-gold)' }} />
                    </div>
                    <div>
                        <h1 className="font-bold text-xl text-[var(--color-text)]">Smart Coach</h1>
                        <p className="text-xs text-[var(--color-success)] flex items-center gap-1">
                            <span className="w-2 h-2 bg-[var(--color-success)] rounded-full animate-pulse" />
                            Online • Analyzing your data
                        </p>
                    </div>
                </div>
                {messages.length > 1 && !showClearConfirm && (
                    <button
                        onClick={() => setShowClearConfirm(true)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <Trash2 className="w-4 h-4 inline mr-1" />Clear
                    </button>
                )}
                {showClearConfirm && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Clear history?</span>
                        <button
                            onClick={async () => {
                                const greeting = { role: 'assistant' as const, content: "Hi! I'm your Smart Coach. I've analyzed your last 30 days of activity. How can I help you today? (Try asking me to build a workout!)" };
                                setMessages([greeting]);
                                setShowClearConfirm(false);
                                try {
                                    await clearCoachMessages();
                                    await saveCoachMessage(greeting);
                                } catch (e) {
                                    localStorage.removeItem('coach_history');
                                }
                            }}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500/10 text-[var(--color-danger)]"
                        >Yes</button>
                        <button
                            onClick={() => setShowClearConfirm(false)}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg"
                            style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                        >No</button>
                    </div>
                )}
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {historyLoading && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            m.role === 'user'
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        }`}>
                            {m.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        </div>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                            m.role === 'user'
                                ? 'bg-[var(--color-primary)] text-white rounded-tr-none'
                                : 'bg-[var(--color-surface-elevated)] text-[var(--color-text)] border border-[var(--color-border-light)] shadow-sm rounded-tl-none'
                        }`}>
                            {m.content}
                            {m.suggested_workout && (
                                <div className="mt-3 pt-3 border-t border-[var(--color-border-light)]">
                                    <div className="bg-[var(--color-bg-subtle)] rounded-lg p-3 mb-2">
                                        <h4 className="font-bold text-[var(--color-text)] mb-1">{m.suggested_workout.title}</h4>
                                        <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
                                            {m.suggested_workout.exercises.map((e, idx) => (
                                                <li key={idx}>• {e.name} ({e.sets}x{e.reps})</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!m.suggested_workout) return;
                                            try {
                                                await createTemplate(m.suggested_workout.title, m.suggested_workout.exercises.map(e => ({
                                                    exercise_name: e.name,
                                                    target_sets: e.sets,
                                                    target_reps: e.reps,
                                                    order_index: 0
                                                })));
                                                toast.success('Saved! Opening in Schedule...');
                                                window.location.href = '/schedule?tab=templates';
                                            } catch (e: any) {
                                                console.error(e);
                                                toast.error(`Failed to save template: ${e.message}`);
                                            }
                                        }}
                                        className="w-full py-2 bg-[var(--color-primary)] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
                                    >
                                        Save to Templates
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-[var(--color-surface-elevated)] p-4 rounded-2xl rounded-tl-none border border-[var(--color-border-light)] shadow-sm flex gap-1.5 items-center">
                            <span className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce opacity-60" />
                            <span className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce opacity-60 delay-75" />
                            <span className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce opacity-60 delay-150" />
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[var(--color-surface-elevated)] border-t border-[var(--color-border)]">
                <div className="flex gap-2 max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Ask for a workout, advice, or analysis..."
                        className="flex-1 bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all placeholder:text-[var(--color-text-muted)]"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        className="bg-[var(--color-primary)] text-white p-3 rounded-xl hover:opacity-90 disabled:opacity-40 shadow-lg shadow-[var(--color-primary)]/20 transition-all active:scale-95"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </main>
    );
}
