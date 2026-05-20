import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

function extractBase64(base64Image: string): { data: string; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp" } {
    if (base64Image.startsWith('data:')) {
        const [header, data] = base64Image.split(',');
        const mediaType = (header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg') as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        return { data, media_type: mediaType };
    }
    return { data: base64Image, media_type: 'image/jpeg' };
}

export interface FoodAnalysis {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    confidence: number;
    alcohol_units?: number;
}

export async function analyzeFoodImage(base64Image: string): Promise<FoodAnalysis> {
    if (!process.env.ANTHROPIC_API_KEY) {
        return new Promise(resolve => setTimeout(() => resolve({
            name: "Mock Salad (No API Key)",
            calories: 350,
            protein: 12,
            carbs: 20,
            fat: 25,
            confidence: 0.99
        }), 2000));
    }

    const { data, media_type } = extractBase64(base64Image);

    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: `You are a nutritionist AI. Analyze the food image and estimate the nutritional content.

Rules for Portion Estimation:
- If showing a PREPARED MEAL (e.g., plate of food), estimate for the ENTIRE visible amount. Set portion_estimate to "1 plate" or "1 bowl".
- If showing a PACKAGED ITEM (e.g., box of cookies, whole cake), estimate for the FULL container/unit if possible, or a clear standard serving, so the user can scale down (e.g., portion_estimate: "1 box" or "1 cake").

Rules for Alcohol:
- If the item is an alcoholic drink, estimate the number of STANDARD DRINKS (e.g., 1 beer = 1, 1 glass wine = 1, 1 shot = 1, 1 martini = 1.5). Return as "alcohol_units".

Return ONLY a valid JSON object with this exact structure, no markdown:
{
  "name": "Short descriptive name of the food",
  "portion_estimate": "e.g., '1 slice', '1 bowl', '1 box'",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "alcohol_units": number,
  "confidence": number
}`,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image",
                        source: { type: "base64", media_type, data },
                    },
                    { type: "text", text: "Analyze this meal." },
                ],
            },
        ],
    });

    const content = (response.content[0] as Anthropic.TextBlock).text;
    if (!content) throw new Error("No analysis received");
    return JSON.parse(content) as FoodAnalysis;
}

export async function processVoiceIntent(transcript: string) {
    if (!process.env.ANTHROPIC_API_KEY) {
        const lower = transcript.toLowerCase();
        if (lower.includes('log') || lower.includes('eat') || lower.includes('ate') || lower.includes('drank') || lower.includes('drink')) {
            return {
                intent: 'log_food',
                data: {
                    items: [{ name: "Mock Food Item", calories: 150, protein: 5, carbs: 20, fat: 5, alcohol_units: lower.includes('beer') ? 1 : 0 }]
                },
                original: transcript
            };
        }
        return { intent: 'unknown', original: transcript };
    }

    const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: `You are a fitness logger assistant. Extract the intent and data from the user's message. Return ONLY valid JSON, no markdown.

Rules:
- If the user describes food/drink, intent="log_food". Return data={"items": [{ "name": "name", "calories": number, "protein": number, "carbs": number, "fat": number, "alcohol_units": number }]}.
  - ESTIMATE macros.
  - ESTIMATE "alcohol_units" for alcoholic drinks (1 beer/wine/shot = 1 unit).
- If the user describes exercise, intent="log_workout". Return data={"activity": "name", "duration": number_minutes, "intensity": "Light"|"Moderate"|"Hard"}.
- If the user describes a SET (reps/weight), intent="log_set". Return data={"exercise": "name" (optional if implied), "reps": number, "weight": number, "weight_unit": "lbs"|"kg" (default lbs)}.
- If unknown, intent="unknown".

Example: { "intent": "log_set", "data": { "reps": 12, "weight": 135, "weight_unit": "lbs" } }`,
        messages: [
            { role: "user", content: transcript },
        ],
    });

    const content = (response.content[0] as Anthropic.TextBlock).text;
    let result;
    try {
        result = content ? JSON.parse(content) : { intent: 'unknown' };
    } catch (e) {
        console.error("Failed to parse AI response", content);
        result = { intent: 'unknown', error: 'Failed to parse intent' };
    }

    return { ...result, original: transcript };
}

