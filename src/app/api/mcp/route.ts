import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { format, subDays, addDays } from 'date-fns';
import { computeReadiness } from '@/lib/readiness';

export const maxDuration = 60;

// ─── CORS ────────────────────────────────────────────────────────────────────

function corsHeaders(): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// ─── TOOL DEFINITIONS ────────────────────────────────────────────────────────

// Extensible by editing this array alone — `slot` is a free-text DB column,
// not a CHECK constraint, so adding a new slot here needs no migration.
const MEAL_SLOTS = ['break_fast', 'lunch', 'snack', 'dinner', 'closer'] as const;

const TOOLS = [
    {
        name: 'get_daily_logs',
        description:
            'Get daily health & fitness logs. Includes nutrition (calories, protein, carbs, fat, individual food items), sleep quality (1-5), energy level (1-5), alcohol intake, workout completion, and daily notes.',
        inputSchema: {
            type: 'object',
            properties: {
                start_date: { type: 'string', description: 'Start date YYYY-MM-DD. Defaults to 7 days ago.' },
                end_date:   { type: 'string', description: 'End date YYYY-MM-DD. Defaults to today.' },
            },
        },
    },
    {
        name: 'get_workouts',
        description:
            'Get workout sessions. Cardio/manual workouts include type, duration, intensity, calories. Strength sessions include exercises with all sets, reps, and weights.',
        inputSchema: {
            type: 'object',
            properties: {
                start_date: { type: 'string', description: 'Start date YYYY-MM-DD. Defaults to 30 days ago.' },
                end_date:   { type: 'string', description: 'End date YYYY-MM-DD. Defaults to today.' },
            },
        },
    },
    {
        name: 'get_body_metrics',
        description: 'Get bodyweight measurements and body measurement history.',
        inputSchema: {
            type: 'object',
            properties: {
                days: { type: 'number', description: 'Number of days to look back. Defaults to 90.' },
            },
        },
    },
    {
        name: 'get_user_profile',
        description:
            'Get user profile: fitness goal, targets (calories, protein, goal weight), current level, XP, and available home equipment.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'get_readiness',
        description:
            "Today's readiness score (0-100) with label (primed | ready | steady | recovery), a training " +
            'recommendation, and the contributing components (sleep quality, yesterday\'s energy, alcohol, ' +
            'acute-vs-chronic training load). Computed from logged data — no wearable required. ' +
            'Example: {} (no arguments).',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'log_food',
        description:
            "Add a food item to the user's daily nutrition log. " +
            'Pass planned_meal_id (from get_meal_plan) to log against a planned meal — its macros are used as defaults and any of name/calories/protein/carbs/fat you also pass override just that field with what was actually eaten; the planned entry is marked logged. ' +
            'Without planned_meal_id, name and calories are required. Defaults: date = today. ' +
            'Example (ad-hoc): {"name": "Greek yogurt", "calories": 150, "protein": 20}. ' +
            'Example (against a plan, ate less than planned): {"planned_meal_id": "abc-123", "calories": 380}.',
        inputSchema: {
            type: 'object',
            properties: {
                name:             { type: 'string', description: 'Food or meal name. Required unless planned_meal_id is given.' },
                calories:         { type: 'number', description: 'Calories (kcal). Required unless planned_meal_id is given.' },
                protein:          { type: 'number', description: 'Protein in grams' },
                carbs:            { type: 'number', description: 'Carbohydrates in grams' },
                fat:              { type: 'number', description: 'Fat in grams' },
                date:             { type: 'string', description: 'Date YYYY-MM-DD. Defaults to today, or the planned meal\'s date if planned_meal_id is given.' },
                planned_meal_id:  { type: 'string', description: 'Entry id from get_meal_plan. Copies its macros as defaults and marks it logged.' },
            },
        },
    },
    {
        name: 'log_workout',
        description:
            'Log a completed workout session (cardio or strength). For strength, pass exercises with the actual sets performed. ' +
            'If a workout was scheduled for that day, logging automatically marks the scheduled entry completed — pass scheduled_workout_id to target a specific entry, otherwise the first planned entry on that date is matched. ' +
            'Defaults: date = today, duration_mins = 45, intensity = Moderate. ' +
            'Example (strength): {"activity_type": "Strength Training", "duration_mins": 60, "intensity": "Hard", "exercises": [{"exercise_name": "Bench Press", "sets": [{"reps": 8, "weight_lbs": 155}, {"reps": 8, "weight_lbs": 155}]}]}. ' +
            'Example (cardio): {"activity_type": "Running", "duration_mins": 30, "intensity": "Moderate"}.',
        inputSchema: {
            type: 'object',
            required: ['activity_type'],
            properties: {
                activity_type: { type: 'string', description: 'e.g. Running, Cycling, Swimming, Strength Training' },
                duration_mins: { type: 'number', description: 'Duration in minutes. Defaults to 45.' },
                intensity:     { type: 'string', enum: ['Light', 'Moderate', 'Hard'], description: 'Defaults to Moderate.' },
                calories:      { type: 'number', description: 'Estimated calories burned (optional)' },
                average_heartrate: { type: 'number', description: 'Average heart rate (bpm) over the session, e.g. from a watch (optional)' },
                max_heartrate:     { type: 'number', description: 'Max heart rate (bpm) during the session (optional)' },
                notes:         { type: 'string', description: 'Optional notes' },
                date:          { type: 'string', description: 'Date YYYY-MM-DD. Defaults to today.' },
                exercises: {
                    type: 'array',
                    description: 'Strength exercises actually performed, in order.',
                    items: {
                        type: 'object',
                        required: ['exercise_name', 'sets'],
                        properties: {
                            exercise_name: { type: 'string' },
                            sets: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    required: ['reps'],
                                    properties: {
                                        reps:       { type: 'number' },
                                        weight_lbs: { type: 'number', description: 'Weight used. Omit for bodyweight.' },
                                    },
                                },
                            },
                        },
                    },
                },
                scheduled_workout_id: {
                    type: 'string',
                    description: 'ID of the scheduled entry this session fulfils (from get_schedule). If omitted, the first planned entry on the same date is marked completed.',
                },
            },
        },
    },
    {
        name: 'save_workout_template',
        description:
            'Create or update a named, reusable workout template. Upserts by name (case-insensitive): saving "Upper A" twice updates the existing template. ' +
            'Optionally include fallback_exercises — a shortened minimum version of the workout for low-time or low-energy days (swap a scheduled session to it with update_scheduled_workout use_fallback). ' +
            'Example: {"name": "Upper A", "description": "Heavy upper body", "exercises": [{"exercise_name": "Bench Press", "sets": 4, "rep_range": "8-12", "rest_seconds": 90, "order": 1}, {"exercise_name": "Barbell Row", "sets": 4, "rep_range": "8-12", "rest_seconds": 90, "order": 2}], "fallback_exercises": [{"exercise_name": "Push-ups", "sets": 3, "rep_range": "15-20", "order": 1}]}.',
        inputSchema: {
            type: 'object',
            required: ['name', 'exercises'],
            properties: {
                name:        { type: 'string', description: 'Template name, e.g. "Upper A". Used as the upsert key.' },
                description: { type: 'string', description: 'Optional description of the session focus.' },
                exercises: {
                    type: 'array',
                    description: 'Full session exercise list, in order.',
                    items: {
                        type: 'object',
                        required: ['exercise_name', 'sets', 'rep_range'],
                        properties: {
                            exercise_name: { type: 'string' },
                            sets:          { type: 'number' },
                            rep_range:     { type: 'string', description: 'e.g. "8-12", "5", "AMRAP"' },
                            rest_seconds:  { type: 'number', description: 'Rest between sets. Defaults to 60.' },
                            notes:         { type: 'string', description: 'Form cues, tempo, RPE, etc.' },
                            order:         { type: 'number', description: '1-based position in the session. Defaults to array order.' },
                        },
                    },
                },
                fallback_exercises: {
                    type: 'array',
                    description: 'Shortened minimum version of the workout (same item shape as exercises). Optional.',
                    items: {
                        type: 'object',
                        required: ['exercise_name', 'sets', 'rep_range'],
                        properties: {
                            exercise_name: { type: 'string' },
                            sets:          { type: 'number' },
                            rep_range:     { type: 'string' },
                            rest_seconds:  { type: 'number' },
                            notes:         { type: 'string' },
                            order:         { type: 'number' },
                        },
                    },
                },
            },
        },
    },
    {
        name: 'get_workout_templates',
        description:
            'List all of the user\'s workout templates with their exercises and fallback (shortened) versions. ' +
            'Exercises with logged history also carry last_weight_lbs, last_reps, suggested_weight_lbs and ' +
            'progression ("increase" when every set hit the top of the rep range last time, else "repeat"). ' +
            'Use before schedule_workout to see what template names exist. Example: {} (no arguments).',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'schedule_workout',
        description:
            'Schedule a workout for a date (status starts as planned). Pass template_name for a strength/template session OR activity_type for ad-hoc cardio — exactly one of the two. ' +
            'To schedule a repeating pattern in one call, pass recurrence with days_of_week and an until date (capped at 90 days from the start date; extra dates are dropped and reported). ' +
            'Defaults: time = 12:00, duration_mins = 60 (or the template\'s estimated duration). ' +
            'Example (template): {"date": "2026-07-06", "template_name": "Upper A", "recurrence": {"days_of_week": ["mon", "thu"], "until": "2026-08-31"}}. ' +
            'Example (cardio): {"date": "2026-07-07", "activity_type": "Rowing", "duration_mins": 30}.',
        inputSchema: {
            type: 'object',
            required: ['date'],
            properties: {
                date:          { type: 'string', description: 'Start date YYYY-MM-DD. With recurrence, entries are created on matching weekdays from this date.' },
                template_name: { type: 'string', description: 'Name of a saved template (see get_workout_templates). Mutually exclusive with activity_type.' },
                activity_type: { type: 'string', description: 'Ad-hoc cardio activity, e.g. "Rowing", "Running". Mutually exclusive with template_name.' },
                duration_mins: { type: 'number', description: 'Planned duration in minutes. Defaults to 60 or the template\'s estimated duration.' },
                time:          { type: 'string', description: 'Time of day HH:MM (24h). Defaults to 12:00.' },
                notes:         { type: 'string', description: 'Optional notes, e.g. "Zone 2" or "deload week".' },
                recurrence: {
                    type: 'object',
                    required: ['days_of_week', 'until'],
                    description: 'Repeat on the given weekdays from date through until (inclusive), max 90 days.',
                    properties: {
                        days_of_week: {
                            type: 'array',
                            items: { type: 'string', enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
                        },
                        until: { type: 'string', description: 'Last date YYYY-MM-DD (inclusive).' },
                    },
                },
            },
        },
    },
    {
        name: 'get_schedule',
        description:
            'Get scheduled workouts for a date range with status: planned, completed, missed (was planned but the day passed with no logged session), or skipped (with skipped_reason). ' +
            'Returns each entry\'s id (needed by update_scheduled_workout and log_workout), title, exercises (the fallback version if the entry was swapped to it), and linked completed workout id. ' +
            'Defaults: start_date = today, end_date = start_date + 6 days. Example: {"start_date": "2026-07-06", "end_date": "2026-07-12"}.',
        inputSchema: {
            type: 'object',
            properties: {
                start_date: { type: 'string', description: 'Start date YYYY-MM-DD. Defaults to today.' },
                end_date:   { type: 'string', description: 'End date YYYY-MM-DD. Defaults to start_date + 6 days.' },
            },
        },
    },
    {
        name: 'update_scheduled_workout',
        description:
            'Change a scheduled workout entry (get the id from get_schedule). Supports: moving it to a new date/time, swapping the template (template_name), switching between the full session and the shortened fallback version (use_fallback), ' +
            'marking it skipped with a reason, or setting it back to planned. ' +
            'Example (swap to fallback): {"scheduled_workout_id": "abc-123", "use_fallback": true}. ' +
            'Example (skip): {"scheduled_workout_id": "abc-123", "status": "skipped", "reason": "travelling for work"}. ' +
            'Example (move): {"scheduled_workout_id": "abc-123", "new_date": "2026-07-09"}.',
        inputSchema: {
            type: 'object',
            required: ['scheduled_workout_id'],
            properties: {
                scheduled_workout_id: { type: 'string', description: 'Entry id from get_schedule.' },
                new_date:      { type: 'string', description: 'Move to this date YYYY-MM-DD.' },
                new_time:      { type: 'string', description: 'New time of day HH:MM (24h).' },
                template_name: { type: 'string', description: 'Swap to a different saved template.' },
                use_fallback:  { type: 'boolean', description: 'true = use the template\'s shortened fallback version; false = full session.' },
                status:        { type: 'string', enum: ['planned', 'skipped'], description: 'Set skipped (include reason) or restore to planned.' },
                reason:        { type: 'string', description: 'Why the workout was skipped. Stored and shown in get_schedule.' },
                notes:         { type: 'string', description: 'Replace the entry notes.' },
            },
        },
    },
    {
        name: 'update_daily_log',
        description:
            'Update daily wellness metrics: sleep quality, energy level, alcohol intake, or daily journal note.',
        inputSchema: {
            type: 'object',
            properties: {
                date:           { type: 'string', description: 'Date YYYY-MM-DD. Defaults to today.' },
                sleep_quality:  { type: 'number', minimum: 1, maximum: 5, description: '1 = poor, 5 = excellent' },
                energy_level:   { type: 'number', minimum: 1, maximum: 5, description: '1 = exhausted, 5 = great' },
                alcohol_drinks: { type: 'number', description: 'Number of standard drinks' },
                daily_note:     { type: 'string', description: 'Journal entry / subjective notes for the day' },
            },
        },
    },
    {
        name: 'save_meal',
        description:
            'Create or update a named, reusable meal. Upserts by name (case-insensitive): saving "Fajita chicken bowl" twice updates the existing meal. ' +
            'ingredients is a plain string list for display only (not used for macro calculation) — pass calories/protein/carbs/fat directly. ' +
            'Example: {"name": "Fajita chicken bowl", "calories": 620, "protein": 55, "carbs": 60, "fat": 15, "tags": ["lunch", "batch-cooked"], "ingredients": ["chicken breast", "rice", "peppers", "salsa"]}.',
        inputSchema: {
            type: 'object',
            required: ['name', 'calories'],
            properties: {
                name:        { type: 'string', description: 'Meal name, e.g. "Fajita chicken bowl". Used as the upsert key.' },
                description: { type: 'string', description: 'Optional description.' },
                calories:    { type: 'number', description: 'Calories (kcal) for one serving.' },
                protein:     { type: 'number', description: 'Protein in grams. Defaults to 0.' },
                carbs:       { type: 'number', description: 'Carbohydrates in grams. Defaults to 0.' },
                fat:         { type: 'number', description: 'Fat in grams. Defaults to 0.' },
                tags:        { type: 'array', items: { type: 'string' }, description: 'e.g. ["lunch", "batch-cooked"]' },
                ingredients: { type: 'array', items: { type: 'string' }, description: 'Ingredient list, display only.' },
            },
        },
    },
    {
        name: 'get_meals',
        description: 'List all of the user\'s saved meals with macros, tags, and ingredients. Use before plan_meal to see what meal names exist. Example: {} (no arguments).',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'plan_meal',
        description:
            `Assign a meal to a date and slot (status starts as planned). Pass meal_name for a saved meal OR name + calories for a one-off ad-hoc meal — exactly one of the two. Slot must be one of: ${MEAL_SLOTS.join(', ')}. ` +
            'To schedule a repeating pattern in one call, pass recurrence with days_of_week and an until date (capped at 90 days from the start date; extra dates are dropped and reported). ' +
            'A planned meal is never counted in daily nutrition totals until it\'s logged (see log_food / log_planned_meal). ' +
            `Example (saved meal): {"date": "2026-07-06", "meal_name": "Fajita chicken bowl", "slot": "lunch", "recurrence": {"days_of_week": ["mon", "wed", "fri"], "until": "2026-08-31"}}. ` +
            'Example (ad-hoc): {"date": "2026-07-06", "name": "Protein shake", "calories": 220, "protein": 40, "slot": "closer", "time": "21:00"}.',
        inputSchema: {
            type: 'object',
            required: ['date', 'slot'],
            properties: {
                date:      { type: 'string', description: 'Start date YYYY-MM-DD. With recurrence, entries are created on matching weekdays from this date.' },
                slot:      { type: 'string', enum: [...MEAL_SLOTS], description: `Meal slot. One of: ${MEAL_SLOTS.join(', ')}.` },
                meal_name: { type: 'string', description: 'Name of a saved meal (see get_meals). Mutually exclusive with name/calories.' },
                name:      { type: 'string', description: 'Ad-hoc meal name. Mutually exclusive with meal_name. Requires calories.' },
                calories:  { type: 'number', description: 'Ad-hoc meal calories. Required when using name instead of meal_name.' },
                protein:   { type: 'number', description: 'Ad-hoc meal protein in grams. Defaults to 0.' },
                carbs:     { type: 'number', description: 'Ad-hoc meal carbs in grams. Defaults to 0.' },
                fat:       { type: 'number', description: 'Ad-hoc meal fat in grams. Defaults to 0.' },
                time:      { type: 'string', description: 'Time of day HH:MM (24h). Optional.' },
                notes:     { type: 'string', description: 'Optional notes, e.g. "double the protein today".' },
                recurrence: {
                    type: 'object',
                    required: ['days_of_week', 'until'],
                    description: 'Repeat on the given weekdays from date through until (inclusive), max 90 days.',
                    properties: {
                        days_of_week: {
                            type: 'array',
                            items: { type: 'string', enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
                        },
                        until: { type: 'string', description: 'Last date YYYY-MM-DD (inclusive).' },
                    },
                },
            },
        },
    },
    {
        name: 'get_meal_plan',
        description:
            'Get planned meals for a date range, grouped by day with per-day planned vs. logged macro totals so a coach can compare plan to actual at a glance. ' +
            'Each entry has status planned, logged, or skipped, and linked_food_log_id once logged. ' +
            'Defaults: start_date = today, end_date = start_date + 6 days. Example: {"start_date": "2026-07-06", "end_date": "2026-07-12"}.',
        inputSchema: {
            type: 'object',
            properties: {
                start_date: { type: 'string', description: 'Start date YYYY-MM-DD. Defaults to today.' },
                end_date:   { type: 'string', description: 'End date YYYY-MM-DD. Defaults to start_date + 6 days.' },
            },
        },
    },
    {
        name: 'update_planned_meal',
        description:
            'Change a planned meal entry (get the id from get_meal_plan). Supports: moving it to a new date/slot/time, swapping which meal it is (meal_name), marking it skipped with a reason, or restoring it to planned. ' +
            'Example (skip): {"planned_meal_id": "abc-123", "status": "skipped", "reason": "eating out"}. ' +
            'Example (swap): {"planned_meal_id": "abc-123", "meal_name": "Turkey chili"}.',
        inputSchema: {
            type: 'object',
            required: ['planned_meal_id'],
            properties: {
                planned_meal_id: { type: 'string', description: 'Entry id from get_meal_plan.' },
                new_date:  { type: 'string', description: 'Move to this date YYYY-MM-DD.' },
                new_slot:  { type: 'string', enum: [...MEAL_SLOTS], description: `Move to this slot. One of: ${MEAL_SLOTS.join(', ')}.` },
                new_time:  { type: 'string', description: 'New time of day HH:MM (24h).' },
                meal_name: { type: 'string', description: 'Swap to a different saved meal (see get_meals). Recalculates macros from that meal.' },
                status:    { type: 'string', enum: ['planned', 'skipped'], description: 'Set skipped (include reason) or restore to planned.' },
                reason:    { type: 'string', description: 'Why the meal was skipped. Stored and shown in get_meal_plan.' },
                notes:     { type: 'string', description: 'Replace the entry notes.' },
            },
        },
    },
    {
        name: 'log_planned_meal',
        description:
            'Convenience one-call "ate what I planned": logs a planned meal exactly as planned (or with overrides) to its own planned date, and marks it logged. Equivalent to calling log_food with planned_meal_id. ' +
            'Example (ate exactly as planned): {"planned_meal_id": "abc-123"}. ' +
            'Example (ate a bit more): {"planned_meal_id": "abc-123", "adjustments": {"calories": 700}}.',
        inputSchema: {
            type: 'object',
            required: ['planned_meal_id'],
            properties: {
                planned_meal_id: { type: 'string', description: 'Entry id from get_meal_plan.' },
                adjustments: {
                    type: 'object',
                    description: 'Override any of the planned macros with what was actually eaten.',
                    properties: {
                        name:     { type: 'string' },
                        calories: { type: 'number' },
                        protein:  { type: 'number' },
                        carbs:    { type: 'number' },
                        fat:      { type: 'number' },
                    },
                },
            },
        },
    },
];

// ─── AUTH ─────────────────────────────────────────────────────────────────────

function sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

function extractKey(req: NextRequest): string {
    // 1. Authorization: Bearer <key>  (preferred)
    const auth = req.headers.get('authorization') ?? '';
    if (auth.startsWith('Bearer ')) {
        const val = auth.slice(7).trim();
        // Exclude Supabase JWTs (they contain dots and are very long)
        if (val && !val.includes('.') && val.length < 200) return val;
    }
    // 2. ?key= query param (for Claude.ai "add MCP server" URL)
    return new URL(req.url).searchParams.get('key') ?? '';
}

async function validateKey(key: string): Promise<string | null> {
    if (!key) return null;
    const { data } = await supabaseAdmin
        .from('mcp_api_keys')
        .select('user_id')
        .eq('key_hash', sha256(key))
        .maybeSingle();
    if (!data?.user_id) return null;

    // Fire-and-forget: record last used
    supabaseAdmin
        .from('mcp_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('key_hash', sha256(key))
        .then(() => {});

    return data.user_id as string;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function todayStr(): string {
    return format(new Date(), 'yyyy-MM-dd');
}

/**
 * "Today" in the user's stored IANA timezone (user_settings.timezone, synced
 * by the web app). Falls back to the server clock (UTC on Vercel) when unset
 * or invalid — without this, evening logs land on tomorrow's date.
 */
async function todayFor(userId: string): Promise<string> {
    const { data } = await supabaseAdmin
        .from('user_settings')
        .select('timezone')
        .eq('user_id', userId)
        .maybeSingle();
    const tz = (data as { timezone?: string | null } | null)?.timezone;
    if (tz) {
        try {
            // en-CA formats as YYYY-MM-DD
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
            }).format(new Date());
        } catch { /* invalid timezone string — fall through */ }
    }
    return todayStr();
}

/** dateStr ± days, on date-only strings (no timezone involvement). */
function shiftDate(dateStr: string, days: number): string {
    return format(addDays(new Date(dateStr + 'T00:00:00'), days), 'yyyy-MM-dd');
}

function ok(id: unknown, result: unknown) {
    return NextResponse.json({ jsonrpc: '2.0', id, result }, { headers: corsHeaders() });
}

function rpcError(id: unknown, code: number, message: string) {
    return NextResponse.json(
        { jsonrpc: '2.0', id, error: { code, message } },
        { status: code === -32001 ? 401 : 400, headers: corsHeaders() }
    );
}

function toolResult(data: unknown, isError = false) {
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        isError,
    };
}

