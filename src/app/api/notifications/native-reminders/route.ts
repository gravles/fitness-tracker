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

/**
 * Save reminder preferences for native Android/iOS users.
 * Stores reminders in device_tokens.reminders so the FCM cron can find them.
 */
export async function PATCH(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { reminders } = await request.json();
        if (!Array.isArray(reminders)) {
            return NextResponse.json({ error: 'reminders must be an array' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        // Update all device tokens for this user (handles multiple devices)
        const { error } = await supabase
            .from('device_tokens')
            .update({ reminders, updated_at: new Date().toISOString() })
            .eq('user_id', userId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Native reminders update error:', error);
        return NextResponse.json({ error: 'Failed to update reminders' }, { status: 500 });
    }
}
