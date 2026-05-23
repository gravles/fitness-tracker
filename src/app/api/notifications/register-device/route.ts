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
 * Register a native device token (FCM for Android, APNs via FCM for iOS).
 * Called by CapacitorProvider on every app launch after push permission is granted.
 * Uses upsert so re-installs / token rotations are handled gracefully.
 */
export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { token, platform } = await request.json();
        if (!token || !['ios', 'android'].includes(platform)) {
            return NextResponse.json(
                { error: 'token and platform (ios|android) required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();
        const { error } = await supabase
            .from('device_tokens')
            .upsert(
                { user_id: userId, token, platform, updated_at: new Date().toISOString() },
                { onConflict: 'user_id, token' }
            );

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Register device error:', error);
        return NextResponse.json({ error: 'Failed to register device' }, { status: 500 });
    }
}

/**
 * Unregister a device token.
 * If a specific token is in the body, removes that one only.
 * With no body, removes all tokens for the user (called on sign-out).
 */
export async function DELETE(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let token: string | undefined;
        try {
            const body = await request.json();
            token = body?.token;
        } catch { /* no body — delete all */ }

        const supabase = getSupabaseAdmin();
        const query = token
            ? supabase.from('device_tokens').delete().eq('user_id', userId).eq('token', token)
            : supabase.from('device_tokens').delete().eq('user_id', userId);

        const { error } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unregister device error:', error);
        return NextResponse.json({ error: 'Failed to unregister device' }, { status: 500 });
    }
}