/** Validate a YYYY-MM-DD string and return it. Throws a clear message otherwise. */
function assertDate(value: unknown, field: string): string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`${field} must be a date in YYYY-MM-DD format, got "${value}"`);
    }
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime()) || format(d, 'yyyy-MM-dd') !== value) {
        throw new Error(`${field} is not a real calendar date: "${value}"`);
    }
    return value;
}

/** Validate HH:MM (24h) and normalise to HH:MM:SS. */
function assertTime(value: unknown, field: string): string {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
        throw new Error(`${field} must be a time in HH:MM 24-hour format, got "${value}"`);
    }
    return value.length === 5 ? `${value}:00` : value;
}

function assertSlot(value: unknown): string {
    if (typeof value !== 'string' || !(MEAL_SLOTS as readonly string[]).includes(value)) {
        throw new Error(`slot must be one of: ${MEAL_SLOTS.join(', ')}. Got "${value}".`);
    }
    return value;
}

// MCP exercise shape ↔ workout_templates.exercises JSONB shape used by the app UI
// ({name, sets, reps, rest, notes, order}).
interface StoredExercise {
    name?: string;
    sets?: number;
    reps?: string;
    rest?: number;
    notes?: string;
    order?: number;
}

function toStoredExercises(list: unknown, field: string): Record<string, unknown>[] {
    if (!Array.isArray(list) || list.length === 0) {
        throw new Error(`${field} must be a non-empty array of exercises`);
    }
    return list.map((e: Record<string, unknown>, idx: number) => {
        if (!e?.exercise_name || typeof e.exercise_name !== 'string') {
            throw new Error(`${field}[${idx}].exercise_name is required`);
        }
        if (typeof e.sets !== 'number' || e.sets < 1) {
            throw new Error(`${field}[${idx}].sets must be a positive number`);
        }
        if (typeof e.rep_range !== 'string' || !e.rep_range) {
            throw new Error(`${field}[${idx}].rep_range is required, e.g. "8-12"`);
        }
        return {
            name:  e.exercise_name,
            sets:  e.sets,
            reps:  e.rep_range,
            rest:  typeof e.rest_seconds === 'number' ? e.rest_seconds : 60,
            notes: typeof e.notes === 'string' ? e.notes : undefined,
            order: typeof e.order === 'number' ? e.order : idx + 1,
        };
    }).sort((a, b) => (a.order as number) - (b.order as number));
}

