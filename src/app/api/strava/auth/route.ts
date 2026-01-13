import { NextResponse } from 'next/server';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;


export async function GET(request: Request) {
    if (!STRAVA_CLIENT_ID) {
        return NextResponse.json({ error: 'Strava Client ID not configured' }, { status: 500 });
    }

    // Dynamic Base URL
    const { origin } = new URL(request.url);
    const redirectUri = `${origin}/settings/strava-callback`;
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
