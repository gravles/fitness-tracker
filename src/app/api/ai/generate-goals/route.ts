import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
    try {
        const { goalType, currentWeight, currentBodyFat, targetValue, targetDate } = await request.json();

        const weeksUntilTarget = Math.max(1, Math.ceil(
            (new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)
        ));

        const prompt = `You are a certified fitness and nutrition coach. Generate a personalized plan based on these details:

Goal Type: ${goalType}
Current Weight: ${currentWeight || 'Unknown'} lbs
Current Body Fat: ${currentBodyFat || 'Unknown'}%
Target Weight: ${targetValue} lbs
Weeks Until Goal: ${weeksUntilTarget}

Provide recommendations in JSON format with these exact fields:
{
  "calories": <daily calorie target as number>,
  "protein": <daily protein in grams as number>,
  "carbs": <daily carbs in grams as number>,
  "fat": <daily fat in grams as number>,
  "weekly_workouts": <recommended workouts per week as number 3-6>,
  "advice": <one sentence of personalized advice>
}

Consider:
- Safe rate of weight loss is 1-2 lbs per week
- Muscle gain requires caloric surplus of 200-500 calories
- Protein should be 0.8-1g per pound of body weight for muscle building
- Be realistic and sustainable

Return ONLY valid JSON, no markdown or explanation.`;

        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = (response.content[0] as Anthropic.TextBlock).text || '';

        let recommendations;
        try {
            recommendations = JSON.parse(content);
        } catch {
            const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch) {
                recommendations = JSON.parse(jsonMatch[1]);
            } else {
                throw new Error('Failed to parse AI response');
            }
        }

        return NextResponse.json({ recommendations });

    } catch (error) {
        console.error('Goal generation error:', error);

        return NextResponse.json({
            recommendations: {
                calories: 2200,
                protein: 150,
                carbs: 200,
                fat: 70,
                weekly_workouts: 4,
                advice: 'Stay consistent with your training and nutrition for best results.',
            }
        });
    }
}