function toMcpExercises(stored: unknown): Record<string, unknown>[] {
    return (Array.isArray(stored) ? (stored as StoredExercise[]) : []).map((e, idx) => ({
        exercise_name: e.name,
        sets:          e.sets,
        rep_range:     e.reps,
        rest_seconds:  e.rest ?? null,
        notes:         e.notes ?? null,
        order:         e.order ?? idx + 1,
    }));
}

// ─── PROGRESSIVE OVERLOAD ─────────────────────────────────────────────────────

const PROGRESSION_INCREMENT_LBS = 5;

function repRangeTop(repRange: unknown): number | null {
    if (typeof repRange !== 'string') return null;
    const m = repRange.match(/(\d+)\s*$/); // "8-12" → 12, "12" → 12
    return m ? parseInt(m[1], 10) : null;
}

/**
 * Decorate template/schedule exercises with the most recent logged
 * performance and a double-progression suggestion: every set at the top of
 * the rep range last time → last weight + 5 lbs, otherwise repeat it.
 * Adds last_weight_lbs, last_reps, suggested_weight_lbs, and
 * progression ('increase' | 'repeat'). Best-effort — exercises without
 * usable weighted history are left untouched.
 */
async function attachProgression(userId: string, exercises: Record<string, unknown>[]) {
    if (!exercises.length) return;

    const since = format(subDays(new Date(), 90), 'yyyy-MM-dd');
    const { data: workouts } = await supabaseAdmin
        .from('workouts')
        .select('id,date')
        .eq('user_id', userId)
        .gte('date', since)
        .order('date', { ascending: false })
        .limit(30);
    if (!workouts?.length) return;

    const { data: history } = await supabaseAdmin
        .from('workout_exercises')
        .select('id,workout_id,exercise_name')
        .in('workout_id', workouts.map(w => w.id));
    if (!history?.length) return;

    const { data: sets } = await supabaseAdmin
        .from('workout_sets')
        .select('exercise_id,weight,reps,completed')
        .in('exercise_id', history.map(h => h.id));

    // Most recent weighted, completed sets per exercise name
    const dateByWorkout = new Map(workouts.map(w => [w.id, w.date as string]));
    const lastByName = new Map<string, { reps: number; weight: number }[]>();
    const lastDate = new Map<string, string>();
    for (const h of history) {
        const key = (h.exercise_name as string | null)?.toLowerCase();
        if (!key) continue;
        const date = dateByWorkout.get(h.workout_id) ?? '';
        const seen = lastDate.get(key);
        if (seen != null && seen >= date) continue;
        const own = (sets ?? [])
            .filter(s => s.exercise_id === h.id && s.weight != null && s.reps != null && s.completed !== false)
            .map(s => ({ reps: s.reps as number, weight: s.weight as number }));
        if (!own.length) continue;
        lastDate.set(key, date);
        lastByName.set(key, own);
    }

    for (const ex of exercises) {
        const own = lastByName.get(String(ex.exercise_name ?? '').toLowerCase());
        if (!own?.length) continue;
        const lastWeight = Math.max(...own.map(s => s.weight));
        const repsAtWeight = own.filter(s => s.weight === lastWeight).map(s => s.reps);
        const top = repRangeTop(ex.rep_range);
        const targetSets = typeof ex.sets === 'number' ? ex.sets : null;
        const hitAll = top != null && targetSets != null &&
            repsAtWeight.length >= targetSets && repsAtWeight.every(r => r >= top);

        ex.last_weight_lbs = lastWeight;
        ex.last_reps = repsAtWeight;
        ex.suggested_weight_lbs = hitAll ? lastWeight + PROGRESSION_INCREMENT_LBS : lastWeight;
        ex.progression = hitAll ? 'increase' : 'repeat';
    }
}

