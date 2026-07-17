import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and Key must be defined in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/** Authorization header carrying the current session's JWT, for calling our own API routes. */
export async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token ?? ''}` };
}
