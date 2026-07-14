// Server-only push helpers shared by the cron dispatcher and the partner
// feature routes. Covers all three transports: web-push (VAPID), APNs (iOS)
// and FCM (Android).
import webpush from 'web-push';
import crypto from 'crypto';
import http2 from 'http2';
import type { SupabaseClient } from '@supabase/supabase-js';

let vapidConfigured = false;

export function ensureVapid(): boolean {
    if (vapidConfigured) return true;
    if (!process.env.VAPID_EMAIL || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        return false;
    }
    webpush.setVapidDetails(
        process.env.VAPID_EMAIL,
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
    );
    vapidConfigured = true;
    return true;
}

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

export function sendApnsMessage(
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

export async function getMessaging() {
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

export interface PushMessage {
    title: string;
    body: string;
    url?: string;
    tag?: string;
}

/**
 * Send a push notification to every registered channel (web-push endpoints,
 * iOS devices via APNs, Android devices via FCM) for one user, cleaning up
 * expired tokens as a side effect. Failures are swallowed — a push is
 * best-effort and must never fail the calling request.
 */
export async function sendPushToUser(
    supabaseAdmin: SupabaseClient,
    userId: string,
    msg: PushMessage,
): Promise<{ sent: number; failed: number }> {
    const url = msg.url ?? '/partner';
    const tag = msg.tag ?? 'partner';
    let sent = 0, failed = 0;

    const [{ data: webSubs }, { data: deviceTokens }] = await Promise.all([
        supabaseAdmin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId),
        supabaseAdmin.from('device_tokens').select('token, platform').eq('user_id', userId),
    ]);

    const expiredEndpoints: string[] = [];
    const expiredTokens: string[] = [];

    if (ensureVapid()) {
        for (const sub of (webSubs ?? [])) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    JSON.stringify({ title: msg.title, body: msg.body, url, tag }),
                    { TTL: 3600 },
                );
                sent++;
            } catch (err: any) {
                if (err.statusCode === 410 || err.statusCode === 404) expiredEndpoints.push(sub.endpoint);
                failed++;
            }
        }
    }

    const messaging = await getMessaging();
    for (const row of (deviceTokens ?? [])) {
        try {
            if (row.platform === 'ios') {
                const { ok, expired } = await sendApnsMessage(row.token, msg.title, msg.body, { url, tag });
                if (expired) expiredTokens.push(row.token);
                if (ok) sent++; else failed++;
            } else if (messaging) {
                await messaging.send({
                    token: row.token,
                    notification: { title: msg.title, body: msg.body },
                    data: { url, tag },
                    android: { priority: 'high' },
                });
                sent++;
            }
        } catch (err: any) {
            const code = err?.code ?? err?.errorInfo?.code;
            if (
                code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token'
            ) {
                expiredTokens.push(row.token);
            }
            failed++;
        }
    }

    await Promise.all([
        expiredEndpoints.length > 0
            ? supabaseAdmin.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
            : Promise.resolve(),
        expiredTokens.length > 0
            ? supabaseAdmin.from('device_tokens').delete().in('token', expiredTokens)
            : Promise.resolve(),
    ]);

    return { sent, failed };
}