/** Fetch the user's templates and find one by name (case-insensitive). Throws with the available names. */
async function findTemplateByName(userId: string, name: string) {
    const { data, error } = await supabaseAdmin
        .from('workout_templates')
        .select('id,name,description,exercises,fallback_exercises,estimated_duration,updated_at')
        .eq('author_id', userId);
    if (error) throw error;

    const templates = data ?? [];
    const match = templates.find(t => t.name.toLowerCase() === name.trim().toLowerCase());
    if (!match) {
        const names = templates.map(t => `"${t.name}"`).join(', ') || 'none';
        throw new Error(`Template "${name}" not found. Available templates: ${names}. Create it first with save_workout_template.`);
    }
    return match;
}

/** DB status → MCP status. Entries still "scheduled" after the day has passed read as missed. */
function mcpStatus(dbStatus: string, scheduledDate: string, today: string): string {
    if (dbStatus === 'completed') return 'completed';
    if (dbStatus === 'skipped')   return 'skipped';
    return scheduledDate < today ? 'missed' : 'planned';
}

// ─── TOOL HANDLERS ────────────────────────────────────────────────────────────

async function getDailyLogs(userId: string, args: Record<string, unknown>, today: string) {
    const start = (args.start_date as string) ?? shiftDate(today, -7);
    const end   = (args.end_date   as string) ?? today;

    const { data, error } = await supabaseAdmin
        .from('daily_logs')
        .select(
            'date,movement_completed,nutrition_logged,' +
            'protein_grams,carbs_grams,fat_grams,calories,' +
            'alcohol_drinks,sleep_quality,energy_level,' +
            'motivation_level,stress_level,daily_note,' +
            'habits,food_items'
        )
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });

    if (error) throw error;
    return data ?? [];
}

async function getWorkouts(userId: string, args: Record<string, unknown>, today: string) {
    const start = (args.start_date as string) ?? shiftDate(today, -30);
    const end   = (args.end_date   as string) ?? today;

    const { data: workouts, error } = await supabaseAdmin
        .from('workouts')
        .select('id,date,activity_type,duration,intensity,calories,notes,distance,average_heartrate,source')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });

    if (error) throw error;
    if (!workouts?.length) return [];

    // Pull exercises + sets for strength workouts
    const ids = workouts.map(w => w.id);
    const { data: exercises } = await supabaseAdmin
        .from('workout_exercises')
        .select('id,workout_id,exercise_name,order_index')
        .in('workout_id', ids)
        .order('order_index');

    const exIds = (exercises ?? []).map(e => e.id);
    const { data: sets } = exIds.length
        ? await supabaseAdmin
              .from('workout_sets')
              .select('exercise_id,set_number,weight,reps,completed')
              .in('exercise_id', exIds)
              .order('set_number')
        : { data: [] };

    return workouts.map(w => {
        const wxs = (exercises ?? []).filter(e => e.workout_id === w.id);
        if (!wxs.length) return w;
        return {
            ...w,
            exercises: wxs.map(ex => ({
                name: ex.exercise_name,
                sets: (sets ?? [])
                    .filter(s => s.exercise_id === ex.id)
                    .map(s => ({ set: s.set_number, weight: s.weight, reps: s.reps, completed: s.completed })),
            })),
        };
    });
}

async function getBodyMetrics(userId: string, args: Record<string, unknown>, today: string) {
    const days  = Math.min((args.days as number) ?? 90, 365);
    const start = shiftDate(today, -days);

    const { data, error } = await supabaseAdmin
        .from('body_metrics')
        .select('date,weight,measurements')
        .eq('user_id', userId)
        .gte('date', start)
        .order('date', { ascending: false });

    if (error) throw error;
    return data ?? [];
}

async function getReadiness(userId: string, today: string) {
    const start = shiftDate(today, -27);
    const { data: logs, error } = await supabaseAdmin
        .from('daily_logs')
        .select('date,sleep_quality,energy_level,alcohol_drinks,resting_heartrate')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', today);
    if (error) throw error;

    const { data: workouts, error: wErr } = await supabaseAdmin
        .from('workouts')
        .select('date,duration,intensity')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', today);
    if (wErr) throw wErr;

    // Last night's tracked sleep (Health Connect etc.), if any
    const { data: sleepRecord } = await supabaseAdmin
        .from('sleep_records')
        .select('duration_minutes,deep_minutes,rem_minutes')
        .eq('user_id', userId)
        .eq('date', today)
        .order('duration_minutes', { ascending: false })
        .limit(1)
        .maybeSingle();

    return computeReadiness(logs ?? [], workouts ?? [], today, sleepRecord ?? null);
}