export interface MenuRecommendation {
    name: string;
    description: string;
    reason: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export async function scanMenu(base64Image: string): Promise<MenuRecommendation[]> {
    if (!process.env.ANTHROPIC_API_KEY) {
        return new Promise(resolve => setTimeout(() => resolve([
            {
                name: "Grilled Chicken Salad (Mock)",
                description: "Mixed greens with grilled chicken breast",
                reason: "High protein, low carb option.",
                calories: 450,
                protein: 40,
                carbs: 10,
                fat: 20
            },
            {
                name: "Salmon with Asparagus (Mock)",
                description: "Grilled salmon fillet with steamed veggies",
                reason: "Healthy fats and high protein.",
                calories: 550,
                protein: 35,
                carbs: 15,
                fat: 30
            },
            {
                name: "Lean Steak & Potatoes (Mock)",
                description: "6oz sirloin with roasted potato",
                reason: "Good balance of protein and carbs for recovery.",
                calories: 650,
                protein: 45,
                carbs: 40,
                fat: 25
            }
        ]), 2000));
    }

    const { data, media_type } = extractBase64(base64Image);

    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: `You are a nutritionist assistant. Analyze the restaurant menu image.
Identify the TOP 3 healthiest, high-protein options. AVOID deep fried items or heavy cream sauces if possible.

For each option, ESTIMATE the nutritional content for a standard serving size.

Return ONLY a valid JSON object with this exact structure, no markdown:
{
    "recommendations": [
        {
            "name": "Exact item name from menu",
            "description": "Brief description",
            "reason": "Why is this a good choice?",
            "calories": number,
            "protein": number,
            "carbs": number,
            "fat": number
        }
    ]
}`,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image",
                        source: { type: "base64", media_type, data },
                    },
                    { type: "text", text: "Find the best high-protein meals." },
                ],
            },
        ],
    });

    const content = (response.content[0] as Anthropic.TextBlock).text;
    try {
        const parsed = content ? JSON.parse(content) : { recommendations: [] };
        return parsed.recommendations || [];
    } catch (e) {
        console.error("Failed to parse menu recommendations", content);
        return [];
    }
}

export interface WorkoutChatState {
    history: { role: 'user' | 'assistant' | 'system', content: string }[];
    workoutData?: {
        activity_type?: string;
        duration?: number;
        intensity?: 'Light' | 'Moderate' | 'Hard';
        calories?: number;
        muscles?: string[];
    };
    missing_fields: string[];
    status: 'continue' | 'completed';
    reply: string;
    suggested_workout?: {
        title: string;
        exercises: { name: string; sets: number; reps: string; }[];
    };
}

