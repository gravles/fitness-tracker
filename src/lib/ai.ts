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
                content: `You are a fitness logger assistant. Extract the intent and data.
                
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
