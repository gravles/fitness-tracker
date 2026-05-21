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

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { endpoint, keys, logReminderEnabled, moveReminderEnabled, logReminderTime, moveReminderTime } = body;

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert(
                {
                    user_id: userId,
                    endpoint,
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                    log_reminder_enabled: logReminderEnabled ?? true,
                    move_reminder_enabled: moveReminderEnabled ?? true,
                    log_reminder_time: logReminderTime ?? '20:00',
                    move_reminder_time: moveReminderTime ?? '09:00',
                    last_used_at: new Date().toISOString(),
                },
                { onConflict: 'endpoint' }
            );

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Subscribe error:', error);
        return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { logReminderEnabled, moveReminderEnabled, logReminderTime, moveReminderTime } = await request.json();

        const supabase = getSupabaseAdmin();
        const { error } = await supabase
            .from('push_subscriptions')
            .update({
                log_reminder_enabled: logReminderEnabled,
                move_reminder_enabled: moveReminderEnabled,
                log_reminder_time: logReminderTime,
                move_reminder_time: moveReminderTime,
            })
            .eq('user_id', userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update preferences error:', error);
        return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();
        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
    }
}
