import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshWithingsToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
    const res = await fetch('https://wbsapi.withings.net/v2/oauth2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            action: 'requesttoken',
            grant_type: 'refresh_token',
            client_id: process.env.WITHINGS_CLIENT_ID!,
            client_secret: process.env.WITHINGS_CLIENT_SECRET!,
            refresh_token: refreshToken,
        }),
    });
    const data = await res.json();
    if (data.status !== 0) return null;
    return data.body;
}

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get stored tokens
        const { data: integration } = await supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('user_id', user.id)
            .eq('provider', 'withings')
            .maybeSingle();

        if (!integration?.access_token) {
            return NextResponse.json({ error: 'Withings not connected' }, { status: 400 });
        }

        let accessToken = integration.access_token;

        // Refresh if expired
        if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
            const refreshed = await refreshWithingsToken(integration.refresh_token!);
            if (!refreshed) return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 });
            accessToken = refreshed.access_token;
            await supabaseAdmin.from('integrations').update({
                access_token: refreshed.access_token,
                refresh_token: refreshed.refresh_token,
                token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            }).eq('user_id', user.id).eq('provider', 'withings');
        }

        // Fetch measurements (type 1 = weight in kg)
        const startDate = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
        const measRes = await fetch('https://wbsapi.withings.net/measure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'getmeas',
                meastype: '1',
                startdate: String(startDate),
                enddate: String(Math.floor(Date.now() / 1000)),
                access_token: accessToken,
            }),
        });
        const measData = await measRes.json();
        if (measData.status !== 0) return NextResponse.json({ error: 'Withings API error' }, { status: 500 });

        const groups = measData.body?.measuregrps || [];
        let synced = 0;

        for (const group of groups) {
            const weightMeas = group.measures?.find((m: any) => m.type === 1);
            if (!weightMeas) continue;

            const weightKg = weightMeas.value * Math.pow(10, weightMeas.unit);
            const weightLbs = Math.round(weightKg * 2.20462 * 10) / 10;
            const date = new Date(group.date * 1000).toISOString().split('T')[0];

            await supabaseAdmin.from('body_metrics').upsert({
                user_id: user.id,
                date,
                weight: weightLbs,
                source: 'withings',
            }, { onConflict: 'user_id,date' });
            synced++;
        }

        return NextResponse.json({ success: true, synced });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
