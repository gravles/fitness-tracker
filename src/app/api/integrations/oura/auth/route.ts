import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const clientId = process.env.OURA_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'OURA_CLIENT_ID not configured' }, { status: 500 });
    }
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oura/callback`;
    const state = crypto.randomUUID();

    const url = new URL('https://cloud.ouraring.com/oauth/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', 'daily readiness sleep personal');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);

    const response = NextResponse.redirect(url.toString());
    response.cookies.set('oura_oauth_state', state, { httpOnly: true, maxAge: 600 });
    return response;
}
