import { NextRequest, NextResponse } from 'next/server';
import { scanMenu } from '@/lib/ai';

export const maxDuration = 60; // Allow longer timeout for vision analysis

export async function POST(req: NextRequest) {
    try {
        const { image } = await req.json();
        if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

        const recommendations = await scanMenu(image);
        return NextResponse.json(recommendations);

    } catch (error: any) {
        console.error('Menu Scan Error:', error);
        return NextResponse.json({
            error: error?.message || 'Failed to scan menu'
        }, { status: 500 });
    }
}