async function getUserProfile(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('user_settings')
        .select('display_name,fitness_goal,target_weight,target_protein,target_calories,available_equipment,current_level,total_xp,weight_unit')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function logFood(userId: string, args: Record<string, unknown>, today: string) {
    // Pull defaults from the planned meal (if any) before applying caller overrides
    let plannedMeal: { id: string; name: string; scheduled_date: string; calories: number; protein: number; carbs: number; fat: number } | null = null;
    if (args.planned_meal_id) {
        const { data, error } = await supabaseAdmin
            .from('planned_meals')
            .select('id,name,scheduled_date,calories,protein,carbs,fat')
            .eq('id', args.planned_meal_id as string)
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error(`Planned meal "${args.planned_meal_id}" not found. Use get_meal_plan to find valid ids.`);
        plannedMeal = data;
    }

    const date = (args.date as string) ?? plannedMeal?.scheduled_date ?? today;

    const name = (args.name as string) ?? plannedMeal?.name;
    if (!name) throw new Error('name is required unless planned_meal_id is given.');
    const calories = args.calories != null ? (args.calories as number) : plannedMeal?.calories;
    if (calories == null) throw new Error('calories is required unless planned_meal_id is given.');

    const item = {
        id:       crypto.randomUUID(),
        name,
        calories,
        protein: args.protein != null ? (args.protein as number) : (plannedMeal?.protein ?? 0),
        carbs:   args.carbs   != null ? (args.carbs   as number) : (plannedMeal?.carbs   ?? 0),
        fat:     args.fat     != null ? (args.fat     as number) : (plannedMeal?.fat     ?? 0),
    };

    // Fetch existing log
    const { data: existing } = await supabaseAdmin
        .from('daily_logs')
        .select('food_items,calories,protein_grams,carbs_grams,fat_grams')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

    const items = [...((existing?.food_items as any[]) ?? []), item];
    const totals = items.reduce(
        (a, i) => ({
            calories:     a.calories     + (i.calories ?? 0),
            protein_grams: a.protein_grams + (i.protein  ?? 0),
            carbs_grams:  a.carbs_grams  + (i.carbs    ?? 0),
            fat_grams:    a.fat_grams    + (i.fat      ?? 0),
        }),
        { calories: 0, protein_grams: 0, carbs_grams: 0, fat_grams: 0 }
    );

    const { error } = await supabaseAdmin
        .from('daily_logs')
        .upsert(
            { user_id: userId, date, food_items: items, nutrition_logged: true, ...totals, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,date' }
        );
    if (error) throw error;

    let linkedPlannedMeal: { id: string; name: string } | null = null;
    if (plannedMeal) {
        await supabaseAdmin
            .from('planned_meals')
            .update({
                status:            'logged',
                linked_food_log_id: item.id,
                actual_calories:   item.calories,
                actual_protein:    item.protein,
                actual_carbs:      item.carbs,
                actual_fat:        item.fat,
                updated_at:        new Date().toISOString(),
            })
            .eq('id', plannedMeal.id);
        linkedPlannedMeal = { id: plannedMeal.id, name: plannedMeal.name };
    }

    return { logged: item, day_totals: totals, linked_planned_meal: linkedPlannedMeal };
}

/** log_planned_meal is sugar over logFood: same macros defaulting/override logic, always dated to the plan's own day. */
async function logPlannedMeal(userId: string, args: Record<string, unknown>, today: string) {
    const plannedMealId = args.planned_meal_id as string;
    if (!plannedMealId) throw new Error('planned_meal_id is required — get it from get_meal_plan.');

    const adjustments = (args.adjustments as Record<string, unknown>) ?? {};
    return logFood(userId, { planned_meal_id: plannedMealId, ...adjustments }, today);
}

async function logWorkout(userId: string, args: Record<string, unknown>, today: string) {
    const date = args.date != null ? assertDate(args.date, 'date') : today;

    const { data, error } = await supabaseAdmin
        .from('workouts')
        .insert({
            user_id:       userId,
            date,
            activity_type: args.activity_type as string,
            duration:      (args.duration_mins as number) ?? 45,
            intensity:     (args.intensity     as string) ?? 'Moderate',
            calories:      (args.calories as number) ?? null,
            average_heartrate: (args.average_heartrate as number) ?? null,
            max_heartrate:     (args.max_heartrate     as number) ?? null,
            notes:         (args.notes    as string) ?? null,
            source:        'manual',
        })
        .select()
        .single();

    if (error) throw error;

    // Strength logging: exercises with performed sets
    const exercises = args.exercises as { exercise_name?: string; sets?: { reps?: number; weight_lbs?: number }[] }[] | undefined;
    if (Array.isArray(exercises) && exercises.length) {
        for (let i = 0; i < exercises.length; i++) {
            const ex = exercises[i];
            if (!ex?.exercise_name || !Array.isArray(ex.sets)) {
                throw new Error(`exercises[${i}] needs exercise_name and a sets array of {reps, weight_lbs}`);
            }
            const { data: exRow, error: exErr } = await supabaseAdmin
                .from('workout_exercises')
                .insert({ workout_id: data.id, exercise_name: ex.exercise_name, order_index: i })
                .select()
                .single();
            if (exErr) throw exErr;

            const setRows = ex.sets.map((s, si) => ({
                exercise_id: exRow.id,
                set_number:  si + 1,
                weight:      s.weight_lbs ?? null,
                reps:        s.reps ?? null,
                completed:   true,
            }));
            const { error: setErr } = await supabaseAdmin.from('workout_sets').insert(setRows);
            if (setErr) throw setErr;
        }
    }

    // Mark the day as having movement
    await supabaseAdmin
        .from('daily_logs')
        .upsert(
            { user_id: userId, date, movement_completed: true, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,date' }
        );

    // Mark a scheduled entry completed: explicit id wins, otherwise match by date
    let completedSchedule: { id: string; title: string } | null = null;
    if (args.scheduled_workout_id) {
        const { data: sched, error: schedErr } = await supabaseAdmin
            .from('scheduled_workouts')
            .update({ status: 'completed', completed_workout_id: data.id, updated_at: new Date().toISOString() })
            .eq('id', args.scheduled_workout_id as string)
            .eq('user_id', userId)
            .select('id,title')
            .maybeSingle();
        if (schedErr) throw schedErr;
        if (!sched) throw new Error(`Scheduled workout "${args.scheduled_workout_id}" not found (the workout itself was logged). Use get_schedule to find valid ids.`);
        completedSchedule = sched;
    } else {
        const { data: candidates } = await supabaseAdmin
            .from('scheduled_workouts')
            .select('id,title')
            .eq('user_id', userId)
            .eq('scheduled_date', date)
            .in('status', ['scheduled', 'rescheduled'])
            .order('scheduled_time', { ascending: true })
            .limit(1);
        if (candidates?.length) {
            await supabaseAdmin
                .from('scheduled_workouts')
                .update({ status: 'completed', completed_workout_id: data.id, updated_at: new Date().toISOString() })
                .eq('id', candidates[0].id);
            completedSchedule = candidates[0];
        }
    }

    return { ...data, completed_scheduled_workout: completedSchedule };
}

// ─── COACH TOOLS: TEMPLATES & SCHEDULE ────────────────────────────────────────

async function saveWorkoutTemplate(userId: string, args: Record<string, unknown>) {
    const name = (args.name as string)?.trim();
    if (!name) throw new Error('name is required, e.g. "Upper A"');

    const exercises = toStoredExercises(args.exercises, 'exercises');
    const fallback  = args.fallback_exercises != null
        ? toStoredExercises(args.fallback_exercises, 'fallback_exercises')
        : [];

    const { data: existing, error: findErr } = await supabaseAdmin
        .from('workout_templates')
        .select('id,name')
        .eq('author_id', userId);
    if (findErr) throw findErr;

    const match = (existing ?? []).find(t => t.name.toLowerCase() === name.toLowerCase());
    const fields = {
        name,
        description:        (args.description as string) ?? null,
        exercises,
        fallback_exercises: fallback,
        updated_at:         new Date().toISOString(),
    };

    if (match) {
        const { data, error } = await supabaseAdmin
            .from('workout_templates')
            .update(fields)
            .eq('id', match.id)
            .eq('author_id', userId)
            .select('id,name')
            .single();
        if (error) throw error;
        return { action: 'updated', template_id: data.id, name: data.name, exercise_count: exercises.length, fallback_count: fallback.length };
    }

    const { data, error } = await supabaseAdmin
        .from('workout_templates')
        .insert({ ...fields, author_id: userId, category: 'custom', is_public: false })
        .select('id,name')
        .single();
    if (error) throw error;
    return { action: 'created', template_id: data.id, name: data.name, exercise_count: exercises.length, fallback_count: fallback.length };
}

async function getWorkoutTemplates(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('workout_templates')
        .select('id,name,description,exercises,fallback_exercises,estimated_duration,updated_at')
        .eq('author_id', userId)
        .order('name', { ascending: true });
    if (error) throw error;

    const templates = (data ?? []).map(t => ({
        id:                 t.id,
        name:               t.name,
        description:        t.description,
        exercises:          toMcpExercises(t.exercises),
        fallback_exercises: toMcpExercises(t.fallback_exercises),
        estimated_duration: t.estimated_duration,
        updated_at:         t.updated_at,
    }));
    await attachProgression(userId, templates.flatMap(t => [...t.exercises, ...t.fallback_exercises]));
    return templates;
}

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const RECURRENCE_CAP_DAYS = 90;

async function scheduleWorkoutTool(userId: string, args: Record<string, unknown>) {
    const startDate = assertDate(args.date, 'date');
    const time      = args.time != null ? assertTime(args.time, 'time') : '12:00:00';

    const templateName = args.template_name as string | undefined;
    const activityType = args.activity_type as string | undefined;
    if (!!templateName === !!activityType) {
        throw new Error('Pass exactly one of template_name (saved template session) or activity_type (ad-hoc cardio).');
    }

    let templateId: string | null = null;
    let title: string;
    let duration = args.duration_mins as number | undefined;
    if (templateName) {
        const tpl  = await findTemplateByName(userId, templateName);
        templateId = tpl.id;
        title      = tpl.name;
        duration   = duration ?? tpl.estimated_duration ?? 60;
    } else {
        title    = activityType!;
        duration = duration ?? 60;
    }

    // Expand the date list: single date, or recurrence pattern capped at 90 days
    let dates = [startDate];
    let truncated = false;
    const recurrence = args.recurrence as { days_of_week?: unknown; until?: unknown } | undefined;
    if (recurrence) {
        const days = recurrence.days_of_week;
        if (!Array.isArray(days) || !days.length) {
            throw new Error('recurrence.days_of_week must be a non-empty array of weekdays, e.g. ["mon", "thu"]');
        }
        const invalid = days.filter(d => !DOW.includes(d as string));
        if (invalid.length) {
            throw new Error(`Invalid days_of_week: ${invalid.join(', ')}. Use: mon, tue, wed, thu, fri, sat, sun.`);
        }
        const until = assertDate(recurrence.until, 'recurrence.until');
        if (until < startDate) throw new Error(`recurrence.until (${until}) is before the start date (${startDate}).`);

        const capEnd = format(addDays(new Date(startDate + 'T00:00:00'), RECURRENCE_CAP_DAYS), 'yyyy-MM-dd');
        truncated = until > capEnd;
        const end  = truncated ? capEnd : until;

        dates = [];
        for (let d = new Date(startDate + 'T00:00:00'); format(d, 'yyyy-MM-dd') <= end; d = addDays(d, 1)) {
            if (days.includes(DOW[d.getDay()])) dates.push(format(d, 'yyyy-MM-dd'));
        }
        if (!dates.length) {
            throw new Error(`No matching weekdays between ${startDate} and ${end} for days_of_week [${days.join(', ')}].`);
        }
    }

    const rows = dates.map(d => ({
        user_id:          userId,
        template_id:      templateId,
        scheduled_date:   d,
        scheduled_time:   time,
        title,
        notes:            (args.notes as string) ?? null,
        status:           'scheduled',
        duration_minutes: duration,
        remind_minutes:   15,
    }));

    const { data, error } = await supabaseAdmin
        .from('scheduled_workouts')
        .insert(rows)
        .select('id,scheduled_date');
    if (error) throw error;

    return {
        scheduled_count: data?.length ?? rows.length,
        title,
        dates: (data ?? []).map(r => r.scheduled_date),
        entries: data ?? [],
        ...(truncated ? { note: `Recurrence capped at ${RECURRENCE_CAP_DAYS} days from ${startDate}; dates after that were not scheduled. Call schedule_workout again later to extend.` } : {}),
    };
}

/**
 * Safety net for entries about to read as "missed": if a workout session was
 * logged the same day with an activity_type matching the entry's template name
 * (or title), link it and mark the entry completed instead. Mutates `rows`.
 */
async function autoLinkStaleEntries(
    userId: string,
    rows: {
        id: string;
        scheduled_date: string;
        title: string;
        status: string;
        completed_workout_id: string | null;
        template: { name: string } | null;
    }[],
    today: string,
) {
    const stale = rows.filter(w =>
        (w.status === 'scheduled' || w.status === 'rescheduled') && w.scheduled_date < today
    );
    if (!stale.length) return;

    const dates = [...new Set(stale.map(w => w.scheduled_date))];
    const { data: sessions, error: sessErr } = await supabaseAdmin
        .from('workouts')
        .select('id,date,activity_type')
        .eq('user_id', userId)
        .in('date', dates);
    if (sessErr || !sessions?.length) return;

    // Don't re-link workouts already attached to another scheduled entry
    const { data: linked } = await supabaseAdmin
        .from('scheduled_workouts')
        .select('completed_workout_id')
        .eq('user_id', userId)
        .in('completed_workout_id', sessions.map(s => s.id));
    const used = new Set((linked ?? []).map(l => l.completed_workout_id));

    for (const w of stale) {
        const names = [w.template?.name, w.title]
            .filter((n): n is string => !!n)
            .map(n => n.toLowerCase());
        const match = sessions.find(s =>
            !used.has(s.id) &&
            s.date === w.scheduled_date &&
            names.includes((s.activity_type ?? '').toLowerCase())
        );
        if (!match) continue;

        const { error: updErr } = await supabaseAdmin
            .from('scheduled_workouts')
            .update({ status: 'completed', completed_workout_id: match.id, updated_at: new Date().toISOString() })
            .eq('id', w.id)
            .eq('user_id', userId);
        if (updErr) continue;

        used.add(match.id);
        w.status = 'completed';
        w.completed_workout_id = match.id;
    }
}

async function getSchedule(userId: string, args: Record<string, unknown>, today: string) {
    const start = args.start_date != null ? assertDate(args.start_date, 'start_date') : today;
    const end   = args.end_date   != null ? assertDate(args.end_date, 'end_date')
                                          : format(addDays(new Date(start + 'T00:00:00'), 6), 'yyyy-MM-dd');
    if (end < start) throw new Error(`end_date (${end}) is before start_date (${start}).`);

    const { data, error } = await supabaseAdmin
        .from('scheduled_workouts')
        .select(`
            id,scheduled_date,scheduled_time,title,notes,status,skipped_reason,use_fallback,
            completed_workout_id,duration_minutes,template_id,
            template:workout_templates(id,name,exercises,fallback_exercises)
        `)
        .eq('user_id', userId)
        .gte('scheduled_date', start)
        .lte('scheduled_date', end)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });
    if (error) throw error;

    interface ScheduleRow {
        id: string;
        scheduled_date: string;
        scheduled_time: string | null;
        title: string;
        notes: string | null;
        status: string;
        skipped_reason: string | null;
        use_fallback: boolean;
        completed_workout_id: string | null;
        duration_minutes: number | null;
        template: { id: string; name: string; exercises: unknown; fallback_exercises: unknown } | null;
    }

    const rows = (data ?? []) as unknown as ScheduleRow[];
    await autoLinkStaleEntries(userId, rows, today);

    const mapped = rows.map(w => ({
        id:                   w.id,
        date:                 w.scheduled_date,
        time:                 w.scheduled_time?.slice(0, 5),
        title:                w.title,
        status:               mcpStatus(w.status, w.scheduled_date, today),
        skipped_reason:       w.skipped_reason,
        notes:                w.notes,
        duration_minutes:     w.duration_minutes,
        template_name:        w.template?.name ?? null,
        using_fallback:       !!w.use_fallback,
        exercises:            w.template
            ? toMcpExercises(w.use_fallback ? w.template.fallback_exercises : w.template.exercises)
            : [],
        completed_workout_id: w.completed_workout_id,
    }));
    await attachProgression(userId, mapped.flatMap(m => m.exercises));
    return mapped;
}

async function updateScheduledWorkoutTool(userId: string, args: Record<string, unknown>, today: string) {
    const id = args.scheduled_workout_id as string;
    if (!id) throw new Error('scheduled_workout_id is required — get it from get_schedule.');

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (args.new_date != null) patch.scheduled_date = assertDate(args.new_date, 'new_date');
    if (args.new_time != null) patch.scheduled_time = assertTime(args.new_time, 'new_time');
    if (args.notes    != null) patch.notes = args.notes;
    if (args.use_fallback != null) patch.use_fallback = !!args.use_fallback;

    if (args.template_name != null) {
        const tpl = await findTemplateByName(userId, args.template_name as string);
        patch.template_id = tpl.id;
        patch.title       = tpl.name;
    }

    if (args.status != null) {
        const status = args.status as string;
        if (status === 'skipped') {
            patch.status = 'skipped';
            patch.skipped_reason = (args.reason as string) ?? null;
        } else if (status === 'planned') {
            patch.status = 'scheduled';
            patch.skipped_reason = null;
        } else {
            throw new Error(`status must be "planned" or "skipped", got "${status}". Completion happens automatically via log_workout.`);
        }
    } else if (args.reason != null) {
        throw new Error('reason is only used together with status: "skipped".');
    }

    if (Object.keys(patch).length === 1) {
        throw new Error('Nothing to update — pass at least one of new_date, new_time, template_name, use_fallback, status, or notes.');
    }

    const { data, error } = await supabaseAdmin
        .from('scheduled_workouts')
        .update(patch)
        .eq('id', id)
        .eq('user_id', userId)
        .select('id,scheduled_date,scheduled_time,title,status,skipped_reason,use_fallback,notes')
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Scheduled workout "${id}" not found. Use get_schedule to list entries and their ids.`);

    return {
        updated: {
            id:             data.id,
            date:           data.scheduled_date,
            time:           data.scheduled_time?.slice(0, 5),
            title:          data.title,
            status:         mcpStatus(data.status, data.scheduled_date, today),
            skipped_reason: data.skipped_reason,
            using_fallback: !!data.use_fallback,
            notes:          data.notes,
        },
    };
}

// ─── COACH TOOLS: MEALS & MEAL PLAN ────────────────────────────────────────────

/** Fetch the user's meals and find one by name (case-insensitive). Throws with the available names. */
async function findMealByName(userId: string, name: string) {
    const { data, error } = await supabaseAdmin
        .from('mcp_meals')
        .select('id,name,calories,protein,carbs,fat')
        .eq('user_id', userId);
    if (error) throw error;

    const meals = data ?? [];
    const match = meals.find(m => m.name.toLowerCase() === name.trim().toLowerCase());
    if (!match) {
        const names = meals.map(m => `"${m.name}"`).join(', ') || 'none';
        throw new Error(`Meal "${name}" not found. Available meals: ${names}. Create it first with save_meal.`);
    }
    return match;
}

async function saveMeal(userId: string, args: Record<string, unknown>) {
    const name = (args.name as string)?.trim();
    if (!name) throw new Error('name is required, e.g. "Fajita chicken bowl"');
    if (args.calories == null) throw new Error('calories is required');

    const { data: existing, error: findErr } = await supabaseAdmin
        .from('mcp_meals')
        .select('id,name')
        .eq('user_id', userId);
    if (findErr) throw findErr;

    const match = (existing ?? []).find(m => m.name.toLowerCase() === name.toLowerCase());
    const fields = {
        name,
        description: (args.description as string) ?? null,
        calories:    args.calories as number,
        protein:     (args.protein as number) ?? 0,
        carbs:       (args.carbs   as number) ?? 0,
        fat:         (args.fat     as number) ?? 0,
        tags:        Array.isArray(args.tags)        ? args.tags        : [],
        ingredients: Array.isArray(args.ingredients)  ? args.ingredients : [],
        updated_at:  new Date().toISOString(),
    };

    if (match) {
        const { data, error } = await supabaseAdmin
            .from('mcp_meals')
            .update(fields)
            .eq('id', match.id)
            .eq('user_id', userId)
            .select('id,name')
            .single();
        if (error) throw error;
        return { action: 'updated', meal_id: data.id, name: data.name };
    }

    const { data, error } = await supabaseAdmin
        .from('mcp_meals')
        .insert({ ...fields, user_id: userId })
        .select('id,name')
        .single();
    if (error) throw error;
    return { action: 'created', meal_id: data.id, name: data.name };
}

async function getMeals(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('mcp_meals')
        .select('id,name,description,calories,protein,carbs,fat,tags,ingredients,updated_at')
        .eq('user_id', userId)
        .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
}

async function planMeal(userId: string, args: Record<string, unknown>) {
    const startDate = assertDate(args.date, 'date');
    const slot      = assertSlot(args.slot);
    const time      = args.time != null ? assertTime(args.time, 'time') : null;

    const mealName = args.meal_name as string | undefined;
    const adhocName = args.name as string | undefined;
    if (!!mealName === !!adhocName) {
        throw new Error('Pass exactly one of meal_name (a saved meal) or name (an ad-hoc meal, with calories).');
    }

    let mealId: string | null = null;
    let name: string;
    let calories: number, protein: number, carbs: number, fat: number;
    if (mealName) {
        const meal = await findMealByName(userId, mealName);
        mealId   = meal.id;
        name     = meal.name;
        calories = meal.calories;
        protein  = meal.protein;
        carbs    = meal.carbs;
        fat      = meal.fat;
    } else {
        if (args.calories == null) throw new Error('calories is required for an ad-hoc meal (name without meal_name).');
        name     = adhocName!;
        calories = args.calories as number;
        protein  = (args.protein as number) ?? 0;
        carbs    = (args.carbs   as number) ?? 0;
        fat      = (args.fat     as number) ?? 0;
    }

    // Expand the date list: single date, or recurrence pattern capped at 90 days
    let dates = [startDate];
    let truncated = false;
    const recurrence = args.recurrence as { days_of_week?: unknown; until?: unknown } | undefined;
    if (recurrence) {
        const days = recurrence.days_of_week;
        if (!Array.isArray(days) || !days.length) {
            throw new Error('recurrence.days_of_week must be a non-empty array of weekdays, e.g. ["mon", "wed", "fri"]');
        }
        const invalid = days.filter(d => !DOW.includes(d as string));
        if (invalid.length) {
            throw new Error(`Invalid days_of_week: ${invalid.join(', ')}. Use: mon, tue, wed, thu, fri, sat, sun.`);
        }
        const until = assertDate(recurrence.until, 'recurrence.until');
        if (until < startDate) throw new Error(`recurrence.until (${until}) is before the start date (${startDate}).`);

        const capEnd = format(addDays(new Date(startDate + 'T00:00:00'), RECURRENCE_CAP_DAYS), 'yyyy-MM-dd');
        truncated = until > capEnd;
        const end  = truncated ? capEnd : until;

        dates = [];
        for (let d = new Date(startDate + 'T00:00:00'); format(d, 'yyyy-MM-dd') <= end; d = addDays(d, 1)) {
            if (days.includes(DOW[d.getDay()])) dates.push(format(d, 'yyyy-MM-dd'));
        }
        if (!dates.length) {
            throw new Error(`No matching weekdays between ${startDate} and ${end} for days_of_week [${days.join(', ')}].`);
        }
    }

    const rows = dates.map(d => ({
        user_id:        userId,
        meal_id:        mealId,
        name,
        calories, protein, carbs, fat,
        scheduled_date: d,
        slot,
        scheduled_time: time,
        notes:          (args.notes as string) ?? null,
        status:         'planned',
    }));

    const { data, error } = await supabaseAdmin
        .from('planned_meals')
        .insert(rows)
        .select('id,scheduled_date');
    if (error) throw error;

    return {
        scheduled_count: data?.length ?? rows.length,
        meal_name: name,
        slot,
        dates: (data ?? []).map(r => r.scheduled_date),
        entries: data ?? [],
        ...(truncated ? { note: `Recurrence capped at ${RECURRENCE_CAP_DAYS} days from ${startDate}; dates after that were not scheduled. Call plan_meal again later to extend.` } : {}),
    };
}

async function getMealPlan(userId: string, args: Record<string, unknown>, today: string) {
    const start = args.start_date != null ? assertDate(args.start_date, 'start_date') : today;
    const end   = args.end_date   != null ? assertDate(args.end_date, 'end_date')
                                          : format(addDays(new Date(start + 'T00:00:00'), 6), 'yyyy-MM-dd');
    if (end < start) throw new Error(`end_date (${end}) is before start_date (${start}).`);

    const { data, error } = await supabaseAdmin
        .from('planned_meals')
        .select('id,scheduled_date,scheduled_time,slot,name,calories,protein,carbs,fat,notes,status,skipped_reason,linked_food_log_id,actual_calories,actual_protein,actual_carbs,actual_fat')
        .eq('user_id', userId)
        .gte('scheduled_date', start)
        .lte('scheduled_date', end)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });
    if (error) throw error;

    interface PlannedMealRow {
        id: string;
        scheduled_date: string;
        scheduled_time: string | null;
        slot: string;
        name: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        notes: string | null;
        status: string;
        skipped_reason: string | null;
        linked_food_log_id: string | null;
        actual_calories: number | null;
        actual_protein: number | null;
        actual_carbs: number | null;
        actual_fat: number | null;
    }

    const byDate = new Map<string, PlannedMealRow[]>();
    for (const m of (data ?? [])) {
        const list = byDate.get(m.scheduled_date) ?? [];
        list.push(m);
        byDate.set(m.scheduled_date, list);
    }

    const zeroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const days = [];
    for (let d = new Date(start + 'T00:00:00'); format(d, 'yyyy-MM-dd') <= end; d = addDays(d, 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        const entries = byDate.get(dateStr) ?? [];

        const plannedTotals = entries
            .filter(e => e.status !== 'skipped')
            .reduce((a, e) => ({
                calories: a.calories + (e.calories ?? 0),
                protein:  a.protein  + (e.protein  ?? 0),
                carbs:    a.carbs    + (e.carbs    ?? 0),
                fat:      a.fat      + (e.fat      ?? 0),
            }), { ...zeroTotals });

        const loggedTotals = entries
            .filter(e => e.status === 'logged')
            .reduce((a, e) => ({
                calories: a.calories + (e.actual_calories ?? e.calories ?? 0),
                protein:  a.protein  + (e.actual_protein  ?? e.protein  ?? 0),
                carbs:    a.carbs    + (e.actual_carbs    ?? e.carbs    ?? 0),
                fat:      a.fat      + (e.actual_fat      ?? e.fat      ?? 0),
            }), { ...zeroTotals });

        days.push({
            date: dateStr,
            entries: entries.map(e => ({
                id:                   e.id,
                date:                 dateStr,
                slot:                 e.slot,
                time:                 e.scheduled_time?.slice(0, 5) ?? null,
                meal_name:            e.name,
                calories:             e.calories,
                protein:              e.protein,
                carbs:                e.carbs,
                fat:                  e.fat,
                status:               e.status,
                skipped_reason:       e.skipped_reason,
                notes:                e.notes,
                linked_food_log_id:   e.linked_food_log_id,
            })),
            planned_totals: plannedTotals,
            logged_totals:  loggedTotals,
        });
    }

    return days;
}

async function updatePlannedMeal(userId: string, args: Record<string, unknown>) {
    const id = args.planned_meal_id as string;
    if (!id) throw new Error('planned_meal_id is required — get it from get_meal_plan.');

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (args.new_date != null) patch.scheduled_date = assertDate(args.new_date, 'new_date');
    if (args.new_slot != null) patch.slot = assertSlot(args.new_slot);
    if (args.new_time != null) patch.scheduled_time = assertTime(args.new_time, 'new_time');
    if (args.notes    != null) patch.notes = args.notes;

    if (args.meal_name != null) {
        const meal = await findMealByName(userId, args.meal_name as string);
        patch.meal_id  = meal.id;
        patch.name     = meal.name;
        patch.calories = meal.calories;
        patch.protein  = meal.protein;
        patch.carbs    = meal.carbs;
        patch.fat      = meal.fat;
    }

    if (args.status != null) {
        const status = args.status as string;
        if (status === 'skipped') {
            patch.status = 'skipped';
            patch.skipped_reason = (args.reason as string) ?? null;
        } else if (status === 'planned') {
            patch.status = 'planned';
            patch.skipped_reason = null;
        } else {
            throw new Error(`status must be "planned" or "skipped", got "${status}". Logging happens automatically via log_food / log_planned_meal.`);
        }
    } else if (args.reason != null) {
        throw new Error('reason is only used together with status: "skipped".');
    }

    if (Object.keys(patch).length === 1) {
        throw new Error('Nothing to update — pass at least one of new_date, new_slot, new_time, meal_name, status, or notes.');
    }

    const { data, error } = await supabaseAdmin
        .from('planned_meals')
        .update(patch)
        .eq('id', id)
        .eq('user_id', userId)
        .select('id,scheduled_date,scheduled_time,slot,name,status,skipped_reason,notes')
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Planned meal "${id}" not found. Use get_meal_plan to list entries and their ids.`);

    return {
        updated: {
            id:             data.id,
            date:           data.scheduled_date,
            time:           data.scheduled_time?.slice(0, 5) ?? null,
            slot:           data.slot,
            meal_name:      data.name,
            status:         data.status,
            skipped_reason: data.skipped_reason,
            notes:          data.notes,
        },
    };
}

