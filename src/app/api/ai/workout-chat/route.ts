import { NextRequest, NextResponse } from 'next/server';
import { chatWithTrainer, WorkoutChatState } from '@/lib/ai';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { state, message } = body;

        if (!message) return NextResponse.json({ error: 'No message provided' }, { status: 400 });

        // Ensure state has defaults
        const currentState: WorkoutChatState = state || {
            history: [],
            missing_fields: [],
            status: 'continue',
            reply: ''
        };

        const newState = await chatWithTrainer(currentState, message);
        return NextResponse.json(newState);

    } catch (error: any) {
        console.error('Workout Chat Error:', error);
        return NextResponse.json({
            error: error?.message || 'Internal Error'
        }, { status: 500 });
    }
}
