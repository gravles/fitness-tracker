'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Bot, Plus, Trash2, Copy, Check, Key, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ApiKey {
    id: string;
    name: string;
    created_at: string;
    last_used_at: string | null;
}

export function ClaudeConnectorSection() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [newKeyUrl, setNewKeyUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => { loadKeys(); }, []);

    async function authHeaders() {
        const { data: { session } } = await supabase.auth.getSession();
        return { Authorization: `Bearer ${session?.access_token ?? ''}` };
    }

    async function loadKeys() {
        setLoading(true);
        try {
            const res = await fetch('/api/mcp/keygen', { headers: await authHeaders() });
            if (res.ok) setKeys(await res.json());
        } catch { /* silently ignore */ }
        finally { setLoading(false); }
    }

    async function generateKey() {
        setGenerating(true);
        setNewKeyUrl(null);
        try {
            const res = await fetch('/api/mcp/keygen', {
                method: 'POST',
                headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Claude MCP' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed');
            const url = `https://fit.nathandavie.com/api/mcp?key=${data.key}`;
            setNewKeyUrl(url);
            setKeys(prev => [{ id: data.id, name: data.name, created_at: data.created_at, last_used_at: null }, ...prev]);
            toast.success('API key generated!');
        } catch (e: any) {
            toast.error(e.message || 'Failed to generate key');
        } finally {
            setGenerating(false);
        }
    }

    async function revokeKey(id: string) {
        try {
            const res = await fetch(`/api/mcp/keygen?id=${id}`, { method: 'DELETE', headers: await authHeaders() });
            if (!res.ok) throw new Error();
            setKeys(prev => prev.filter(k => k.id !== id));
            if (newKeyUrl) setNewKeyUrl(null);
            toast.success('Key revoked');
        } catch {
            toast.error('Failed to revoke key');
        }
    }

    async function copyUrl() {
        if (!newKeyUrl) return;
        await navigator.clipboard.writeText(newKeyUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    }

    const READ_TOOLS  = ['📊 Daily logs', '🏋️ Workouts & sets', '⚖️ Body metrics', '👤 Profile & goals'];
    const WRITE_TOOLS = ['🥗 Log food', '🏃 Log workouts', '💤 Update wellness'];

    if (loading) {
        return (
            <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
        );
    }

    return (
        <div className="space-y-4">

            {/* New key URL reveal */}
            {newKeyUrl && (
                <div className="p-4 rounded-xl border-2 space-y-3" style={{ background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.3)' }}>
                    <p className="text-xs font-bold" style={{ color: 'var(--color-success)' }}>
                        ✓ Key generated — copy your MCP URL below. It won&apos;t be shown again.
                    </p>
                    <div className="flex gap-2 items-stretch">
                        <div
                            className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono break-all"
                            style={{
                                background: 'var(--color-bg-subtle)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            {newKeyUrl}
                        </div>
                        <button
                            onClick={copyUrl}
                            className="px-3 rounded-xl flex-shrink-0 transition-all"
                            style={{
                                background: copied ? 'rgba(34,197,94,0.1)' : 'var(--color-bg-subtle)',
                                border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--color-border)'}`,
                                color: copied ? 'var(--color-success)' : 'var(--color-text-muted)',
                            }}
                            title="Copy URL"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        In Claude: <strong>Settings → Integrations → Add MCP server</strong> → paste URL
                    </p>
                </div>
            )}

            {/* Existing keys */}
            {keys.length > 0 && (
                <div className="space-y-2">
                    {keys.map(key => (
                        <div
                            key={key.id}
                            className="flex items-center justify-between p-3 rounded-xl"
                            style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-light)' }}
                        >
                            <div className="flex items-center gap-3">
                                <Key className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                                <div>
                                    <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{key.name}</p>
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {key.last_used_at
                                            ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}`
                                            : `Created ${new Date(key.created_at).toLocaleDateString()}`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => revokeKey(key.id)}
                                className="p-2 rounded-lg transition-all"
                                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                                title="Revoke key"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Generate button */}
            <button
                onClick={generateKey}
                disabled={generating}
                className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 border"
                style={
                    keys.length === 0
                        ? { background: 'var(--color-primary)', color: 'white', borderColor: 'transparent' }
                        : { background: 'transparent', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                }
            >
                {generating
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Plus className="w-4 h-4" />}
                {keys.length === 0 ? 'Generate MCP Key' : 'Generate New Key'}
            </button>

            {/* Available tools reference */}
            <div
                className="p-4 rounded-xl space-y-2"
                style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-light)' }}
            >
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    What Claude can access
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)' }}>Read</p>
                        {READ_TOOLS.map(t => (
                            <p key={t} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t}</p>
                        ))}
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-gold)' }}>Write</p>
                        {WRITE_TOOLS.map(t => (
                            <p key={t} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t}</p>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
