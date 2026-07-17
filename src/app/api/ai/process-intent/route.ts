import { NextRequest, NextResponse } from 'next/server';
import { processVoiceIntent } from '@/lib/ai';
import { authenticateRequest } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
    try {
        const userId = await authenticateRequest(req);
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { transcript } = await req.json();
        if (!transcript) return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });

        const intent = await processVoiceIntent(transcript);
        return NextResponse.json(intent);

    } catch (error: any) {
        console.error('Voice Processing Error:', error);
        return NextResponse.json({
            error: error?.message || 'Internal Error'
        }, { status: 500 });
    }
}