async function updateDailyLog(userId: string, args: Record<string, unknown>, today: string) {
    const date = (args.date as string) ?? today;
    const patch: Record<string, unknown> = { user_id: userId, date, updated_at: new Date().toISOString() };

    if (args.sleep_quality  != null) patch.sleep_quality  = Math.min(5, Math.max(1, args.sleep_quality  as number));
    if (args.energy_level   != null) patch.energy_level   = Math.min(5, Math.max(1, args.energy_level   as number));
    if (args.alcohol_drinks != null) patch.alcohol_drinks = args.alcohol_drinks;
    if (args.daily_note     != null) patch.daily_note     = args.daily_note;

    const { error } = await supabaseAdmin
        .from('daily_logs')
        .upsert(patch, { onConflict: 'user_id,date' });

    if (error) throw error;
    return {
        updated: date,
        fields: Object.keys(patch).filter(k => !['user_id', 'date', 'updated_at'].includes(k)),
    };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return rpcError(null, -32700, 'Parse error');
    }

    const { jsonrpc, id, method, params } = body as any;

    if (jsonrpc !== '2.0') {
        return rpcError(id ?? null, -32600, 'Invalid Request: jsonrpc must be "2.0"');
    }

    // initialize — no auth required (capability discovery)
    if (method === 'initialize') {
        return ok(id, {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'FitnessTracker', version: '1.0.0' },
        });
    }

    // Notifications have no id and need no response
    if (id === undefined || id === null) {
        return new NextResponse(null, { status: 202, headers: corsHeaders() });
    }

    // All other methods require a valid API key
    const userId = await validateKey(extractKey(req));
    if (!userId) {
        return rpcError(id, -32001, 'Unauthorized: invalid or missing API key');
    }

    try {
        // ── tools/list ──
        if (method === 'tools/list') {
            return ok(id, { tools: TOOLS });
        }

        // ── tools/call ──
        if (method === 'tools/call') {
            const name = (params as any)?.name as string;
            const args = ((params as any)?.arguments ?? {}) as Record<string, unknown>;

            // "Today" in the user's timezone — date defaults must not roll over on the server's UTC clock
            const today = await todayFor(userId);

            let result: unknown;
            switch (name) {
                case 'get_daily_logs':   result = await getDailyLogs(userId, args, today);   break;
                case 'get_workouts':     result = await getWorkouts(userId, args, today);     break;
                case 'get_body_metrics': result = await getBodyMetrics(userId, args, today);  break;
                case 'get_user_profile': result = await getUserProfile(userId);        break;
                case 'get_readiness':    result = await getReadiness(userId, today);   break;
                case 'log_food':         result = await logFood(userId, args, today);         break;
                case 'log_workout':      result = await logWorkout(userId, args, today);      break;
                case 'update_daily_log': result = await updateDailyLog(userId, args, today);  break;
                case 'save_workout_template':    result = await saveWorkoutTemplate(userId, args);       break;
                case 'get_workout_templates':    result = await getWorkoutTemplates(userId);             break;
                case 'schedule_workout':         result = await scheduleWorkoutTool(userId, args);       break;
                case 'get_schedule':             result = await getSchedule(userId, args, today);               break;
                case 'update_scheduled_workout': result = await updateScheduledWorkoutTool(userId, args, today); break;
                case 'save_meal':          result = await saveMeal(userId, args);          break;
                case 'get_meals':          result = await getMeals(userId);                break;
                case 'plan_meal':          result = await planMeal(userId, args);           break;
                case 'get_meal_plan':      result = await getMealPlan(userId, args, today);        break;
                case 'update_planned_meal': result = await updatePlannedMeal(userId, args); break;
                case 'log_planned_meal':   result = await logPlannedMeal(userId, args, today);     break;
                default:
                    return rpcError(id, -32601, `Unknown tool: ${name}`);
            }

            return ok(id, toolResult(result));
        }

        return rpcError(id, -32601, `Method not found: ${method}`);
    } catch (err: any) {
        console.error('[MCP] Tool error:', err);
        return ok(id, toolResult(`Error: ${err.message}`, true));
    }
}

// SSE endpoint — return a minimal event stream so clients that open GET don't hang
export async function GET(req: NextRequest) {
    const userId = await validateKey(extractKey(req));
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(': ping\n\n'));
            setTimeout(() => controller.close(), 200);
        },
    });

    return new NextResponse(stream, {
        headers: {
            ...corsHeaders(),
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
        },
    });
}
