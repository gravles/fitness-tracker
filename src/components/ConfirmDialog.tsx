'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';

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
            <Modal
                isOpen={state !== null}
                onClose={() => handle(false)}
                aria-label={state?.title ?? 'Confirm'}
                size="sm"
                sheet={false}
                zTier="top"
            >
                {state && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div
                                className="p-2 rounded-xl flex-shrink-0"
                                style={{
                                    background: state.danger ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' : 'var(--color-gold-muted)',
                                    color: state.danger ? 'var(--color-danger)' : 'var(--color-gold-text)',
                                }}
                            >
                                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
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
                                className="flex-1 py-3 rounded-xl font-bold text-sm transition-all focus-ring"
                                style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handle(true)}
                                className="flex-1 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 focus-ring"
                                style={{
                                    background: state.danger ? 'var(--color-danger)' : 'var(--color-navy)',
                                    color: state.danger ? 'white' : 'var(--color-gold)',
                                }}
                            >
                                {state.confirmLabel ?? (state.danger ? 'Delete' : 'Confirm')}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
