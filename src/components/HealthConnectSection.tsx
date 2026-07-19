'use client';

import { useState, useEffect } from 'react';
import { HeartPulse, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
    healthConnectStatus,
    connectHealthConnect,
    syncSleep,
    HealthConnectStatus,
} from '@/lib/health-connect';

/**
 * Settings card for Health Connect (renders only inside the Android app).
 * One grant and the watch's Samsung Health sleep tracking flows into
 * sleep_records automatically on every app open.
 */
export function HealthConnectSection() {
    const [status, setStatus] = useState<HealthConnectStatus | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        healthConnectStatus().then(setStatus);
    }, []);

    // Web / iOS / no Health Connect app — stay invisible
    if (status === null || status === 'unsupported' || status === 'unavailable') return null;

    async function connect() {
        setBusy(true);
        try {
            const granted = await connectHealthConnect();
            if (granted) {
                toast.success('Health Connect linked — sleep will sync automatically');
                setStatus('connected');
            } else {
                toast.error('Permission not granted');
            }
        } finally {
            setBusy(false);
        }
    }

    async function syncNow() {
        setBusy(true);
        try {
            const n = await syncSleep();
            toast.success(n > 0 ? `Synced ${n} sleep session${n === 1 ? '' : 's'}` : 'Already up to date');
        } finally {
            setBusy(false);
        }
    }

    return (
        <section
            className="p-6 rounded-2xl border shadow-sm space-y-4"
            style={{ background: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-light)' }}
        >
            <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                <h3 className="font-bold text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                    Health Connect
                </h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Pull your watch&apos;s sleep tracking (via Samsung Health) into your readiness score — no manual
                sleep rating needed on tracked nights.
            </p>

            {status === 'connected' ? (
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--color-success)' }}>
                        <Check className="w-4 h-4" /> Connected
                    </span>
                    <button
                        onClick={syncNow}
                        disabled={busy}
                        className="px-4 py-2 rounded-xl text-sm font-bold border disabled:opacity-60"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sync now'}
                    </button>
                </div>
            ) : (
                <button
                    onClick={connect}
                    disabled={busy}
                    className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect Health Connect'}
                </button>
            )}
        </section>
    );
}