export async function chatWithTrainer(state: WorkoutChatState, newUserInput: string): Promise<WorkoutChatState> {
    if (!process.env.ANTHROPIC_API_KEY) {
        return {
            history: [...state.history, { role: 'user', content: newUserInput }, { role: 'assistant', content: "[DEV] I'm in mock mode because no API key is set. I'll just log a generic run." }],
            status: 'completed',
            missing_fields: [],
            reply: "[DEV] Mock mode: I've logged a 30-min Moderate Run (300 kcal) for you.",
            workoutData: { activity_type: 'Mock Run', duration: 30, intensity: 'Moderate', calories: 300, muscles: ['Legs', 'Cardio'] }
        };
    }

<<<<<<< HEAD
    const messages = [
        {
            role: "system",
            content: `You are an energetic, encouraging AI Fitness Coach. 
            Your goal is to help the user log a workout by extracting: Activity Type, Duration (minutes), and Intensity (Light/Moderate/Hard).
            
            1. Conversational Style: Be concise, friendly, and encouraging. Ask ONE question at a time if information is missing.
            2. Estimation: Once you have the core details, ESTIMATE the calories burned and primary muscle groups worked based on the specific application of the activity and user stats (assume average if unknown).
            3. Final Output: When you have all 3 core fields (activity, duration, intensity), set status to "completed" and output the final JSON.
            
            Current known data: ${JSON.stringify(state.workoutData || {})}
            
            Return JSON ONLY:
            {
                "reply": "Your conversational response...",
                "status": "continue" | "completed",
                // "workout_data" is for LOGGING a past workout
                "workout_data": { 
                    "activity_type": "string (e.g. Running, Yoga)",
                    "duration": number (minutes, REQUIRED, cannot be null), 
                    "intensity": "Light"|"Moderate"|"Hard",
                    "calories": number (estimated total kcal, REQUIRED)
                },
                // "suggested_workout" is for PLANNING a future workout
                "suggested_workout": {
                     "title": "Workout Name",
                     "exercises": [
                         { "name": "Exercise Name", "sets": 3, "reps": "10-12" }
                     ]
                }
            }
            
            IMPORTANT: Do NOT return 'workout_data' until you have ALL fields: activity_type, duration (mins), intensity. 
            Estimated calories MUST be a number.`
        },
        ...state.history.map(m => ({ role: m.role as any, content: m.content })),
        { role: "user", content: newUserInput }
    ];
=======
    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: `You are an energetic, encouraging AI Fitness Coach.
Your goal is to help the user log a workout by extracting: Activity Type, Duration (minutes), and Intensity (Light/Moderate/Hard).
>>>>>>> 9ff9e31 (feat: Migrate AI integration from OpenAI to Anthropic SDK)

1. Conversational Style: Be concise, friendly, and encouraging. Ask ONE question at a time if information is missing.
2. Estimation: Once you have the core details, ESTIMATE the calories burned and primary muscle groups worked based on the activity and average user stats.
3. Final Output: When you have all 3 core fields (activity, duration, intensity), set status to "completed" and output the final JSON.

Current known data: ${JSON.stringify(state.workoutData || {})}

Return ONLY valid JSON, no markdown:
{
    "reply": "Your conversational response to the user",
    "status": "continue" | "completed",
    "missing_fields": ["duration", "intensity"],
    "workout_data": {
        "activity_type": string,
        "duration": number,
        "intensity": "Light"|"Moderate"|"Hard",
        "calories": number,
        "muscles": string[]
    }
}`,
        messages: [
            ...state.history
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: "user", content: newUserInput },
        ],
    });

    const content = (response.content[0] as Anthropic.TextBlock).text;
    const result = content ? JSON.parse(content) : { reply: "Error", status: "continue" };

    return {
        history: [...state.history, { role: 'user', content: newUserInput }, { role: 'assistant', content: result.reply }],
        workoutData: result.workout_data || state.workoutData,
        missing_fields: result.missing_fields || [],
        status: result.status || 'continue',
        reply: result.reply,
        suggested_workout: result.suggested_workout
    };
}

export interface WeeklyInsight {
    summary: string;
    wins: string[];
    improvements: string[];
    alcohol_analysis: string;
    nutrition_tip: string;
    workout_tip: string;
}

export async function generateWeeklyInsights(logs: any[]): Promise<WeeklyInsight> {
    if (!process.env.ANTHROPIC_API_KEY) {
        return new Promise(resolve => setTimeout(() => resolve({
            summary: "You had a solid week of consistency! Your protein intake is improving.",
            wins: ["Logged 5 days in a row", "Hit protein goal 3x"],
            improvements: ["Missed workouts on weekend", "Alcohol intake slightly high on Friday"],
            alcohol_analysis: "You consumed 5 drinks this week. Try to limit to 2-3 for better recovery.",
            nutrition_tip: "Try prepping chicken breast for quick protein access.",
            workout_tip: "Focus on leg recovery this weekend."
        }), 2000));
    }

    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: `You are an expert fitness coach and data analyst. Analyze the user's last 7 days of logs.

Data items per day: date, movement_duration (mins), intensity, calories, protein_grams, etc., alcohol_drinks, sleep_quality (1-5), energy_level (1-5), subjective notes.

Your analysis MUST include:
1. Summary: 1-2 sentences overview.
2. Wins: 2-3 bullet points of what went well.
3. Improvements: 2-3 areas to work on.
4. Alcohol Analysis: Comment on alcohol consumption patterns and its potential impact on reported sleep/energy. Be direct but non-judgmental.
5. Tips: One actionable tip for nutrition and one for workouts.

Return ONLY valid JSON, no markdown:
{
    "summary": "...",
    "wins": ["...", "..."],
    "improvements": ["...", "..."],
    "alcohol_analysis": "...",
    "nutrition_tip": "...",
    "workout_tip": "..."
}`,
        messages: [
            { role: "user", content: JSON.stringify(logs) },
        ],
    });

    const content = (response.content[0] as Anthropic.TextBlock).text;
    return content ? JSON.parse(content) : {
        summary: "Could not generate analysis.",
        wins: [],
        improvements: [],
        alcohol_analysis: "N/A",
        nutrition_tip: "N/A",
        workout_tip: "N/A"
    };
}

