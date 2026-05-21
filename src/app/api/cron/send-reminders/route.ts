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

// Vercel cron calls this with a secret to prevent abuse
function isAuthorized(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

type ReminderType = 'log' | 'move';

async function sendReminders(reminderType: ReminderType) {
    const supabase = getSupabaseAdmin();
    const nowUTC = new Date();
    // Format current time as HH:MM in UTC
    const currentHour = nowUTC.getUTCHours().toString().padStart(2, '0');
    const currentMinute = nowUTC.getUTCMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;

    const enabledCol = reminderType === 'log' ? 'log_reminder_enabled' : 'move_reminder_enabled';
    const timeCol = reminderType === 'log' ? 'log_reminder_time' : 'move_reminder_time';

    // Fetch subscriptions where reminder is enabled and time matches within this hour
    const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq(enabledCol, true);

    if (error || !subscriptions?.length) return { sent: 0, failed: 0 };

    // Filter to subscriptions whose reminder time is within the current UTC hour
    const [currentH] = currentTime.split(':').map(Number);
    const eligible = subscriptions.filter(sub => {
        const [subH] = (sub[timeCol] as string).split(':').map(Number);
        return subH === currentH;
    });

    const payload = reminderType === 'log'
        ? JSON.stringify({
            title: "Don't forget to log today! 📝",
            body: 'Keep your streak going — log your activity now.',
            url: '/log',
            tag: 'daily-log-reminder',
        })
        : JSON.stringify({
            title: 'Time to move! 💪',
            body: 'Get some exercise in today to stay on track.',
            url: '/log',
            tag: 'daily-move-reminder',
        });

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    await Promise.all(eligible.map(async (sub) => {
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
    }));

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
        await supabase
            .from('push_subscriptions')
            .delete()
            .in('endpoint', expiredEndpoints);
    }

    return { sent, failed };
}

export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const [logResult, moveResult] = await Promise.all([
            sendReminders('log'),
            sendReminders('move'),
        ]);

        return NextResponse.json({
            success: true,
            log: logResult,
            move: moveResult,
        });
    } catch (error) {
        console.error('Cron send-reminders error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
