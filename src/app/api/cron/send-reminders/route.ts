import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// ─── Web Push (VAPID) ────────────────────────────────────────────────────────
webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
);

// ─── Firebase Admin (FCM) ────────────────────────────────────────────────────
// Requires env var FIREBASE_SERVICE_ACCOUNT = base64-encoded service-account JSON.
// Encode on Mac:  base64 -i serviceAccount.json | tr -d '\n'
// Add to Vercel:  Settings → Environment Variables → FIREBASE_SERVICE_ACCOUNT
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
    time:    string;   // "HH:MM"
    enabled: boolean;
    body?:   string;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase    = getSupabaseAdmin();
        const messaging   = await getMessaging();
        const currentHour = new Date().getUTCHours();

        // Fetch web-push subscriptions and native device tokens in parallel
        const [{ data: webSubs }, { data: deviceTokenRows }] = await Promise.all([
            supabase.from('push_subscriptions').select('*'),
            supabase.from('device_tokens').select('user_id, token'),
        ]);

        if (!webSubs?.length && !deviceTokenRows?.length) {
            return NextResponse.json({ success: true, sent: 0, failed: 0 });
        }

        // Build a quick lookup: user_id → [fcm_token, ...]
        const tokensByUser: Record<string, string[]> = {};
        for (const row of (deviceTokenRows ?? [])) {
            (tokensByUser[row.user_id] ??= []).push(row.token);
        }

        let sent = 0, failed = 0;
        const expiredEndpoints: string[] = [];
        const expiredFcmTokens: string[] = [];

        await Promise.all((webSubs ?? []).map(async (sub) => {
            const reminders: Reminder[] = sub.reminders ?? [];
            const due = reminders.filter(r => {
                if (!r.enabled) return false;
                const [h] = r.time.split(':').map(Number);
                return h === currentHour;
            });

            for (const reminder of due) {
                const title = reminder.label;
                const body  = reminder.body ?? 'Tap to open your fitness tracker.';
                const tag   = `reminder-${reminder.id}`;

                // ── Web push (PWA / browser) ──────────────────────────────
                try {
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify({ title, body, url: '/log', tag }),
                        { TTL: 3600 }
                    );
                    sent++;
                } catch (err: any) {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        expiredEndpoints.push(sub.endpoint);
                    }
                    failed++;
                }

                // ── FCM (native iOS / Android) ────────────────────────────
                if (!messaging) continue;
                for (const token of (tokensByUser[sub.user_id] ?? [])) {
                    try {
                        await messaging.send({
                            token,
                            notification: { title, body },
                            data:         { url: '/log', tag },
                            apns:    { payload: { aps: { badge: 1, sound: 'default' } } },
                            android: { priority: 'high' },
                        });
                        sent++;
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
        }));

        // ── Clean up expired subscriptions / tokens ───────────────────────
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
