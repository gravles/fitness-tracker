'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './ui/Modal';

interface TextLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcessed: (intent: any) => void;
    onWorkoutRequest: (text: string) => void;
}

export function TextLogModal({ isOpen, onClose, onProcessed, onWorkoutRequest }: TextLogModalProps) {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleProcess() {
        if (!text.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/ai/process-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: text })
            });
            const intent = await res.json();

            if (intent.error) {
                toast.error("Error: " + intent.error);
                setLoading(false);
                return;
            }

            if (intent.intent === 'log_workout') {
                onWorkoutRequest(text);
                onClose();
            } else {
                onProcessed(intent);
                setText('');
                onClose();
            }

        } catch (e: any) {
            console.error(e);
            toast.error('Failed to process text: ' + e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quick Log" size="lg">
            <textarea
                className="w-full p-4 bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-light)] outline-none h-32 resize-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
                style={{ borderColor: 'var(--color-border-light)' }}
                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                onBlur={e => { e.target.style.borderColor = ''; }}
                placeholder="Type what you ate or did... (e.g. 'Chicken breast and rice' or '30 min run')"
                value={text}
                onChange={e => setText(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
                <button
                    onClick={onClose}
                    className="flex-1 py-3 text-[var(--color-text-muted)] font-bold hover:bg-[var(--color-bg-subtle)] rounded-xl transition-colors focus-ring"
                    disabled={loading}
                >
                    Cancel
                </button>
                <button
                    onClick={handleProcess}
                    className="flex-1 py-3 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all active:scale-95 focus-ring"
                    style={{ background: 'var(--color-primary)' }}
                    disabled={loading || !text.trim()}
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" aria-hidden="true" /> : 'Process'}
                </button>
            </div>
        </Modal>
    );
}
