import { NextRequest, NextResponse } from 'next/server';
import { analyzeFoodImage } from '@/lib/ai';

export async function POST(req: NextRequest) {
    try {
        const { image } = await req.json();

        if (!image) {
            return NextResponse.json({ error: 'Image is required' }, { status: 400 });
        }

        const analysis = await analyzeFoodImage(image);
        return NextResponse.json(analysis);

    } catch (error: any) {
        console.error('AI Analysis Error:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to analyze food'
        }, { status: 500 });
    }
}
