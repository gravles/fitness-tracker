'use client';

import { useState } from 'react';
import { authHeaders } from '@/lib/supabase';
import { Watch, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

export function PairDeviceSection() {
    const [code, setCode] = useState('');
    const [claiming, setClaiming] = useState(false);
    const [pairedName, setPairedName] = useState<string | null>(null);

    async function claim() {
        if (code.replace(/[\s-]/g, '').length < 6) return;
        setClaiming(true);
        try {
            const res = await fetch('/api/pair/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                body: JSON.stringify({ code }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Pairing failed');
            setPairedName(data.device_name);
            setCode('');
            toast.success(`Paired ${data.device_name}!`);
        } catch (e: any) {
            toast.error(e.message || 'Pairing failed');
        } finally {
            setClaiming(false);
        }
    }

    if (pairedName) {
        return (
            <div
                className="p-4 rounded-xl border-2 flex items-center gap-3"
                style={{ background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.3)' }}
            >
                <Check className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                        {pairedName} is paired
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        It appears under Claude AI Connector keys — revoke it there to unpair.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-2 items-stretch">
            <div className="relative flex-1">
                <Watch
                    className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-text-muted)' }}
                />
                <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') claim(); }}
                    placeholder="ABC123"
                    maxLength={8}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-mono tracking-[0.3em] uppercase"
                    style={{
                        background: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                    }}
                    aria-label="Pairing code"
                />
            </div>
            <button
                onClick={claim}
                disabled={claiming || code.replace(/[\s-]/g, '').length < 6}
                className="px-4 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: 'var(--color-primary)', color: 'white' }}
            >
                {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pair'}
            </button>
        </div>
    );
}
