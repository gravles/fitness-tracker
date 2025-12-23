import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
    if (!process.env.OPENAI_API_KEY) {
        // Mock response for testing without key
        return new Promise(resolve => setTimeout(() => resolve({
            name: "Mock Salad (No API Key)",
            calories: 350,
            protein: 12,
            carbs: 20,
            fat: 25,
            confidence: 0.99
        }), 2000));
    }

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `You are a nutritionist AI. Analyze the food image and estimate the nutritional content.
        
        Rules for Portion Estimation:
        - If showing a PREPARED MEAL (e.g., plate of food), estimate for the ENTIRE visible amount. Set portion_estimate to "1 plate" or "1 bowl".
        - If showing a PACKAGED ITEM (e.g., box of cookies, whole cake), estimate for the FULL container/unit if possible, or a clear standard serving, so the user can scale down (e.g., portion_estimate: "1 box" or "1 cake").
        
        Rules for Alcohol:
        - If the item is an alcoholic drink, estimate the number of STANDARD DRINKS (e.g., 1 beer = 1, 1 glass wine = 1, 1 shot = 1, 1 martini = 1.5). Return as "alcohol_units".
        
        Return ONLY a JSON object with the following structure:
        {
          "name": "Short descriptive name of the food",
          "portion_estimate": "e.g., '1 slice', '1 bowl', '1 box'",
          "calories": number (estimated calories per portion),
          "protein": number (grams),
          "carbs": number (grams),
          "fat": number (grams),
          "alcohol_units": number (OPTIONAL, only for alcohol),
          "confidence": number (0-1, how sure are you)
        }`
            },
            {
                role: "user",
                content: [
                    { type: "text", text: "Analyze this meal." },
                    {
                        type: "image_url",
                        image_url: {
                            "url": base64Image,
                        },
                    },
                ],
            },
        ],
        response_format: { type: "json_object" },
        max_tokens: 300,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No analysis received");

    return JSON.parse(content) as FoodAnalysis;
}

export async function processVoiceIntent(transcript: string) {
    if (!process.env.OPENAI_API_KEY) {
        // Simple mock parser
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

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You are a fitness logger assistant. Extract the intent and data. Return valid JSON.
                
                Rules:
                - If the user describes food/drink, intent="log_food". Return data={"items": [{ "name": "name", "calories": number, "protein": number, "carbs": number, "fat": number, "alcohol_units": number }]}. 
                  - ESTIMATE macros. 
                  - ESTIMATE "alcohol_units" for alcoholic drinks (1 beer/wine/shot = 1 unit).
                - If the user describes exercise, intent="log_workout". Return data={"activity": "name", "duration": number_minutes, "intensity": "Light"|"Moderate"|"Hard"}.
                - If unknown, intent="unknown".

                Output Example:
                { "intent": "log_food", "data": { "items": [{ "name": "Beer", "calories": 150, "protein": 1, "carbs": 12, "fat": 0, "alcohol_units": 1 }] } }`
            },
            { role: "user", content: transcript }
        ],
        response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    let result;
    try {
        result = content ? JSON.parse(content) : { intent: 'unknown' };
    } catch (e) {
        console.error("Failed to parse AI response", content);
        result = { intent: 'unknown', error: 'Failed to parse intent' };
    }

    // Always attach the original text so we have a fallback
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
    if (!process.env.OPENAI_API_KEY) {
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

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `You are a nutritionist assistant. Analyze the restaurant menu image.
                Identify the TOP 3 healthiest, high-protein options. AVOID deep fried items or heavy cream sauces if possible.
                
                For each option, ESTIMATE the nutritional content for a standard serving size.
                
                Return ONLY a JSON object with this structure:
                {
                    "recommendations": [
                        {
                            "name": "Exact item name from menu",
                            "description": "Brief description",
                            "reason": "Why is this a good choice? (e.g. High protein, balanced)",
                            "calories": number,
                            "protein": number,
                            "carbs": number,
                            "fat": number
                        }
                    ]
                }`
            },
            {
                role: "user",
                content: [
                    { type: "text", text: "Find the best high-protein meals." },
                    { type: "image_url", image_url: { "url": base64Image } }
                ]
            }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
    });


    const content = response.choices[0].message.content;
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
}

export async function chatWithTrainer(state: WorkoutChatState, newUserInput: string): Promise<WorkoutChatState> {
    if (!process.env.OPENAI_API_KEY) {
        // Mock response for testing
        return {
            history: [...state.history, { role: 'user', content: newUserInput }, { role: 'assistant', content: "[DEV] I'm in mock mode because no API key is set. I'll just log a generic run." }],
            status: 'completed',
            missing_fields: [],
            reply: "[DEV] Mock mode: I've logged a 30-min Moderate Run (300 kcal) for you.",
            workoutData: { activity_type: 'Mock Run', duration: 30, intensity: 'Moderate', calories: 300, muscles: ['Legs', 'Cardio'] }
        };
    }

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
                "reply": "Your conversational response to the user",
                "status": "continue" | "completed",
                "missing_fields": ["duration", "intensity", ...],
                "workout_data": { 
                    "activity_type": string, 
                    "duration": number, 
                    "intensity": "Light"|"Moderate"|"Hard",
                    "calories": number (estimated),
                    "muscles": string[] (e.g. ["Quads", "Cardio"])
                }
            }`
        },
        ...state.history.map(m => ({ role: m.role as any, content: m.content })),
        { role: "user", content: newUserInput }
    ];

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages as any,
        response_format: { type: "json_object" },
        max_tokens: 300
    });

    const content = response.choices[0].message.content;
    const result = content ? JSON.parse(content) : { reply: "Error", status: "continue" };

    return {
        history: [...state.history, { role: 'user', content: newUserInput }, { role: 'assistant', content: result.reply }],
        workoutData: result.workout_data || state.workoutData,
        missing_fields: result.missing_fields || [],
        status: result.status || 'continue',
        reply: result.reply
    };
}
