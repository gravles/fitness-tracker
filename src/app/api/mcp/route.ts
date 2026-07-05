import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { format, subDays, addDays } from 'date-fns';

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
        name: 'log_food',
        description: "Add a food item to the user's daily nutrition log.",
        inputSchema: {
            type: 'object',
            required: ['name', 'calories'],
            properties: {
                name:     { type: 'string', description: 'Food or meal name' },
                calories: { type: 'number', description: 'Calories (kcal)' },
                protein:  { type: 'number', description: 'Protein in grams' },
                carbs:    { type: 'number', description: 'Carbohydrates in grams' },
                fat:      { type: 'number', description: 'Fat in grams' },
                date:     { type: 'string', description: 'Date YYYY-MM-DD. Defaults to today.' },
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
function mcpStatus(dbStatus: string, scheduledDate: string): string {
    if (dbStatus === 'completed') return 'completed';
    if (dbStatus === 'skipped')   return 'skipped';
    return scheduledDate < todayStr() ? 'missed' : 'planned';
}

// ─── TOOL HANDLERS ────────────────────────────────────────────────────────────

async function getDailyLogs(userId: string, args: Record<string, unknown>) {
    const start = (args.start_date as string) ?? format(subDays(new Date(), 7), 'yyyy-MM-dd');
    const end   = (args.end_date   as string) ?? todayStr();

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

async function getWorkouts(userId: string, args: Record<string, unknown>) {
    const start = (args.start_date as string) ?? format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const end   = (args.end_date   as string) ?? todayStr();

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
        .select('id,workout_id,name,order_index')
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
                name: ex.name,
                sets: (sets ?? [])
                    .filter(s => s.exercise_id === ex.id)
                    .map(s => ({ set: s.set_number, weight: s.weight, reps: s.reps, completed: s.completed })),
            })),
        };
    });
}

async function getBodyMetrics(userId: string, args: Record<string, unknown>) {
    const days  = Math.min((args.days as number) ?? 90, 365);
    const start = format(subDays(new Date(), days), 'yyyy-MM-dd');

    const { data, error } = await supabaseAdmin
        .from('body_metrics')
        .select('date,weight,measurements')
        .eq('user_id', userId)
        .gte('date', start)
        .order('date', { ascending: false });

    if (error) throw error;
    return data ?? [];
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

async function logFood(userId: string, args: Record<string, unknown>) {
    const date = (args.date as string) ?? todayStr();
    const item = {
        name:     args.name    as string,
        calories: (args.calories as number) ?? 0,
        protein:  (args.protein  as number) ?? 0,
        carbs:    (args.carbs    as number) ?? 0,
        fat:      (args.fat      as number) ?? 0,
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

    return { logged: item, day_totals: totals };
}

async function logWorkout(userId: string, args: Record<string, unknown>) {
    const date = args.date != null ? assertDate(args.date, 'date') : todayStr();

    const { data, error } = await supabaseAdmin
        .from('workouts')
        .insert({
            user_id:       userId,
            date,
            activity_type: args.activity_type as string,
            duration:      (args.duration_mins as number) ?? 45,
            intensity:     (args.intensity     as string) ?? 'Moderate',
            calories:      (args.calories as number) ?? null,
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

    return (data ?? []).map(t => ({
        id:                 t.id,
        name:               t.name,
        description:        t.description,
        exercises:          toMcpExercises(t.exercises),
        fallback_exercises: toMcpExercises(t.fallback_exercises),
        estimated_duration: t.estimated_duration,
        updated_at:         t.updated_at,
    }));
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

async function getSchedule(userId: string, args: Record<string, unknown>) {
    const start = args.start_date != null ? assertDate(args.start_date, 'start_date') : todayStr();
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

    return ((data ?? []) as unknown as ScheduleRow[]).map(w => ({
        id:                   w.id,
        date:                 w.scheduled_date,
        time:                 w.scheduled_time?.slice(0, 5),
        title:                w.title,
        status:               mcpStatus(w.status, w.scheduled_date),
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
}

async function updateScheduledWorkoutTool(userId: string, args: Record<string, unknown>) {
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
            status:         mcpStatus(data.status, data.scheduled_date),
            skipped_reason: data.skipped_reason,
            using_fallback: !!data.use_fallback,
            notes:          data.notes,
        },
    };
}

async function updateDailyLog(userId: string, args: Record<string, unknown>) {
    const date = (args.date as string) ?? todayStr();
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

            let result: unknown;
            switch (name) {
                case 'get_daily_logs':   result = await getDailyLogs(userId, args);   break;
                case 'get_workouts':     result = await getWorkouts(userId, args);     break;
                case 'get_body_metrics': result = await getBodyMetrics(userId, args);  break;
                case 'get_user_profile': result = await getUserProfile(userId);        break;
                case 'log_food':         result = await logFood(userId, args);         break;
                case 'log_workout':      result = await logWorkout(userId, args);      break;
                case 'update_daily_log': result = await updateDailyLog(userId, args);  break;
                case 'save_workout_template':    result = await saveWorkoutTemplate(userId, args);       break;
                case 'get_workout_templates':    result = await getWorkoutTemplates(userId);             break;
                case 'schedule_workout':         result = await scheduleWorkoutTool(userId, args);       break;
                case 'get_schedule':             result = await getSchedule(userId, args);               break;
                case 'update_scheduled_workout': result = await updateScheduledWorkoutTool(userId, args); break;
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
