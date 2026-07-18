import { NextRequest, NextResponse } from 'next/server';
import { chatWithCoach } from '@/lib/ai';
import { getMonthlyLogs, getSettings } from '@/lib/api';
import { subDays, format } from 'date-fns';
import { authenticateRequest } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
    try {
        const userId = await authenticateRequest(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { messages, context, lang } = body;

        // 2. Call AI with provided context
        // Ensure context exists to avoid crashes
        const safeContext = context || { recentLogs: [], userSettings: {}, templates: [] };

        const lastUserMessage = messages[messages.length - 1].content;
        const history = messages.slice(0, -1);

        const reply = await chatWithCoach(history, lastUserMessage, safeContext, lang);

        return NextResponse.json(reply);

    } catch (error: any) {
        console.error('Coach API Error:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
