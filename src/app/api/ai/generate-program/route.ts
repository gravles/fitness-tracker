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

        const { goal, daysPerWeek = 4, equipment = [], notes = '' } = await req.json();

        const GOALS: Record<string, string> = {
            strength: 'maximal strength (low reps, heavy loads, compound lifts)',
            hypertrophy: 'muscle hypertrophy (moderate reps 8-12, volume-focused)',
            endurance: 'muscular endurance and conditioning (high reps, circuits)',
            athletic: 'athletic performance (power, speed, agility)',
        };

        const system = `You are an elite strength & conditioning coach. Generate a complete 12-week training program as JSON.

The program must follow proper periodisation:
- Weeks 1-4: Accumulation (build volume, moderate intensity)
- Weeks 5-8: Intensification (reduce volume, increase intensity)
- Weeks 9-11: Realisation (peak intensity, minimal volume)
- Week 12: Deload (50% volume, same movements, full recovery)

Rules:
- ${daysPerWeek} training days per week
- Available equipment: ${equipment.length > 0 ? equipment.join(', ') : 'standard gym (barbells, dumbbells, cables, machines)'}
- Goal: ${GOALS[goal] || goal}
- Additional notes: ${notes || 'none'}

Return ONLY valid JSON, no markdown, in exactly this structure:
{
  "name": "12-Week ${goal.charAt(0).toUpperCase() + goal.slice(1)} Program",
  "goal": "${goal}",
  "duration_weeks": 12,
  "phases": [
    { "name": "Accumulation", "weeks": "1-4", "description": "Build work capacity and technique" },
    { "name": "Intensification", "weeks": "5-8", "description": "Increase load and intensity" },
    { "name": "Realisation", "weeks": "9-11", "description": "Peak performance" },
    { "name": "Deload", "weeks": "12-12", "description": "Recovery and adaptation" }
  ],
  "weeks": [
    {
      "week": 1,
      "phase": "Accumulation",
      "volume_modifier": 1.0,
      "days": [
        {
          "day": 1,
          "label": "Upper A",
          "exercises": [
            { "name": "Bench Press", "sets": 4, "reps": "8-10", "load_pct": 70 },
            { "name": "Barbell Row", "sets": 4, "reps": "8-10", "load_pct": 70 }
          ]
        },
        { "day": 2, "label": "Rest", "exercises": [] }
      ]
    }
  ]
}

Include all 12 weeks. Each week has ${daysPerWeek} training days and ${7 - daysPerWeek} rest days. Progress loads by 2.5-5% each week within each phase. Week 12 deload should have volume_modifier: 0.5.`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            system,
            messages: [{ role: 'user', content: `Generate my 12-week ${goal} program with ${daysPerWeek} days/week.` }],
        });

        const content = stripFences((response.content[0] as Anthropic.TextBlock).text);
        const program = JSON.parse(content);

        return NextResponse.json(program);
    } catch (error: any) {
        console.error('Program generation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
