import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subDays, format } from 'date-fns';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: integration } = await supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('user_id', user.id)
            .eq('provider', 'oura')
            .maybeSingle();

        if (!integration?.access_token) {
            return NextResponse.json({ error: 'Oura not connected' }, { status: 400 });
        }

        const startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const headers = { 'Authorization': `Bearer ${integration.access_token}` };

        // Fetch readiness + sleep in parallel
        const [readinessRes, sleepRes] = await Promise.all([
            fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`, { headers }),
            fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`, { headers }),
        ]);

        const readinessData = await readinessRes.json();
        const sleepData = await sleepRes.json();

        // Store readiness metadata in daily_logs energy/sleep fields
        let synced = 0;
        for (const r of readinessData.data || []) {
            const date = r.day;
            // Map Oura readiness score (0-100) to our 1-5 energy scale
            const energyLevel = Math.max(1, Math.min(5, Math.round(r.score / 20)));
            await supabaseAdmin.from('daily_logs').upsert({
                user_id: user.id,
                date,
                energy_level: energyLevel,
            }, { onConflict: 'user_id,date', ignoreDuplicates: false });
            synced++;
        }

        // Store sleep quality from sleep data
        for (const s of sleepData.data || []) {
            const date = s.day;
            // Map Oura sleep score (0-100) to 1-5
            const sleepQuality = s.score ? Math.max(1, Math.min(5, Math.round(s.score / 20))) : null;
            if (sleepQuality) {
                await supabaseAdmin.from('daily_logs').upsert({
                    user_id: user.id,
                    date,
                    sleep_quality: sleepQuality,
                }, { onConflict: 'user_id,date', ignoreDuplicates: false });
            }
        }

        return NextResponse.json({ success: true, synced });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
