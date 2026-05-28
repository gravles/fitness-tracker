import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';
import { format, subDays } from 'date-fns';

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
        description: 'Log a cardio or manual workout session.',
        inputSchema: {
            type: 'object',
            required: ['activity_type', 'duration_mins', 'intensity'],
            properties: {
                activity_type: { type: 'string', description: 'e.g. Running, Cycling, Swimming, Gym' },
                duration_mins: { type: 'number', description: 'Duration in minutes' },
                intensity:     { type: 'string', enum: ['Light', 'Moderate', 'Hard'] },
                calories:      { type: 'number', description: 'Estimated calories burned (optional)' },
                notes:         { type: 'string', description: 'Optional notes' },
                date:          { type: 'string', description: 'Date YYYY-MM-DD. Defaults to today.' },
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
    const date = (args.date as string) ?? todayStr();

    const { data, error } = await supabaseAdmin
        .from('workouts')
        .insert({
            user_id:       userId,
            date,
            activity_type: args.activity_type as string,
            duration:      args.duration_mins  as number,
            intensity:     args.intensity      as string,
            calories:      (args.calories as number) ?? null,
            notes:         (args.notes    as string) ?? null,
            source:        'manual',
        })
        .select()
        .single();

    if (error) throw error;

    // Mark the day as having movement
    await supabaseAdmin
        .from('daily_logs')
        .upsert(
            { user_id: userId, date, movement_completed: true, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,date' }
        );

    return data;
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
