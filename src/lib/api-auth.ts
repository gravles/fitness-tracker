import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';

function sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Authenticate an API request from either the web app (Supabase JWT) or an
 * external client such as the Claude connector or the watch app (ftk_ API key
 * from mcp_api_keys). Returns the user id, or null if unauthenticated.
 */
export async function authenticateRequest(req: NextRequest): Promise<string | null> {
    const auth = req.headers.get('authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7).trim();
    if (!token) return null;

    // Supabase JWTs contain dots; API keys (ftk_ + 40 hex chars) never do
    if (token.includes('.')) {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user) return null;
        return user.id;
    }

    const { data } = await supabaseAdmin
        .from('mcp_api_keys')
        .select('user_id')
        .eq('key_hash', sha256(token))
        .maybeSingle();
    if (!data?.user_id) return null;

    // Fire-and-forget: record last used
    supabaseAdmin
        .from('mcp_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('key_hash', sha256(token))
        .then(() => {});

    return data.user_id as string;
}
