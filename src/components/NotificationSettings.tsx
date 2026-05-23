'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Clock, Loader2, Plus, Trash2 } from 'lucide-react';
import {
    isPushSupported,
    getPermissionStatus,
    subscribeToPush,
    unsubscribeFromPush,
    updateReminders,
    Reminder,
} from '@/lib/notifications';
import { isNative } from '@/lib/native';
import { haptics } from '@/lib/haptics';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

function randomId() {
    return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_REMINDERS: Reminder[] = [
    { id: randomId(), label: "Log your day 📝", time: '20:00', enabled: true },
    { id: randomId(), label: "Time to move 💪", time: '09:00', enabled: true },
];

// ─── Native helpers ────────────────────────────────────────────────────────

async function checkNativePermission(): Promise<'granted' | 'denied' | 'default'> {
    try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const result = await PushNotifications.checkPermissions();
        return result.receive === 'granted' ? 'granted'
             : result.receive === 'denied'  ? 'denied'
             : 'default';
    } catch {
        return 'default';
    }
}

async function subscribeNative(reminders: Reminder[]): Promise<boolean> {
    try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const result = await PushNotifications.requestPermissions();
        if (result.receive !== 'granted') return false;
        await PushNotifications.register();
        await updateReminders(reminders);   // save reminder prefs server-side
        return true;
    } catch {
        return false;
    }
}

