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

// Expand compact AI output → full ProgramWeek[] the frontend expects
function expandProgram(compact: any) {
    const templates: Record<string, any[]> = {};
    for (const t of compact.day_templates || []) {
        templates[t.label] = t.exercises || [];
    }

    const weeks = (compact.weeks || []).map((w: any) => {
        const schedule: string[] = w.schedule || [];
        const isDeload = w.volume_modifier <= 0.5;

        const days = schedule.map((label: string, idx: number) => {
            const isRest = label === 'Rest' || label === 'rest';
            const baseExercises = isRest ? [] : (templates[label] || []);

            const exercises = baseExercises.map((ex: any) => ({
                name: ex.name,
                sets: isDeload ? Math.max(1, Math.ceil(ex.sets * 0.5)) : ex.sets,
                reps: ex.reps,
                load_pct: w.load_pct ?? ex.load_pct ?? 70,
            }));

            return { day: idx + 1, label, exercises };
        });

        return {
            week: w.week,
            phase: w.phase,
            volume_modifier: w.volume_modifier,
            days,
        };
    });

    return {
        name: compact.name,
        goal: compact.goal,
        duration_weeks: compact.duration_weeks,
        phases: compact.phases,
        weeks,
    };
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
            strength:    'maximal strength (low reps 3-6, heavy loads, compound lifts)',
            hypertrophy: 'muscle hypertrophy (moderate reps 8-12, high volume)',
            endurance:   'muscular endurance and conditioning (high reps 15-20, circuits)',
            athletic:    'athletic performance (power, speed, agility, explosive movements)',
        };

        const equipmentList = equipment.length > 0
            ? equipment.join(', ')
            : 'standard gym (barbells, dumbbells, cables, machines)';

        const system = `You are an elite strength & conditioning coach. Generate a compact 12-week training program as JSON.

Periodisation:
- Weeks 1-4: Accumulation (build volume, load_pct 65-72%)
- Weeks 5-8: Intensification (reduce volume, load_pct 73-82%)
- Weeks 9-11: Realisation (peak intensity, load_pct 83-92%)
- Week 12: Deload (volume_modifier: 0.5, load_pct 55%)

Rules:
- ${daysPerWeek} training days per week (rest of 7 days are "Rest")
- Equipment available: ${equipmentList}
- ALWAYS include bodyweight movements (push-ups, pull-ups, dips, lunges, bodyweight squats) as primary or accessory exercises alongside equipment-based lifts
- Goal: ${GOALS[goal] || goal}
- Notes: ${notes || 'none'}
- Progress load_pct by 2-3% per week within each phase
- Deload week: volume_modifier 0.5, same exercises

Return ONLY valid compact JSON — no markdown, no prose:
{
  "name": "12-Week ${goal.charAt(0).toUpperCase() + goal.slice(1)} Program",
  "goal": "${goal}",
  "duration_weeks": 12,
  "phases": [
    { "name": "Accumulation",    "weeks": "1-4",   "description": "Build work capacity" },
    { "name": "Intensification", "weeks": "5-8",   "description": "Increase load and intensity" },
    { "name": "Realisation",     "weeks": "9-11",  "description": "Peak performance" },
    { "name": "Deload",          "weeks": "12-12", "description": "Recovery and adaptation" }
  ],
  "day_templates": [
    {
      "label": "Upper A",
      "exercises": [
        { "name": "Bench Press",  "sets": 4, "reps": "8-10" },
        { "name": "Barbell Row",  "sets": 4, "reps": "8-10" },
        { "name": "Push-ups",     "sets": 3, "reps": "12-15" },
        { "name": "Pull-ups",     "sets": 3, "reps": "6-10" },
        { "name": "Lateral Raise","sets": 3, "reps": "12-15" }
      ]
    }
  ],
  "weeks": [
    { "week": 1, "phase": "Accumulation", "volume_modifier": 1.0, "load_pct": 65,
      "schedule": ["Upper A", "Rest", "Lower A", "Rest", "Upper B", "Lower B", "Rest"] },
    { "week": 12, "phase": "Deload", "volume_modifier": 0.5, "load_pct": 55,
      "schedule": ["Upper A", "Rest", "Lower A", "Rest", "Upper B", "Rest", "Rest"] }
  ]
}

Provide ${daysPerWeek} distinct day_templates (e.g. Upper A/B, Lower A/B, Full Body A/B, Push/Pull/Legs). Include all 12 weeks in the "weeks" array.`;

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            system,
            messages: [{ role: 'user', content: `Generate my 12-week ${goal} program: ${daysPerWeek} days/week, equipment: ${equipmentList}.` }],
        });

        const rawText = (response.content[0] as Anthropic.TextBlock).text;
        const cleaned = stripFences(rawText);

        let compact: any;
        try {
            compact = JSON.parse(cleaned);
        } catch {
            // Sometimes the model appends a trailing comma or comment — try to salvage
            const salvaged = cleaned
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']')
                .replace(/\/\/[^\n]*/g, '');
            compact = JSON.parse(salvaged);
        }

        const program = expandProgram(compact);
        return NextResponse.json(program);

    } catch (error: any) {
        console.error('Program generation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
