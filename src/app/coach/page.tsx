'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Send, Bot, User, Sparkles } from 'lucide-react';
import { getMonthlyLogs, getSettings } from '@/lib/api';
import { getTemplates } from '@/lib/workout-api';
import { subDays, format } from 'date-fns';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function CoachPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [context, setContext] = useState<any>(null);

    useEffect(() => {
        // Initial Greeting
        setMessages([
            { role: 'assistant', content: "Hi! I'm your Smart Coach. I've analyzed your last 30 days of activity. How can I help you today? (Try asking me to build a workout!)" }
        ]);

        // Prefetch Context
        async function loadContext() {
            try {
                const end = new Date();
                const start = subDays(end, 30);
                const [logs, settings, templates] = await Promise.all([
                    getMonthlyLogs(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')),
                    getSettings(),
                    getTemplates()
                ]);
                setContext({ recentLogs: logs, userSettings: settings, templates });
            } catch (e) {
                console.error("Failed to load context", e);
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

        try {
            const res = await fetch('/api/ai/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, newMsg],
                    context: context // Pass fetched context
                })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setMessages(prev => [...prev, data]);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, there was an error: ${(error as any).message || 'Connection failed'}` }]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="h-screen flex flex-col bg-gray-50 pb-20"> {/* pb-20 for mobile nav if needed */}

            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4 pt-12 sticky top-0 z-10 flex items-center gap-3 shadow-sm">
                <div className="bg-gradient-to-tr from-blue-500 to-purple-500 p-2 rounded-xl text-white">
                    <Bot className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="font-bold text-xl text-gray-900">Smart Coach</h1>
                    <p className="text-xs text-green-600 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Online • Analyzing your data
                    </p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-blue-100 text-blue-600'
                            }`}>
                            {m.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        </div>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user'
                            ? 'bg-gray-900 text-white rounded-tr-none'
                            : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-none'
                            }`}>
                            {m.content}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex gap-1 items-center">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
                <div className="flex gap-2 max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Ask for a workout, advice, or analysis..."
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none shadow-lg shadow-blue-200 transition-all active:scale-95"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </main>
    );
}
