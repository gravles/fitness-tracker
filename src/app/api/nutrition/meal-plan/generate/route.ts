import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

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

const PREP_TIME_LABELS: Record<string, string> = {
    'no-prep': 'under 5 minutes (ready-to-eat or minimal assembly)',
    'quick': '5–15 minutes',
    'standard': '15–30 minutes',
    'extended': '30–60 minutes',
};

export async function POST(request: NextRequest) {
    try {
        const userId = await getUserId(request);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { dates, prefs, targetProtein, targetCalories, pantryItems, workoutDates } = await request.json();

        if (!dates?.length || !pantryItems?.length) {
            return NextResponse.json({ error: 'dates and pantryItems are required' }, { status: 400 });
        }

        // Group pantry items by category for the prompt
        const grouped: Record<string, string[]> = {};
        for (const item of pantryItems) {
            if (!grouped[item.category]) grouped[item.category] = [];
            const prepLabel = PREP_TIME_LABELS[item.prep_time] || item.prep_time;
            grouped[item.category].push(`${item.name} (prep: ${prepLabel}${item.notes ? `, note: ${item.notes}` : ''})`);
        }
        const pantryText = Object.entries(grouped)
            .map(([cat, items]) => `${cat}: ${items.join(', ')}`)
            .join('\n');

        const prompt = `You are a sports nutritionist creating a practical meal plan.

USER'S PANTRY (only use these ingredients):
${pantryText}

DAILY TARGETS:
- Protein: ${targetProtein || 150}g
- Calories: ${targetCalories || 2500} kcal

PREP TIME LIMITS:
- Breakfast: max ${prefs?.breakfast_prep_min || 10} minutes
- Lunch: max ${prefs?.lunch_prep_min || 15} minutes
- Dinner: max ${prefs?.dinner_prep_min || 30} minutes
- Snack: no-prep only

${prefs?.dietary_notes ? `DIETARY NOTES: ${prefs.dietary_notes}` : ''}

WORKOUT DAYS (needs more carbs +15%): ${workoutDates?.join(', ') || 'none specified'}

Generate a meal plan for these dates: ${dates.join(', ')}

RULES:
- Use ONLY pantry items listed above
- Respect prep time limits strictly
- Hit protein target within ±15g per day
- Hit calorie target within ±200 kcal per day
- Each meal must be realistic and satisfying
- Include a snack only if needed to hit targets
- On workout days, add 15% more carbs (extra portion of carb items)

Return ONLY valid JSON, no markdown, in this exact format:
{
  "YYYY-MM-DD": {
    "breakfast": {
      "name": "Meal name",
      "prep_time_min": 5,
      "ingredients": ["Ingredient with portion, e.g. '2 eggs'", "..."],
      "instructions": "One sentence. Keep it simple.",
      "macros": { "calories": 450, "protein": 35, "carbs": 40, "fat": 12 }
    },
    "lunch": { same structure },
    "dinner": { same structure },
    "snack": { same structure or null }
  }
}`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }],
        });

        const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
        const cleaned = stripFences(rawText);
        const meals = JSON.parse(cleaned);

        return NextResponse.json({ meals });
    } catch (error) {
        console.error('Meal plan generation error:', error);
        return NextResponse.json({ error: 'Failed to generate meal plan' }, { status: 500 });
    }
}
