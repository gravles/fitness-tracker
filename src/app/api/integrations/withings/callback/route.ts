import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const savedState = req.cookies.get('withings_oauth_state')?.value;

    if (!code || state !== savedState) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=withings_auth_failed`);
    }

    const clientId = process.env.WITHINGS_CLIENT_ID!;
    const clientSecret = process.env.WITHINGS_CLIENT_SECRET!;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/withings/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://wbsapi.withings.net/v2/oauth2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            action: 'requesttoken',
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
        }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.status !== 0) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=withings_token_failed`);
    }

    const { access_token, refresh_token, expires_in, userid } = tokenData.body;

    // Get authenticated Supabase user from cookie
    const authHeader = req.headers.get('cookie') || '';
    // Use service role to get user — for simplicity, store in session via cookie passed state
    // In production you'd encrypt state with user_id. For now redirect to a page that calls the save endpoint.
    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?withings_code=${code}&withings_access=${access_token}&withings_refresh=${refresh_token}&withings_expires=${Date.now() + expires_in * 1000}&withings_user=${userid}&connected=withings`);
    response.cookies.delete('withings_oauth_state');
    return response;
}
