'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Clock, Loader2, Check } from 'lucide-react';
import {
    isPushSupported,
    getPermissionStatus,
    subscribeToPush,
    unsubscribeFromPush,
} from '@/lib/notifications';
import { haptics } from '@/lib/haptics';

interface ReminderSettings {
    enabled: boolean;
    logReminderTime: string;
    moveReminderTime: string;
    logReminderEnabled: boolean;
    moveReminderEnabled: boolean;
}

const DEFAULT_SETTINGS: ReminderSettings = {
    enabled: false,
    logReminderTime: '20:00',
    moveReminderTime: '09:00',
    logReminderEnabled: true,
    moveReminderEnabled: true,
};

export function NotificationSettings() {
    const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_SETTINGS);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const savedSettings = localStorage.getItem('reminder_settings');
        if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
        }
        setPermissionStatus(getPermissionStatus());
    }, []);

    async function handleToggleNotifications() {
        setLoading(true);
        haptics.tap();

        try {
            if (settings.enabled) {
                await unsubscribeFromPush();
                const newSettings = { ...settings, enabled: false };
                setSettings(newSettings);
                saveSettings(newSettings);
            } else {
                const subscription = await subscribeToPush();
                if (subscription) {
                    const newSettings = { ...settings, enabled: true };
                    setSettings(newSettings);
                    saveSettings(newSettings);
                    setPermissionStatus('granted');
                    scheduleReminders(newSettings);
                } else {
                    setPermissionStatus(getPermissionStatus());
                }
            }
        } catch (error) {
            console.error('Failed to toggle notifications', error);
        } finally {
            setLoading(false);
        }
    }

    function handleTimeChange(field: 'logReminderTime' | 'moveReminderTime', value: string) {
        const newSettings = { ...settings, [field]: value };
        setSettings(newSettings);
        saveSettings(newSettings);
        if (settings.enabled) scheduleReminders(newSettings);
    }

    function handleReminderToggle(field: 'logReminderEnabled' | 'moveReminderEnabled') {
        haptics.tap();
        const newSettings = { ...settings, [field]: !settings[field] };
        setSettings(newSettings);
        saveSettings(newSettings);
        if (settings.enabled) scheduleReminders(newSettings);
    }

    function saveSettings(newSettings: ReminderSettings) {
        localStorage.setItem('reminder_settings', JSON.stringify(newSettings));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    function scheduleReminders(reminderSettings: ReminderSettings) {
        const reminders = [];
        if (reminderSettings.logReminderEnabled) {
            reminders.push({
                id: 'log-reminder',
                time: reminderSettings.logReminderTime,
                title: "Don't forget to log today! 📝",
                body: 'Keep your streak going - log your activity now.',
                tag: 'daily-log-reminder',
            });
        }
        if (reminderSettings.moveReminderEnabled) {
            reminders.push({
                id: 'move-reminder',
                time: reminderSettings.moveReminderTime,
                title: 'Time to move! 💪',
                body: 'Get some exercise in today to stay on track.',
                tag: 'daily-move-reminder',
            });
        }
        localStorage.setItem('scheduled_reminders', JSON.stringify(reminders));
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SCHEDULE_REMINDERS', reminders });
        }
    }

    if (!isPushSupported()) {
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

    if (permissionStatus === 'denied') {
        return (
            <div className="p-4 rounded-2xl border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                <div className="flex items-center gap-3">
                    <BellOff className="w-5 h-5 text-red-500" />
                    <div>
                        <p className="font-medium text-[var(--color-text)]">Notifications Blocked</p>
                        <p className="text-sm text-[var(--color-text-muted)]">Please enable notifications in your browser settings.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Main Toggle */}
            <div className="p-4 bg-[var(--color-surface-elevated)] rounded-2xl border border-[var(--color-border-light)] shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl" style={settings.enabled
                            ? { background: 'var(--color-primary)', }
                            : { background: 'var(--color-bg-subtle)' }
                        }>
                            <Bell className="w-5 h-5" style={{ color: settings.enabled ? 'white' : 'var(--color-text-muted)' }} />
                        </div>
                        <div>
                            <p className="font-bold text-[var(--color-text)]">Daily Reminders</p>
                            <p className="text-sm text-[var(--color-text-muted)]">Get reminded to log and move</p>
                        </div>
                    </div>

                    <button
                        onClick={handleToggleNotifications}
                        disabled={loading}
                        className="relative w-14 h-8 rounded-full transition-colors"
                        style={{ background: settings.enabled ? 'var(--color-primary)' : 'var(--color-bg-muted)' }}
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
                        ) : (
                            <div className={`absolute w-6 h-6 bg-white rounded-full shadow-md transition-transform top-1 ${settings.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                        )}
                    </button>
                </div>

                {saved && (
                    <div className="mt-2 flex items-center gap-1 text-sm" style={{ color: 'var(--color-success)' }}>
                        <Check className="w-4 h-4" /> Settings saved
                    </div>
                )}
            </div>

            {/* Reminder Settings */}
            {settings.enabled && (
                <div className="space-y-3">
                    {/* Log Reminder */}
                    <div className="p-4 bg-[var(--color-surface-elevated)] rounded-2xl border border-[var(--color-border-light)]">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">📝</span>
                                <span className="font-medium text-[var(--color-text)]">Log Reminder</span>
                            </div>
                            <button
                                onClick={() => handleReminderToggle('logReminderEnabled')}
                                className="w-10 h-6 rounded-full transition-colors"
                                style={{ background: settings.logReminderEnabled ? 'var(--color-primary)' : 'var(--color-bg-muted)' }}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.logReminderEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        {settings.logReminderEnabled && (
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                                <input
                                    type="time"
                                    value={settings.logReminderTime}
                                    onChange={(e) => handleTimeChange('logReminderTime', e.target.value)}
                                    className="px-3 py-2 border border-[var(--color-border)] rounded-xl text-sm focus:outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)]"
                                    onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                    onBlur={e => { e.target.style.borderColor = ''; }}
                                />
                                <span className="text-sm text-[var(--color-text-muted)]">Remind me to log</span>
                            </div>
                        )}
                    </div>

                    {/* Move Reminder */}
                    <div className="p-4 bg-[var(--color-surface-elevated)] rounded-2xl border border-[var(--color-border-light)]">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">💪</span>
                                <span className="font-medium text-[var(--color-text)]">Move Reminder</span>
                            </div>
                            <button
                                onClick={() => handleReminderToggle('moveReminderEnabled')}
                                className="w-10 h-6 rounded-full transition-colors"
                                style={{ background: settings.moveReminderEnabled ? 'var(--color-primary)' : 'var(--color-bg-muted)' }}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.moveReminderEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        {settings.moveReminderEnabled && (
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                                <input
                                    type="time"
                                    value={settings.moveReminderTime}
                                    onChange={(e) => handleTimeChange('moveReminderTime', e.target.value)}
                                    className="px-3 py-2 border border-[var(--color-border)] rounded-xl text-sm focus:outline-none bg-[var(--color-bg-subtle)] text-[var(--color-text)]"
                                    onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                    onBlur={e => { e.target.style.borderColor = ''; }}
                                />
                                <span className="text-sm text-[var(--color-text-muted)]">Remind me to move</span>
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-[var(--color-text-muted)] text-center px-4">
                        Reminders check when you open the app. For reliable scheduled notifications,
                        deploy the app and set up backend cron jobs.
                    </p>
                </div>
            )}
        </div>
    );
}
