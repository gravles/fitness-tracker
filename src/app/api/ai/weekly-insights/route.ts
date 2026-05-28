
import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyInsights } from '@/lib/ai';

// Allow up to 60 seconds for the AI to generate insights
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { logs, lang } = body;

        if (!logs || !Array.isArray(logs)) {
            return NextResponse.json({ error: "Invalid logs data" }, { status: 400 });
        }

        // Sort by date ascending and take the last 7 days
        const sorted = [...logs].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const recentLogs = sorted.slice(-7);

        if (recentLogs.length === 0) {
            return NextResponse.json({ error: "No log data available for analysis" }, { status: 400 });
        }

        const insights = await generateWeeklyInsights(recentLogs, lang);
        return NextResponse.json(insights);

    } catch (error: any) {
        console.error('Error generating insights:', error);
        return NextResponse.json({ error: error.message || "Failed to generate insights" }, { status: 500 });
    }
}