// --- Smart Coach Logic ---

export interface CoachContext {
    recentLogs: any[];
    recentWorkouts?: any[]; // Detailed workouts from workouts table
    userSettings: any;
    templates: any[];
}

export async function chatWithCoach(history: any[], newMessage: string, context: CoachContext) {
    if (!process.env.OPENAI_API_KEY) {
        return {
            role: 'assistant',
            content: "I'm in DEV mode (no API key). I see your data! You can ask me about your protein, workouts, or how to build a routine."
        };
    }

    const systemPrompt = `
You are an elite Fitness & Lifestyle Coach.
Current Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })}.

You have full access to the user's recent 30-day logs and settings.
Your capabilities:
1. Analysis: "Why am I tired?" (Correlate sleep, alcohol, food).
2. Planning: "Build me a workout." (Use their available equipment: ${JSON.stringify(context.userSettings?.available_equipment || [])}).
3. Motivation: tough love or gentle encouragement based on their vibe.

User Profile:
- Goal: ${context.userSettings?.target_weight ? `Reach ${context.userSettings.target_weight}lbs` : 'General Fitness'}
- Equipment: ${JSON.stringify(context.userSettings?.available_equipment || [])}
- Recent Activity: ${context.recentWorkouts?.length || context.recentLogs.filter(l => l.movement_completed).length} sessions in last 30 days.

Data Context:
1. Daily Summaries (Last 7 days):
${JSON.stringify(context.recentLogs.slice(-7))}

2. Detailed Workout History (Last 10 sessions - Strava/Manual):
${JSON.stringify((context.recentWorkouts || []).slice(-10).map(w => ({
        date: w.date,
        type: w.activity_type,
        duration: w.duration + 'm',
        dist: w.distance ? (w.distance / 1000).toFixed(2) + 'km' : null,
        hr: w.average_heartrate ? `Avg ${Math.round(w.average_heartrate)} bpm` : null,
        cals: w.calories,
        notes: w.notes
    })))}

Existing Workout Templates they have:
${JSON.stringify(context.templates.map(t => t.name))}

Rules:
- Be concise. Don't ramble.
- IF they ask for a workout, check if a template matches or build a new one using ONLY their equipment.

CRITICAL JSON STRUCTURE:
You MUST return a JSON object with this EXACT structure:
{
  "reply": "Your conversational answer here...",
  "suggested_workout": { ... } // OPTIONAL: Only include this if proposing/saving a workout
}

Example of "suggested_workout":
{
  "title": "Workout Name",
  "exercises": [ { "name": "Exercise Name", "sets": 3, "reps": "10-12" } ]
}
`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: newMessage }
        ],
        response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    let parsed;
    try {
        parsed = content ? JSON.parse(content) : { reply: "I'm having trouble thinking right now." };
    } catch (e) {
        parsed = { reply: content || "Error parsing response" };
    }

    // fallback: if AI returned the workout object directly as the root
    if (parsed.exercises && Array.isArray(parsed.exercises) && !parsed.reply) {
        parsed = {
            reply: "Here is the workout plan I built for you:",
            suggested_workout: parsed
        };
    }

    return {
        role: 'assistant',
        content: parsed.reply || parsed.message || JSON.stringify(parsed),
        suggested_workout: parsed.suggested_workout
    };
}
