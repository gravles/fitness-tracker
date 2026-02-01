import { vi } from 'vitest';

/**
 * Mock OpenAI client for testing
 */
export const mockOpenAI = {
    chat: {
        completions: {
            create: vi.fn(),
        },
    },
};

/**
 * Helper to mock OpenAI chat completion response
 */
export function mockChatCompletion(content: string) {
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
            {
                message: {
                    content,
                },
            },
        ],
    });
}

/**
 * Helper to mock OpenAI error
 */
export function mockOpenAIError(message: string) {
    mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error(message));
}

/**
 * Sample food analysis response
 */
export const sampleFoodAnalysis = {
    name: 'Grilled Chicken Salad',
    calories: 350,
    protein: 40,
    carbs: 15,
    fat: 12,
    confidence: 0.85,
};

/**
 * Sample voice intent responses
 */
export const sampleVoiceIntents = {
    logWorkout: {
        action: 'log_workout',
        data: {
            activity_type: 'Running',
            duration: 30,
        },
    },
    logFood: {
        action: 'log_food',
        data: {
            name: 'Chicken breast',
            calories: 200,
            protein: 45,
        },
    },
    logSet: {
        action: 'log_set',
        data: {
            reps: 10,
            weight: 135,
            weight_unit: 'lbs',
        },
    },
    unknown: {
        action: 'unknown',
        message: 'Could not understand the request',
    },
};

/**
 * Sample menu recommendations
 */
export const sampleMenuRecommendations = [
    {
        name: 'Grilled Salmon',
        description: 'Atlantic salmon with vegetables',
        reason: 'High protein, omega-3 rich',
        calories: 450,
        protein: 42,
        carbs: 8,
        fat: 28,
    },
    {
        name: 'Chicken Caesar Salad',
        description: 'Romaine lettuce with grilled chicken',
        reason: 'Low carb, high protein',
        calories: 380,
        protein: 35,
        carbs: 12,
        fat: 22,
    },
];

/**
 * Sample weekly insight response
 */
export const sampleWeeklyInsight = {
    summary: 'Great week with consistent logging!',
    wins: ['Hit protein goal 5 days', 'Maintained workout streak'],
    improvements: ['Could improve hydration', 'Consider more rest days'],
    alcohol_analysis: 'Moderate consumption this week',
    nutrition_tip: 'Try adding more fiber to your meals',
    workout_tip: 'Consider progressive overload for strength gains',
};
