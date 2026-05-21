import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const savedState = req.cookies.get('oura_oauth_state')?.value;

    if (!code || state !== savedState) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=oura_auth_failed`);
    }

    const tokenRes = await fetch('https://api.ouraring.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.OURA_CLIENT_ID!,
            client_secret: process.env.OURA_CLIENT_SECRET!,
            redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oura/callback`,
            code,
        }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=oura_token_failed`);
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const response = NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?oura_access=${access_token}&oura_refresh=${refresh_token || ''}&oura_expires=${Date.now() + (expires_in || 86400) * 1000}&connected=oura`
    );
    response.cookies.delete('oura_oauth_state');
    return response;
}
