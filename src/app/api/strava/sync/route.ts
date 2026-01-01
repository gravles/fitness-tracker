import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { syncStravaActivities } from '@/lib/strava';

export async function POST(request: Request) {
    try {
        // 1. Verify User
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Perform Sync
        const results = await syncStravaActivities(user.id);

        return NextResponse.json({ success: true, ...results });

    } catch (error: any) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: error.message || 'Sync Failed' }, { status: 500 });
    }
}
