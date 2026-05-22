import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function stripFences(text: string): string {
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { program, message } = await req.json();
        if (!program || !message) return NextResponse.json({ error: 'program and message required' }, { status: 400 });

        // Use streaming — required by the SDK when max_tokens is large enough
        // that the request could take >10 min. We collect server-side and return
        // a regular JSON response to the client.
        const stream = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 32000,
            system: `You are editing a 12-week training program for a user. The program is stored as JSON with a "weeks" array. Each week has a "days" array. Each non-rest day has an "exercises" array with {name, sets, reps, load_pct} objects.

When making edits:
- Apply the requested change consistently across ALL affected weeks/days (e.g. if swapping an exercise, swap it in every week)
- Preserve the periodisation structure (load_pct and volume_modifier progressions)
- Keep the same number of exercises per day
- Maintain the same sets/reps/load_pct pattern
- Only return the modified JSON — no markdown, no explanation

IMPORTANT: You must return the COMPLETE program JSON — all 12 weeks, every day, every exercise. Do not truncate or summarise any part of the output.

Return ONLY valid JSON in exactly the same structure as the input program.`,
            messages: [{
                role: 'user',
                content: `Program JSON:\n${JSON.stringify(program)}\n\nRequested change: ${message}`
            }],
        });

        const response = await stream.finalMessage();
        const raw = (response.content[0] as Anthropic.TextBlock).text;
        const cleaned = stripFences(raw);

        // Guard against truncated responses
        if (response.stop_reason === 'max_tokens') {
            return NextResponse.json(
                { error: 'The program is too large to edit in one pass. Try a more targeted change (e.g. one exercise or one week at a time).' },
                { status: 422 }
            );
        }

        let modified: any;
        try {
            modified = JSON.parse(cleaned);
        } catch {
            const salvaged = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            try {
                modified = JSON.parse(salvaged);
            } catch {
                return NextResponse.json(
                    { error: 'The AI returned malformed JSON. Please try again or rephrase your request.' },
                    { status: 422 }
                );
            }
        }

        return NextResponse.json({ program: modified });
    } catch (error: any) {
        console.error('Edit program error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
