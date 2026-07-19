'use client';

import { format } from 'date-fns';
import { supabase } from './supabase';

/**
 * Bridge to the native HealthConnect Capacitor plugin (Android app shell
 * only). Samsung Health syncs the watch's nightly sleep tracking into Health
 * Connect; we read the sessions and mirror them into sleep_records, which
 * feeds the readiness score's sleep component automatically.
 */

interface HCSleepSession {
    id: string;
    start: string; // ISO instant
    end: string;
    durationMinutes: number;
    deepMinutes: number;
    remMinutes: number;
    lightMinutes: number;
    awakeMinutes: number;
}

interface HCPlugin {
    isAvailable(): Promise<{ available: boolean }>;
    hasPermissions(): Promise<{ granted: boolean }>;
    requestHealthPermissions(): Promise<{ granted: boolean }>;
    readSleepSessions(opts: { since?: string }): Promise<{ sessions: HCSleepSession[] }>;
}

const LAST_SYNC_KEY = 'health-connect-last-sync';

function native(): HCPlugin | null {
    if (typeof window === 'undefined') return null;
    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform?.() || cap.getPlatform?.() !== 'android') return null;
    const plugin = cap.Plugins?.HealthConnect;
    return (plugin as HCPlugin) ?? null;
}

export type HealthConnectStatus = 'unsupported' | 'unavailable' | 'needs-permission' | 'connected';

export async function healthConnectStatus(): Promise<HealthConnectStatus> {
    const hc = native();
    if (!hc) return 'unsupported';
    try {
        const { available } = await hc.isAvailable();
        if (!available) return 'unavailable';
        const { granted } = await hc.hasPermissions();
        return granted ? 'connected' : 'needs-permission';
    } catch {
        return 'unavailable';
    }
}

/** Ask for the sleep-read permission (shows the Health Connect grant UI). */
export async function connectHealthConnect(): Promise<boolean> {
    const hc = native();
    if (!hc) return false;
    try {
        const { granted } = await hc.requestHealthPermissions();
        if (granted) await syncSleep();
        return granted;
    } catch {
        return false;
    }
}

/** Pull new sleep sessions into sleep_records. Returns rows written. */
export async function syncSleep(): Promise<number> {
    const hc = native();
    if (!hc) return 0;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 0;

    try {
        const { granted } = await hc.hasPermissions();
        if (!granted) return 0;

        const since = localStorage.getItem(LAST_SYNC_KEY)
            ?? new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
        const { sessions } = await hc.readSleepSessions({ since });
        if (!sessions.length) {
            localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
            return 0;
        }

        const rows = sessions
            .filter(s => s.durationMinutes >= 30) // ignore sensor blips
            .map(s => ({
                user_id: session.user.id,
                // The sleep belongs to the day you woke up, in local time
                date: format(new Date(s.end), 'yyyy-MM-dd'),
                start_time: s.start,
                end_time: s.end,
                duration_minutes: Math.round(s.durationMinutes),
                deep_minutes: Math.round(s.deepMinutes) || null,
                rem_minutes: Math.round(s.remMinutes) || null,
                light_minutes: Math.round(s.lightMinutes) || null,
                awake_minutes: Math.round(s.awakeMinutes) || null,
                source: 'health_connect',
                external_id: s.id,
            }));

        if (rows.length) {
            const { error } = await supabase
                .from('sleep_records')
                .upsert(rows, { onConflict: 'user_id,source,external_id' });
            if (error) throw error;
        }

        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        return rows.length;
    } catch (e) {
        console.error('[HealthConnect] sleep sync failed', e);
        return 0;
    }
}