async function unsubscribeNative(): Promise<void> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await fetch('/api/notifications/register-device', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` },
        });
    } catch {
        // Silently fail
    }
}

// ─── Component ─────────────────────────────────────────────────────────────

export function NotificationSettings() {
    const [enabled, setEnabled]                   = useState(false);
    const [reminders, setReminders]               = useState<Reminder[]>(DEFAULT_REMINDERS);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
    const [loading, setLoading]                   = useState(false);
    const [syncingReminders, setSyncingReminders] = useState(false);
    const [native]                                = useState(() => isNative());

    useEffect(() => {
        const saved = localStorage.getItem('reminder_settings_v2');
        if (saved) {
            const parsed = JSON.parse(saved);
            setEnabled(parsed.enabled ?? false);
            setReminders(parsed.reminders ?? DEFAULT_REMINDERS);
        } else {
            // Migrate from old format
            const oldSaved = localStorage.getItem('reminder_settings');
            if (oldSaved) {
                const old = JSON.parse(oldSaved);
                const migrated: Reminder[] = [];
                if (old.logReminderEnabled !== false) {
                    migrated.push({ id: randomId(), label: "Log your day 📝", time: old.logReminderTime || '20:00', enabled: old.logReminderEnabled ?? true });
                }
                if (old.moveReminderEnabled !== false) {
                    migrated.push({ id: randomId(), label: "Time to move 💪", time: old.moveReminderTime || '09:00', enabled: old.moveReminderEnabled ?? true });
                }
                setEnabled(old.enabled ?? false);
                if (migrated.length) setReminders(migrated);
            }
        }

        // Check current permission state
        if (native) {
            checkNativePermission().then(s => setPermissionStatus(s as any));
        } else {
            setPermissionStatus(getPermissionStatus());
        }
    }, [native]);

    function saveLocal(newEnabled: boolean, newReminders: Reminder[]) {
        localStorage.setItem('reminder_settings_v2', JSON.stringify({ enabled: newEnabled, reminders: newReminders }));
    }

    async function handleToggle() {
        setLoading(true);
        haptics.tap();
        try {
            if (enabled) {
                // ── Disable ──────────────────────────────────────────────
                if (native) {
                    await unsubscribeNative();
                } else {
                    await unsubscribeFromPush();
                }
                setEnabled(false);
                saveLocal(false, reminders);
            } else {
                // ── Enable ───────────────────────────────────────────────
                if (native) {
                    const ok = await subscribeNative(reminders);
                    if (ok) {
                        setEnabled(true);
                        saveLocal(true, reminders);
                        setPermissionStatus('granted');
                        toast.success('Reminders enabled!');
                    } else {
                        const status = await checkNativePermission();
                        setPermissionStatus(status as any);
                        if (status === 'denied') {
                            toast.error('Please enable notifications in your device settings.');
                        }
                    }
                } else {
                    const sub = await subscribeToPush(reminders);
                    if (sub) {
                        setEnabled(true);
                        saveLocal(true, reminders);
                        setPermissionStatus('granted');
                        toast.success('Reminders enabled!');
                    } else {
                        setPermissionStatus(getPermissionStatus());
                    }
                }
            }
        } catch (e) {
            console.error('Toggle notifications failed', e);
        } finally {
            setLoading(false);
        }
    }

    async function syncRemindersToServer(newReminders: Reminder[]) {
        if (!enabled) return;
        setSyncingReminders(true);
        try {
            await updateReminders(newReminders);
        } finally {
            setSyncingReminders(false);
        }
    }

    function updateReminder(id: string, patch: Partial<Reminder>) {
        const updated = reminders.map(r => r.id === id ? { ...r, ...patch } : r);
        setReminders(updated);
        saveLocal(enabled, updated);
        syncRemindersToServer(updated);
    }

    function removeReminder(id: string) {
        haptics.tap();
        const updated = reminders.filter(r => r.id !== id);
        setReminders(updated);
        saveLocal(enabled, updated);
        syncRemindersToServer(updated);
    }

    function addReminder() {
        haptics.tap();
        const newReminder: Reminder = { id: randomId(), label: 'New reminder', time: '12:00', enabled: true };
        const updated = [...reminders, newReminder];
        setReminders(updated);
        saveLocal(enabled, updated);
        syncRemindersToServer(updated);
    }

    // ── Not supported (web only) ─────────────────────────────────────────
    if (!native && !isPushSupported()) {
        return (
            <div className="p-4 rounded-2xl border" style={{ background: 'rgba(234,179,8,0.05)', borderColor: 'rgba(234,179,8,0.3)' }}>
                <div className="flex items-center gap-3">
                    <BellOff className="w-5 h-5 text-yellow-500" />
                    <div>
                        <p className="font-medium text-[var(--color-text)]">Notifications Not Supported</p>
                        <p className="text-sm text-[var(--color-text-muted)]">Your browser doesn't support push notifications.</p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Blocked ──────────────────────────────────────────────────────────
    if (permissionStatus === 'denied') {
        return (
            <div className="p-4 rounded-2xl border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                <div className="flex items-center gap-3">
                    <BellOff className="w-5 h-5 text-red-500" />
                    <div>
                        <p className="font-medium text-[var(--color-text)]">Notifications Blocked</p>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {native
                                ? 'Enable notifications in your device Settings → FitnessTracker.'
                                : 'Please enable notifications in your browser settings.'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main UI ──────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* Master toggle */}
            <div className="p-4 bg-[var(--color-surface-elevated)] rounded-2xl border border-[var(--color-border-light)] shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl" style={enabled
                            ? { background: 'var(--color-primary)' }
                            : { background: 'var(--color-bg-subtle)' }
                        }>
                            <Bell className="w-5 h-5" style={{ color: enabled ? 'white' : 'var(--color-text-muted)' }} />
                        </div>
                        <div>
                            <p className="font-bold text-[var(--color-text)]">Daily Reminders</p>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {enabled
                                    ? `${reminders.filter(r => r.enabled).length} active reminder${reminders.filter(r => r.enabled).length !== 1 ? 's' : ''}`
                                    : 'Get notified throughout the day'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleToggle}
                        disabled={loading}
                        className="relative w-14 h-8 rounded-full transition-colors"
                        style={{ background: enabled ? 'var(--color-primary)' : 'var(--color-bg-muted)' }}
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
                        ) : (
                            <div className={`absolute w-6 h-6 bg-white rounded-full shadow-md transition-transform top-1 ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                        )}
                    </button>
                </div>
            </div>

            {/* Reminder list */}
            {enabled && (
                <div className="space-y-2">
                    {reminders.map((r) => (
                        <div key={r.id} className="p-4 bg-[var(--color-surface-elevated)] rounded-2xl border border-[var(--color-border-light)] space-y-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={r.label}
                                    onChange={(e) => updateReminder(r.id, { label: e.target.value })}
                                    className="flex-1 text-sm font-medium bg-transparent outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
                                    placeholder="Reminder label"
                                />
                                <button
                                    onClick={() => { haptics.tap(); updateReminder(r.id, { enabled: !r.enabled }); }}
                                    className="w-10 h-6 rounded-full transition-colors flex-shrink-0"
                                    style={{ background: r.enabled ? 'var(--color-primary)' : 'var(--color-bg-muted)' }}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ml-1 ${r.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                                <button
                                    onClick={() => removeReminder(r.id)}
                                    className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                                    style={{ color: 'var(--color-text-muted)' }}
                                    aria-label="Remove reminder"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            {r.enabled && (
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                                    <input
                                        type="time"
                                        value={r.time}
                                        onChange={(e) => updateReminder(r.id, { time: e.target.value })}
                                        className="px-3 py-1.5 border border-[var(--color-border)] rounded-xl text-sm focus:outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)]"
                                        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                        onBlur={e => { e.target.style.borderColor = ''; }}
                                    />
                                    {syncingReminders && (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    <button
                        onClick={addReminder}
                        className="w-full py-3 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-sm font-medium transition-all"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                        <Plus className="w-4 h-4" />
                        Add reminder
                    </button>

                    <p className="text-xs text-[var(--color-text-muted)] text-center px-4">
                        {native
                            ? 'Reminders are delivered as native push notifications, even when the app is closed.'
                            : 'Reminders fire at the UTC hour closest to your set time. Times shown are UTC.'}
                    </p>
                </div>
            )}
        </div>
    );
}
