import { supabase } from './supabase';
import { addWorkout, Workout } from './api';
import { addDays, subDays } from 'date-fns';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

export interface StravaToken {
    access_token: string;
    refresh_token: string;
    expires_at: number;
}

export interface StravaActivity {
    id: number;
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    total_elevation_gain: number;
    type: string;
    sport_type: string;
    start_date: string;
    start_date_local: string;
    timezone: string;
    average_speed: number;
    max_speed: number;
    average_heartrate?: number;
    max_heartrate?: number;
}

/**
 * Exchanges the temporary authorization code for access/refresh tokens
 */
export async function exchangeToken(code: string): Promise<StravaToken> {
    const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to exchange Strava token');
    }

    const data = await response.json();
    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
    };
}

/**
 * Refreshes the access token if expired
 */
export async function getValidToken(userId: string): Promise<string | null> {
    // 1. Get current token from DB
    const { data: integration } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'strava')
        .single();

    if (!integration) return null;

    // 2. Check if expired (or expiring soon/within 5 mins)
    const now = Math.floor(Date.now() / 1000);
    if (integration.expires_at > now + 300) {
        return integration.access_token;
    }

    // 3. Refresh if needed
    console.log('Refreshing Strava Token...');
    const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: integration.refresh_token,
        }),
    });

    if (!response.ok) {
        console.error('Failed to refresh token', await response.text());
        return null; // Force re-auth
    }

    const data = await response.json();

    // 4. Update DB
    await supabase
        .from('integrations')
        .update({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at,
            updated_at: new Date().toISOString()
        })
        .eq('id', integration.id);

    return data.access_token;
}

/**
 * Fetches activities from Strava
 */
export async function fetchStravaActivities(accessToken: string, after?: number, before?: number) {
    const url = new URL('https://www.strava.com/api/v3/athlete/activities');
    if (after) url.searchParams.append('after', after.toString());
    if (before) url.searchParams.append('before', before.toString());
    url.searchParams.append('per_page', '30');

    const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch activities');
    }

    return await response.json() as StravaActivity[];
}

/**
 * Syncs recent activities to our workouts table
 */
export async function syncStravaActivities(userId: string) {
    const token = await getValidToken(userId);
    if (!token) throw new Error('No valid strava connection');

    // Sync last 7 days by default
    const after = Math.floor(subDays(new Date(), 7).getTime() / 1000);
    const activities = await fetchStravaActivities(token, after);

    let syncedCount = 0;

    for (const activity of activities) {
        // Check if already exists using external_id
        // We'll trust the database generic query for now, but ideally we'd add external_id to getWorkouts or a separate check
        // Since we don't have a specific `getWorkoutsByExternalId`, we'll assume we can't easily check one-by-one efficiently without a new query
        // But `addWorkout` generates a new ID. We updated the schema to include `external_id`.
        // Let's check first.

        const { data: existing } = await supabase
            .from('workouts')
            .select('id')
            .eq('user_id', userId)
            .eq('external_id', activity.id.toString())
            .single();

        if (existing) continue;

        // Map Strava type to our simplified types and intensity
        // This is a naive mapping
        let intensity: 'Light' | 'Moderate' | 'Hard' = 'Moderate';
        if (activity.average_heartrate) {
            if (activity.average_heartrate > 150) intensity = 'Hard';
            else if (activity.average_heartrate < 120) intensity = 'Light';
        }

        const dateStr = activity.start_date_local.split('T')[0];

        // Add to DB
        await supabase.from('workouts').insert({
            user_id: userId,
            date: dateStr,
            activity_type: activity.type, // Map Strava specific names e.g. "Run" -> "Running" if needed, but "Run" is fine
            duration: Math.round(activity.moving_time / 60),
            intensity: intensity,
            notes: `Imported from Strava: ${activity.name}`,
            external_id: activity.id.toString(),
            source: 'strava'
        });
        syncedCount++;
    }

    return syncedCount;
}
