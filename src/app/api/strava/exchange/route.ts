import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exchangeToken } from '@/lib/strava';

export async function POST(request: Request) {
    try {
        const { code } = await request.json();

        if (!code) {
            return NextResponse.json({ error: 'Code is required' }, { status: 400 });
        }

        // 1. Verify Authentication
        // Since this is called from the client, we should match the user.
        // We'll trust the client side supabase passed the auth header, 
        // BUT `supabase-js` client in `lib/supabase` is likely anon.
        // We need to verify the user from the headers.

        // HOWEVER, standard `createClient` doesn't automatically parse request headers in Next.js App Router API routes 
        // without `createRouteHandlerClient` from `@supabase/ssr`.
        // Since we don't have that, we'll try to get the user from the `Authorization` header manually if possible or use `supabase.auth.getUser(token)`.

        // Let's assume the client sends the access token in Authorization: Bearer <token>
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Exchange Code for Strava Tokens
        const tokenData = await exchangeToken(code);

        // 3. Save to Database
        // We use the `user.id` we just verified
        const { error: dbError } = await supabase
            .from('integrations')
            .upsert({
                user_id: user.id,
                provider: 'strava',
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: tokenData.expires_at,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,provider' });

        if (dbError) {
            console.error('DB Error:', dbError);
            throw new Error('Failed to save integration');
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Exchange error:', error);
        return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
    }
}
