'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
    resolve: (value: boolean) => void;
}

// Global singleton so any file can call confirm() without prop-drilling
let _show: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirm(opts: ConfirmOptions | string): Promise<boolean> {
    const options = typeof opts === 'string' ? { message: opts } : opts;
    if (!_show) {
        // Fallback to native if provider not mounted
        return Promise.resolve(window.confirm(options.message));
    }
    return _show(options);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ConfirmState | null>(null);

    const show = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setState({ ...opts, resolve });
        });
    }, []);

    // Register the global singleton
    _show = show;

    function handle(value: boolean) {
        state?.resolve(value);
        setState(null);
    }

    return (
        <>
            {children}
            {state && (
                <div
                    className="fixed inset-0 z-[300] flex items-center justify-center p-6"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
                    onClick={() => handle(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4"
                        style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-light)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className="p-2 rounded-xl flex-shrink-0"
                                style={{
                                    background: state.danger ? 'rgba(239,68,68,0.1)' : 'rgba(201,168,76,0.1)',
                                    color: state.danger ? '#ef4444' : 'var(--color-gold)',
                                }}
                            >
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                {state.title && (
                                    <h3 className="font-bold text-[var(--color-text)] mb-1">{state.title}</h3>
                                )}
                                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{state.message}</p>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => handle(false)}
                                className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                                style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handle(true)}
                                className="flex-1 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                                style={{
                                    background: state.danger ? '#ef4444' : 'var(--color-navy)',
                                    color: state.danger ? 'white' : 'var(--color-gold)',
                                }}
                            >
                                {state.confirmLabel ?? (state.danger ? 'Delete' : 'Confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
