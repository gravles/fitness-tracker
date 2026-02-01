import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the AI module before importing the route
vi.mock('@/lib/ai', () => ({
    analyzeFoodImage: vi.fn(),
}));

import { POST } from '../route';
import { analyzeFoodImage } from '@/lib/ai';

const mockedAnalyzeFoodImage = vi.mocked(analyzeFoodImage);

describe('POST /api/ai/analyze-food', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function createRequest(body: object): NextRequest {
        return new NextRequest('http://localhost:3000/api/ai/analyze-food', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    it('returns 400 when no image is provided', async () => {
        const req = createRequest({});
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Image is required');
    });

    it('returns food analysis on success', async () => {
        const mockAnalysis = {
            name: 'Grilled Chicken',
            calories: 250,
            protein: 45,
            carbs: 0,
            fat: 8,
            confidence: 0.9,
        };
        mockedAnalyzeFoodImage.mockResolvedValueOnce(mockAnalysis);

        const req = createRequest({ image: 'base64-image-data' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual(mockAnalysis);
        expect(mockedAnalyzeFoodImage).toHaveBeenCalledWith('base64-image-data');
    });

    it('returns 500 on AI error', async () => {
        mockedAnalyzeFoodImage.mockRejectedValueOnce(new Error('AI service unavailable'));

        const req = createRequest({ image: 'base64-image-data' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('AI service unavailable');
    });

    it('handles unexpected errors gracefully', async () => {
        mockedAnalyzeFoodImage.mockRejectedValueOnce({ unexpected: 'error' });

        const req = createRequest({ image: 'base64-image-data' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to analyze food');
    });
});
