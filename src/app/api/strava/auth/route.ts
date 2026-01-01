import { NextResponse } from 'next/server';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function GET() {
    if (!STRAVA_CLIENT_ID) {
        return NextResponse.json({ error: 'Strava Client ID not configured' }, { status: 500 });
    }

    const redirectUri = `${BASE_URL}/settings/strava-callback`;
    const scope = 'read,activity:read_all'; // We need read_all to get private activities if user wants

    // Construct Strava Auth URL
    const params = new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirectUri,
        approval_prompt: 'force',
        scope: scope,
    });

    const stravaUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;

    return NextResponse.redirect(stravaUrl);
}
