import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Withings measurement type IDs → human-readable keys
const MEAS_TYPES: Record<number, string> = {
    1: 'weight_kg',
    5: 'fat_free_mass_kg',
    6: 'body_fat_pct',
    8: 'fat_mass_kg',
    76: 'muscle_mass_kg',
    77: 'hydration_kg',
    88: 'bone_mass_kg',
    174: 'visceral_fat_index',
    226: 'vascular_age',
};

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

        // Refresh token if expired
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

        // Fetch ALL measurement types for the last 90 days (no meastype filter)
        const startDate = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
        const measRes = await fetch('https://wbsapi.withings.net/measure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'getmeas',
                startdate: String(startDate),
                enddate: String(Math.floor(Date.now() / 1000)),
                access_token: accessToken,
            }),
        });

        const measData = await measRes.json();
        if (measData.status !== 0) {
            return NextResponse.json({ error: `Withings API error: ${measData.error}` }, { status: 500 });
        }

        const groups = measData.body?.measuregrps || [];
        let synced = 0;

        for (const group of groups) {
            const date = new Date(group.date * 1000).toISOString().split('T')[0];

            // Parse all metrics from this weigh-in
            const parsed: Record<string, number> = {};
            for (const m of group.measures || []) {
                const key = MEAS_TYPES[m.type];
                if (key) {
                    parsed[key] = m.value * Math.pow(10, m.unit);
                }
            }

            if (Object.keys(parsed).length === 0) continue;

            // Weight goes into the dedicated column (convert kg → lbs)
            const weightLbs = parsed.weight_kg
                ? Math.round(parsed.weight_kg * 2.20462 * 10) / 10
                : undefined;

            // Everything else goes into measurements JSONB
            const measurements: Record<string, number> = {};
            if (parsed.body_fat_pct !== undefined)    measurements.body_fat_pct    = Math.round(parsed.body_fat_pct * 10) / 10;
            if (parsed.muscle_mass_kg !== undefined)  measurements.muscle_mass_kg  = Math.round(parsed.muscle_mass_kg * 100) / 100;
            if (parsed.fat_free_mass_kg !== undefined) measurements.fat_free_mass_kg = Math.round(parsed.fat_free_mass_kg * 100) / 100;
            if (parsed.fat_mass_kg !== undefined)     measurements.fat_mass_kg     = Math.round(parsed.fat_mass_kg * 100) / 100;
            if (parsed.hydration_kg !== undefined)    measurements.hydration_kg    = Math.round(parsed.hydration_kg * 100) / 100;
            if (parsed.bone_mass_kg !== undefined)    measurements.bone_mass_kg    = Math.round(parsed.bone_mass_kg * 100) / 100;
            if (parsed.visceral_fat_index !== undefined) measurements.visceral_fat_index = parsed.visceral_fat_index;
            if (parsed.vascular_age !== undefined)    measurements.vascular_age    = parsed.vascular_age;

            const upsertData: any = {
                user_id: user.id,
                date,
                source: 'withings',
            };
            if (weightLbs !== undefined) upsertData.weight = weightLbs;
            if (Object.keys(measurements).length > 0) upsertData.measurements = measurements;

            await supabaseAdmin.from('body_metrics').upsert(upsertData, {
                onConflict: 'user_id,date',
            });
            synced++;
        }

        return NextResponse.json({ success: true, synced });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
