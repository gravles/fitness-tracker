import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exchangeToken } from '@/lib/strava';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Exchange Code for Strava Tokens
        const tokenData = await exchangeToken(code);

        // 3. Save to Database using admin client to bypass RLS
        const { error: dbError } = await supabaseAdmin
            .from('integrations')
            .upsert({
                user_id: user.id,
                provider: 'strava',
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                token_expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
                updated_at: new Date().toISOString(),
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
