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
        Return ONLY a JSON object with the following structure:
        {
          "name": "Short descriptive name of the food",
          "calories": number (estimated total calories),
          "protein": number (grams),
          "carbs": number (grams),
          "fat": number (grams),
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
        if (lower.includes('log') || lower.includes('eat') || lower.includes('ate')) {
            return {
                intent: 'log_food',
                data: {
                    items: [{ name: "Mock Food Item", calories: 150, protein: 5, carbs: 20, fat: 5 }]
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
                - If the user describes food, intent="log_food". Return data={"items": [{ "name": "food name", "calories": number, "protein": number, "carbs": number, "fat": number }]}. ESTIMATE macros.
                - If the user describes exercise, intent="log_workout". Return data={"activity": "name", "duration": number_minutes, "intensity": "Light"|"Moderate"|"Hard"}.
                - If unknown, intent="unknown".

                Output Example:
                { "intent": "log_food", "data": { "items": [{ "name": "Apple", "calories": 95, "protein": 0.5, "carbs": 25, "fat": 0.3 }] } }`
            },
            { role: "user", content: transcript }
        ],
        response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const result = content ? JSON.parse(content) : { intent: 'unknown' };

    // Always attach the original text so we have a fallback
    return { ...result, original: transcript };
}
