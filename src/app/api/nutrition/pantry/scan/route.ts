import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function getUserId(request: NextRequest): Promise<string | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.id ?? null;
}

function stripFences(raw: string): string {
    return raw?.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim() ?? '';
}

const SCHEMA_INSTRUCTIONS = `
For each food item, return:
- name: common food name (e.g. "Chicken Breast", "Brown Rice", "Greek Yogurt")
- category: exactly one of "Protein", "Carbs", "Vegetables", "Dairy", "Fats", "Other"
- prep_time: exactly one of "no-prep" (ready-to-eat/snacks), "quick" (5–15 min like eggs/oats), "standard" (15–30 min like rice/pasta), "extended" (30–60 min like roasts/bakes)
- notes: brief note (e.g. "canned", "low-fat", "pre-cooked") or empty string ""

Return ONLY a valid JSON array, no markdown, no explanation:
[{"name":"...","category":"...","prep_time":"...","notes":"..."}, ...]`;

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { image, mimeType, transcript } = body;

        if (!image && !transcript) {
            return NextResponse.json({ error: 'image or transcript required' }, { status: 400 });
        }

        let messages: Anthropic.Messages.MessageParam[];

        if (image) {
            messages = [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: (mimeType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                            data: image,
                        },
                    },
                    {
                        type: 'text',
                        text: `You are scanning a photo of someone's pantry, fridge, or food items. Identify every distinct food product, ingredient, or item you can see. Include things partially visible. Ignore non-food items.
${SCHEMA_INSTRUCTIONS}`,
                    },
                ],
            }];
        } else {
            messages = [{
                role: 'user',
                content: `Extract every food item from this spoken/typed description of pantry contents. The person may speak casually (e.g. "got some chicken, rice, yogurt..."). List each unique item separately.

"${transcript}"
${SCHEMA_INSTRUCTIONS}`,
            }];
        }

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2000,
            messages,
        });

        const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
        const cleaned = stripFences(rawText);
        const items = JSON.parse(cleaned);

        return NextResponse.json({ items });
    } catch (error) {
        console.error('Pantry scan error:', error);
        return NextResponse.json({ error: 'Failed to scan' }, { status: 500 });
    }
}
