'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { confirm } from '@/components/ConfirmDialog';
import { Loader2, RefreshCw, Check, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function StravaConnect() {
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const router = useRouter();

    useEffect(() => {
        checkConnection();
    }, []);

    async function checkConnection() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('integrations')
                .select('id')
                .eq('user_id', user.id)
                .eq('provider', 'strava')
                .single();

            setConnected(!!data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleConnect() {
        window.location.href = '/api/strava/auth';
    }

    async function handleSync() {
        setSyncing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/strava/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            const data = await res.json();
            if (res.ok) {
                if (data.count > 0) {
                    const names = data.added.map((a: any) => `${a.name} (${a.date})`).join(', ');
                    toast.success(`Synced ${data.count} new activities: ${names}`);
                } else {
                    toast('No new activities found (checked last 30 days).');
                }
                router.refresh();
            } else {
                toast.error('Sync failed: ' + data.error);
            }

        } catch (e) {
            console.error(e);
            toast.error('Error syncing');
        } finally {
            setSyncing(false);
        }
    }

    if (loading) return (
        <div className="h-12 w-full bg-[var(--color-bg-subtle)] rounded-xl animate-pulse" />
    );

    return (
        <div className="bg-[var(--color-surface-elevated)] p-6 rounded-2xl border border-[var(--color-border-light)] shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-[var(--color-border-light)] pb-4">
                <span className="text-xl text-[#FC4C02]">
                    <svg role="img" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                    </svg>
                </span>
                <div className="flex-1">
                    <h2 className="font-bold text-lg text-[var(--color-text)]">Strava Integration</h2>
                    <p className="text-xs text-[var(--color-text-muted)]">Automatically sync your runs and rides.</p>
                </div>
                {connected && (
                    <span className="bg-[var(--color-success)]/10 text-[var(--color-success)] text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Connected
                    </span>
                )}
            </div>

            {connected ? (
                <div className="flex gap-3">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex-1 py-3 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                        style={{ background: 'var(--color-navy)' }}
                    >
                        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Sync Activities Now
                    </button>
                    <button
                        onClick={async () => {
                            if (!await confirm({ title: 'Disconnect Strava', message: 'Disconnect your Strava account?', danger: true, confirmLabel: 'Disconnect' })) return;
                            const { error } = await supabase.from('integrations').delete().eq('provider', 'strava');
                            if (!error) setConnected(false);
                        }}
                        className="px-4 py-3 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-colors"
                    >
                        Disconnect
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleConnect}
                    className="w-full py-4 bg-[#FC4C02] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                >
                    Connect with Strava
                </button>
            )}
        </div>
    );
}
