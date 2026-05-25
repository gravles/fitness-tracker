import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import http2 from 'http2';

// ─── Web Push (VAPID) ────────────────────────────────────────────────────────
webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
);

// ─── Apple Push Notification service (APNs) ─────────────────────────────────
// Required env vars: APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRIVATE_KEY
// APNS_PRIVATE_KEY is the full contents of the .p8 file (newlines as \n or literal)

function makeApnsJwt(): string {
    const keyId  = process.env.APNS_KEY_ID!;
    const teamId = process.env.APNS_TEAM_ID!;
    const p8     = (process.env.APNS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

    const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
    const unsigned = `${header}.${payload}`;

    const sig = crypto.sign('SHA256', Buffer.from(unsigned), { key: p8, dsaEncoding: 'ieee-p1363' });
    return `${unsigned}.${sig.toString('base64url')}`;
}

function sendApnsMessage(
    deviceToken: string,
    title: string,
    body: string,
    data: Record<string, string>,
): Promise<{ ok: boolean; expired: boolean }> {
    return new Promise((resolve) => {
        const bundleId = process.env.APNS_BUNDLE_ID ?? 'com.nathandavie.fitnesstracker';
        const apnsJwt  = makeApnsJwt();
        const payload  = JSON.stringify({
            aps: { alert: { title, body }, badge: 1, sound: 'default' },
            ...data,
        });

        const client = http2.connect('https://api.push.apple.com');
        client.on('error', () => resolve({ ok: false, expired: false }));

        const req = client.request({
            ':method': 'POST',
            ':path':   `/3/device/${deviceToken}`,
            'authorization':    `bearer ${apnsJwt}`,
            'apns-topic':       bundleId,
            'apns-push-type':   'alert',
            'apns-priority':    '10',
            'content-type':     'application/json',
            'content-length':   String(Buffer.byteLength(payload)),
        });

        req.write(payload);
        req.end();

        let statusCode = 0;
        req.on('response', (headers) => { statusCode = Number(headers[':status']); });
        req.on('end', () => {
            client.close();
            resolve({ ok: statusCode === 200, expired: statusCode === 410 });
        });
        req.on('error', () => { client.close(); resolve({ ok: false, expired: false }); });
    });
}

// ─── Firebase Admin (FCM) — Android only ────────────────────────────────────
let firebaseMessaging: import('firebase-admin/messaging').Messaging | null = null;

async function getMessaging() {
    if (firebaseMessaging) return firebaseMessaging;
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;

    try {
        const { initializeApp, getApps, cert } = await import('firebase-admin/app');
        const { getMessaging: _getMsg }         = await import('firebase-admin/messaging');
        if (!getApps().length) {
            const sa = JSON.parse(
                Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
            );
            initializeApp({ credential: cert(sa) });
        }
        firebaseMessaging = _getMsg();
    } catch (e) {
        console.error('[FCM] Failed to initialise Firebase Admin:', e);
    }
    return firebaseMessaging;
}

// ─── Supabase ────────────────────────────────────────────────────────────────
function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

function isAuthorized(request: NextRequest): boolean {
    return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

interface Reminder {
    id:      string;
    label:   string;
    time:    string;   // "HH:MM" UTC
    enabled: boolean;
    body?:   string;
}

/**
 * Convert a local wall-clock date+time in a given IANA timezone to a UTC Date.
 * Works without any external library by leveraging the Intl API.
 */
function localToUtcDate(dateStr: string, timeStr: string, tz: string): Date {
    // Probe: treat the scheduled time as if it were UTC
    const probe = new Date(`${dateStr}T${timeStr.slice(0, 5)}:00Z`);
    // Find out what local wall-clock time that UTC instant corresponds to in `tz`
    const localRepr = probe.toLocaleString('sv-SE', { timeZone: tz }); // "YYYY-MM-DD HH:mm:ss"
    const localMs = new Date(localRepr.replace(' ', 'T') + 'Z').getTime();
    // The difference tells us the UTC offset at that moment
    const offsetMs = localMs - probe.getTime();
    // Subtract the offset to get the actual UTC instant for the wall-clock time
    return new Date(probe.getTime() - offsetMs);
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase      = getSupabaseAdmin();
        const messaging     = await getMessaging();
        const now           = new Date();
        const currentHour   = now.getUTCHours();
        const currentMinute = now.getUTCMinutes();

        const todayDateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD UTC

        // Fetch push subscriptions, device tokens, AND today's log entries in parallel
        const [{ data: webSubs }, { data: deviceTokenRows }, { data: todayLogs }] = await Promise.all([
            supabase.from('push_subscriptions').select('*'),
            supabase.from('device_tokens').select('user_id, token, platform, reminders'),
            // Smart-skip: find users who have already logged anything today
            supabase
                .from('daily_logs')
                .select('user_id')
                .eq('date', todayDateStr)
                .or('nutrition_logged.eq.true,movement_completed.eq.true,calories.gt.0'),
        ]);

        // Users who have already logged today — skip daily reminders for them
        const alreadyLoggedToday = new Set<string>(
            (todayLogs ?? []).map((r: { user_id: string }) => r.user_id)
        );

        // Build lookup: user_id → [{ token, platform }, ...]
        type TokenEntry = { token: string; platform: string };
        const tokensByUser: Record<string, TokenEntry[]> = {};
        for (const row of (deviceTokenRows ?? [])) {
            (tokensByUser[row.user_id] ??= []).push({
                token:    row.token,
                platform: (row.platform as string) ?? 'android',
            });
        }

        let sent = 0, failed = 0;
        const expiredEndpoints: string[] = [];
        const expiredFcmTokens: string[] = [];

        // Helper: send a native push to all tokens for a user
        // iOS → direct APNs (HTTP/2 + JWT)
        // Android → Firebase Cloud Messaging
        async function sendNative(userId: string, title: string, body: string, tag: string, url = '/schedule') {
            for (const { token, platform } of (tokensByUser[userId] ?? [])) {
                try {
                    if (platform === 'ios') {
                        const { ok, expired } = await sendApnsMessage(token, title, body, { url, tag });
                        if (expired) expiredFcmTokens.push(token);
                        if (ok) sent++; else failed++;
                    } else if (messaging) {
                        await messaging.send({
                            token,
                            notification: { title, body },
                            data:         { url, tag },
                            android: { priority: 'high' },
                        });
                        sent++;
                    }
                } catch (err: any) {
                    if (
                        err.code === 'messaging/registration-token-not-registered' ||
                        err.code === 'messaging/invalid-registration-token'
                    ) {
                        expiredFcmTokens.push(token);
                    }
                    failed++;
                }
            }
        }

        // ── 1. Daily reminders (web-push subscribers) ─────────────────────
        const webSubUserIds = new Set<string>();
        await Promise.all((webSubs ?? []).map(async (sub) => {
            webSubUserIds.add(sub.user_id);
            // Smart-skip: user already logged today, no need to remind them
            if (alreadyLoggedToday.has(sub.user_id)) return;
            const reminders: Reminder[] = sub.reminders ?? [];
            const due = reminders.filter(r => {
                if (!r.enabled) return false;
                const [h, m] = r.time.split(':').map(Number);
                return h === currentHour && m === currentMinute;
            });

            for (const reminder of due) {
                const title = reminder.label;
                const body  = reminder.body ?? 'Tap to open your fitness tracker.';
                const tag   = `reminder-${reminder.id}`;

                try {
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify({ title, body, url: '/log', tag }),
                        { TTL: 3600 }
                    );
                    sent++;
                } catch (err: any) {
                    if (err.statusCode === 410 || err.statusCode === 404) expiredEndpoints.push(sub.endpoint);
                    failed++;
                }

                await sendNative(sub.user_id, title, body, tag, '/log');
            }
        }));

        // ── 2. Daily reminders (native-only FCM users) ────────────────────
        const nativeRemindersByUser: Record<string, Reminder[]> = {};
        for (const row of (deviceTokenRows ?? [])) {
            if (webSubUserIds.has(row.user_id)) continue;
            const reminders: Reminder[] = row.reminders ?? [];
            if (reminders.length > 0 && !nativeRemindersByUser[row.user_id]) {
                nativeRemindersByUser[row.user_id] = reminders;
            }
        }

        for (const [userId, reminders] of Object.entries(nativeRemindersByUser)) {
            // Smart-skip: user already logged today
            if (alreadyLoggedToday.has(userId)) continue;
            const due = reminders.filter(r => {
                if (!r.enabled) return false;
                const [h, m] = r.time.split(':').map(Number);
                return h === currentHour && m === currentMinute;
            });
            for (const reminder of due) {
                await sendNative(userId, reminder.label, reminder.body ?? 'Tap to open your fitness tracker.', `reminder-${reminder.id}`, '/log');
            }
        }

        // ── 3. Scheduled workout notifications ────────────────────────────
        const allUserIds = Object.keys(tokensByUser);
        if (allUserIds.length > 0) {
            // Fetch workouts for today and tomorrow (UTC) to handle all timezone offsets
            const todayUtc     = now.toISOString().slice(0, 10);
            const tomorrowUtc  = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

            const [{ data: userSettings }, { data: pendingWorkouts }] = await Promise.all([
                supabase
                    .from('user_settings')
                    .select('user_id, timezone')
                    .in('user_id', allUserIds),
                supabase
                    .from('scheduled_workouts')
                    .select('id, user_id, scheduled_date, scheduled_time, title, remind_minutes')
                    .in('user_id', allUserIds)
                    .in('scheduled_date', [todayUtc, tomorrowUtc])
                    .eq('status', 'scheduled')
                    .eq('reminder_sent', false),
            ]);

            const tzByUser: Record<string, string> = {};
            for (const us of (userSettings ?? [])) {
                tzByUser[us.user_id] = us.timezone ?? 'UTC';
            }

            const notifiedIds: string[] = [];

            for (const workout of (pendingWorkouts ?? [])) {
                const tz           = tzByUser[workout.user_id] ?? 'UTC';
                const remindBefore = (workout.remind_minutes ?? 15) * 60_000; // ms
                const workoutUtc   = localToUtcDate(workout.scheduled_date, workout.scheduled_time, tz);
                const notifyAt     = workoutUtc.getTime() - remindBefore;
                const nowMs        = now.getTime();

                // Fire if we're within this 60-second cron window
                if (nowMs >= notifyAt && nowMs < notifyAt + 60_000) {
                    const minsBefore = workout.remind_minutes ?? 15;
                    const timeLabel  = minsBefore === 0   ? 'Starting now'
                                     : minsBefore < 60   ? `in ${minsBefore} min`
                                     : minsBefore === 60  ? 'in 1 hour'
                                     : minsBefore === 1440 ? 'tomorrow'
                                     : `in ${minsBefore / 60} hours`;

                    await sendNative(
                        workout.user_id,
                        `🏋️ ${workout.title}`,
                        `${timeLabel} — time to get moving!`,
                        `workout-${workout.id}`,
                        '/schedule',
                    );
                    notifiedIds.push(workout.id);
                }
            }

            if (notifiedIds.length > 0) {
                await supabase
                    .from('scheduled_workouts')
                    .update({ reminder_sent: true })
                    .in('id', notifiedIds);
            }
        }

        // ── Clean up expired tokens ───────────────────────────────────────
        await Promise.all([
            expiredEndpoints.length > 0
                ? supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
                : Promise.resolve(),
            expiredFcmTokens.length > 0
                ? supabase.from('device_tokens').delete().in('token', expiredFcmTokens)
                : Promise.resolve(),
        ]);

        return NextResponse.json({ success: true, sent, failed });
    } catch (error) {
        console.error('Cron send-reminders error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
