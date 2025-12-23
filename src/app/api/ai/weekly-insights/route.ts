
import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyInsights } from '@/lib/ai';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { logs } = body;

        if (!logs || !Array.isArray(logs)) {
            return NextResponse.json({ error: "Invalid logs data" }, { status: 400 });
        }

        const insights = await generateWeeklyInsights(logs);
        return NextResponse.json(insights);

    } catch (error: any) {
        console.error('Error generating insights:', error);
        return NextResponse.json({ error: error.message || "Failed to generate insights" }, { status: 500 });
    }
}
