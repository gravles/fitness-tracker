import { NextRequest, NextResponse } from 'next/server';
import { chatWithCoach } from '@/lib/ai';
import { getMonthlyLogs, getSettings } from '@/lib/api';
import { getTemplates } from '@/lib/workout-api';
import { subDays, format } from 'date-fns';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages } = body;

        // 1. Gather Context
        const end = new Date();
        const start = subDays(end, 30);

        // Parallel Fetch for speed
        const [logs, settings, templates] = await Promise.all([
            getMonthlyLogs(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')),
            getSettings(),
            getTemplates()
        ]);

        const context = {
            recentLogs: logs,
            userSettings: settings,
            templates: templates
        };

        // 2. Call AI
        const lastUserMessage = messages[messages.length - 1].content;
        const history = messages.slice(0, -1); // send previous history

        const reply = await chatWithCoach(history, lastUserMessage, context);

        return NextResponse.json(reply);

    } catch (error: any) {
        console.error('Coach API Error:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
