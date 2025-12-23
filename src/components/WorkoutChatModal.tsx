'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, X, Dumbbell, Sparkles, Loader2 } from 'lucide-react';
import { WorkoutChatState } from '@/lib/ai';

interface WorkoutChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (workout: any) => void;
    initialData?: string; // Optional: Passing text handles it as an immediate user message
}

export function WorkoutChatModal({ isOpen, onClose, onSave, initialData }: WorkoutChatModalProps) {
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

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    // Initialize Speech Recognition
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
                handleSend(text); // Auto-send on voice end? Or let user confirm? Let's auto-send for fluidity.
            };

            recognition.onend = () => setIsListening(false);
            recognitionRef.current = recognition;
        }
    }, []);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initial Greeting or Handover
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            if (initialData) {
                // If we have initial data (e.g. from the other voice input), send it immediately as if user spoke it
                handleSend(initialData);
            } else {
                setMessages([{ role: 'assistant', content: "Hi! I'm your AI Coach. Tell me what workout you did today!" }]);
            }
        }
    }, [isOpen, initialData]);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Voice input not supported in this browser.");
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleSend = async (text: string) => {
        if (!text.trim()) return;

        // Add user message immediately
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/ai/workout-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    state: chatState,
                    message: text
                })
            });
            const newState: WorkoutChatState = await res.json();

            setChatState(newState);
            setMessages(prev => [...prev, { role: 'assistant', content: newState.reply }]);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I had trouble connecting. Try again?" }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-white/20 rounded-full">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg">AI Trainer Chat</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition"><X className="w-5 h-5" /></button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.role === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-white text-gray-800 border border-gray-200 shadow-sm rounded-bl-none'
                                }`}>
                                {m.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-gray-100 flex gap-1">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Completion State */}
                {chatState.status === 'completed' && chatState.workoutData && (
                    <div className="p-4 bg-green-50 border-t border-green-100 animate-in slide-in-from-bottom">
                        <div className="flex gap-4 items-center mb-4">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                <Dumbbell className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900">{chatState.workoutData.activity_type}</h4>
                                <p className="text-xs text-gray-500">
                                    {chatState.workoutData.duration} min • {chatState.workoutData.intensity} • ~{chatState.workoutData.calories} kcal
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => onSave(chatState.workoutData)}
                            className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-200 active:scale-95 transition-all"
                        >
                            Confirm & Log Workout
                        </button>
                    </div>
                )}

                {/* Input Area */}
                {chatState.status !== 'completed' && (
                    <div className="p-4 bg-white border-t border-gray-100">
                        <div className="flex gap-2">
                            <button
                                onClick={toggleListening}
                                className={`p-3 rounded-full transition-all ${isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend(input)}
                                placeholder="Type or speak..."
                                className="flex-1 bg-gray-50 rounded-xl px-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                            />
                            <button
                                onClick={() => handleSend(input)}
                                disabled={!input.trim() || isLoading}
                                className="p-3 bg-blue-600 text-white rounded-xl disabled:opacity-50 disabled:shadow-none shadow-lg shadow-blue-200 active:scale-95 transition-all"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
