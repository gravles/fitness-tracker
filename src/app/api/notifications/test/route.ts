import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

async function getUserId(request: NextRequest): Promise<string | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.id ?? null;
}

let firebaseMessaging: import('firebase-admin/messaging').Messaging | null = null;

async function getMessaging() {
    if (firebaseMessaging) return firebaseMessaging;
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
    try {
        const { initializeApp, getApps, cert } = await import('firebase-admin/app');
        const { getMessaging: _getMsg } = await import('firebase-admin/messaging');
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

/**
 * POST /api/notifications/test
 * Sends an immediate test push to all registered devices for the authenticated user.
 * Returns a detailed diagnostic report.
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = getSupabaseAdmin();
        const messaging = await getMessaging();

        const diagnostics: Record<string, any> = {
            fcm_configured: !!process.env.FIREBASE_SERVICE_ACCOUNT,
            firebase_admin_ready: !!messaging,
            tokens: [],
            results: [],
        };

        // Fetch device tokens
        const { data: tokens, error: tokensError } = await supabase
            .from('device_tokens')
            .select('token, platform, reminders, updated_at')
            .eq('user_id', userId);

        if (tokensError) throw tokensError;

        diagnostics.tokens = (tokens ?? []).map(t => ({
            platform: t.platform,
            token_prefix: t.token.substring(0, 20) + '...',
            reminders_count: Array.isArray(t.reminders) ? t.reminders.length : 0,
            last_seen: t.updated_at,
        }));

        if (!messaging) {
            return NextResponse.json({
                success: false,
                error: 'FIREBASE_SERVICE_ACCOUNT environment variable is not configured on the server. FCM cannot send notifications.',
                diagnostics,
            });
        }

        if (!tokens?.length) {
            return NextResponse.json({
                success: false,
                error: 'No device tokens registered. Open the app on your Android device first.',
                diagnostics,
            });
        }

        // Send a test push to every token
        let sent = 0;
        let failed = 0;
        const expiredTokens: string[] = [];

        for (const row of tokens) {
            try {
                await messaging.send({
                    token: row.token,
                    notification: {
                        title: '✅ Test notification',
                        body: 'Push notifications are working!',
                    },
                    data: { url: '/settings', tag: 'test' },
                    android: { priority: 'high' },
                });
                diagnostics.results.push({ token_prefix: row.token.substring(0, 20), status: 'sent' });
                sent++;
            } catch (err: any) {
                const code = err?.code ?? err?.errorInfo?.code ?? 'unknown';
                diagnostics.results.push({ token_prefix: row.token.substring(0, 20), status: 'failed', code });
                if (
                    code === 'messaging/registration-token-not-registered' ||
                    code === 'messaging/invalid-registration-token'
                ) {
                    expiredTokens.push(row.token);
                }
                failed++;
            }
        }

        // Clean up stale tokens
        if (expiredTokens.length > 0) {
            await supabase.from('device_tokens').delete().in('token', expiredTokens);
            diagnostics.stale_tokens_removed = expiredTokens.length;
        }

        return NextResponse.json({
            success: sent > 0,
            sent,
            failed,
            diagnostics,
        });
    } catch (error) {
        console.error('Test notification error:', error);
        return NextResponse.json({ error: 'Internal error', detail: String(error) }, { status: 500 });
    }
}

/**
 * GET /api/notifications/test
 * Returns diagnostic info without sending anything — safe to call anytime.
 */
export async function GET(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = getSupabaseAdmin();

        const { data: tokens } = await supabase
            .from('device_tokens')
            .select('platform, reminders, updated_at')
            .eq('user_id', userId);

        return NextResponse.json({
            fcm_configured: !!process.env.FIREBASE_SERVICE_ACCOUNT,
            cron_secret_configured: !!process.env.CRON_SECRET,
            registered_devices: (tokens ?? []).map(t => ({
                platform: t.platform,
                reminders_count: Array.isArray(t.reminders) ? t.reminders.length : 0,
                last_seen: t.updated_at,
            })),
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
