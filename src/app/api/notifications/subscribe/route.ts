import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Create Supabase client (server-side)
function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

export async function POST(request: NextRequest) {
    try {
        const subscription = await request.json();

        // Get user from session (you'd typically validate the session here)
        const supabase = getSupabaseClient();

        // For now, get user_id from the authorization header or cookie
        const authHeader = request.headers.get('authorization');
        // In production, you'd properly authenticate here

        const { endpoint, keys } = subscription;

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return NextResponse.json(
                { error: 'Invalid subscription data' },
                { status: 400 }
            );
        }

        // Upsert subscription (update if endpoint exists, insert if new)
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert(
                {
                    endpoint,
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                    last_used_at: new Date().toISOString(),
                },
                {
                    onConflict: 'endpoint',
                }
            );

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Subscribe error:', error);
        return NextResponse.json(
            { error: 'Failed to save subscription' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = getSupabaseClient();

        // Get the subscription endpoint from the request
        const { endpoint } = await request.json();

        if (endpoint) {
            const { error } = await supabase
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', endpoint);

            if (error) throw error;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Unsubscribe error:', error);
        return NextResponse.json(
            { error: 'Failed to delete subscription' },
            { status: 500 }
        );
    }
}
