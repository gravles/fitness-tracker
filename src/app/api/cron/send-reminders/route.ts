import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
);

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

function isAuthorized(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

interface Reminder {
    id: string;
    label: string;
    time: string;   // "HH:MM"
    enabled: boolean;
    body?: string;
}

export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = getSupabaseAdmin();
        const nowUTC = new Date();
        const currentHour = nowUTC.getUTCHours();

        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('*');

        if (error || !subscriptions?.length) {
            return NextResponse.json({ success: true, sent: 0, failed: 0 });
        }

        let sent = 0;
        let failed = 0;
        const expiredEndpoints: string[] = [];

        await Promise.all(subscriptions.map(async (sub) => {
            const reminders: Reminder[] = sub.reminders || [];
            const due = reminders.filter(r => {
                if (!r.enabled) return false;
                const [h] = r.time.split(':').map(Number);
                return h === currentHour;
            });

            for (const reminder of due) {
                const payload = JSON.stringify({
                    title: reminder.label,
                    body: reminder.body || 'Tap to open your fitness tracker.',
                    url: '/log',
                    tag: `reminder-${reminder.id}`,
                });

                try {
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        payload,
                        { TTL: 3600 }
                    );
                    sent++;
                } catch (err: any) {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        expiredEndpoints.push(sub.endpoint);
                    }
                    failed++;
                }
            }
        }));

        // Clean up expired subscriptions
        if (expiredEndpoints.length > 0) {
            await supabase
                .from('push_subscriptions')
                .delete()
                .in('endpoint', expiredEndpoints);
        }

        return NextResponse.json({ success: true, sent, failed });
    } catch (error) {
        console.error('Cron send-reminders error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
