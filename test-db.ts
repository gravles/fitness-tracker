import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testUpsert() {
    console.log("Testing direct upsert to bypass RLS UI obfuscation...");

    // Attempting an upsert for user 'fc7c274b-ab46-4cb0-a548-c8d3258c7e99' or whatever local account auth maps to
    const dateStr = new Date().toISOString().split('T')[0];

    try {
        const { data, error } = await supabase
            .from('daily_logs')
            .upsert({
                date: dateStr,
                user_id: 'db2a74c4-72de-40ab-baad-0a56e021fac5', // Just throwing a UUID to see if it complains about format or UUID or jsonb
                food_items: [{ name: "Test Banana", calories: 100 }],
                nutrition_logged: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,date' })
            .select()
            .single();

        console.log("Result:", data);
        console.log("Error:", error);
    } catch (e) {
        console.error("Catch Exception:", e);
    }
}

testUpsert();
