import { NextRequest, NextResponse } from 'next/server';

// Withings OAuth — redirects user to Withings consent screen
export async function GET(req: NextRequest) {
    const clientId = process.env.WITHINGS_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'WITHINGS_CLIENT_ID not configured' }, { status: 500 });
    }
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/withings/callback`;
    const scope = 'user.metrics';
    const state = crypto.randomUUID();

    const url = new URL('https://account.withings.com/oauth2_user/authorize2');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', scope);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);

    const response = NextResponse.redirect(url.toString());
    response.cookies.set('withings_oauth_state', state, { httpOnly: true, maxAge: 600 });
    return response;
}
