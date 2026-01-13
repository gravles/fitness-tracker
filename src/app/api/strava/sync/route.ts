import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncStravaActivities } from '@/lib/strava';

export async function POST(request: Request) {
    try {
        // 1. Verify User & Create Authenticated Client
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        // Create a client that uses the user's token so RLS policies work!
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Perform Sync with authenticated client
        const results = await syncStravaActivities(user.id, supabase);

        return NextResponse.json({ success: true, ...results });

    } catch (error: any) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: error.message || 'Sync Failed' }, { status: 500 });
    }
}
