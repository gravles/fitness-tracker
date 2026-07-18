import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the AI module before importing the route
vi.mock('@/lib/ai', () => ({
    scanMenu: vi.fn(),
}));

// Mock auth so route tests don't need Supabase credentials
vi.mock('@/lib/api-auth', () => ({
    authenticateRequest: vi.fn(),
}));

import { POST } from '../route';
import { scanMenu } from '@/lib/ai';
import { authenticateRequest } from '@/lib/api-auth';

const mockedScanMenu = vi.mocked(scanMenu);
const mockedAuthenticateRequest = vi.mocked(authenticateRequest);

describe('POST /api/ai/scan-menu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedAuthenticateRequest.mockResolvedValue('user-123');
    });

    function createRequest(body: object): NextRequest {
        return new NextRequest('http://localhost:3000/api/ai/scan-menu', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token',
            },
        });
    }

    it('returns 401 when unauthenticated', async () => {
        mockedAuthenticateRequest.mockResolvedValue(null);

        const req = createRequest({ image: 'base64-menu-image' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
        expect(mockedScanMenu).not.toHaveBeenCalled();
    });

    it('returns 400 when no image is provided', async () => {
        const req = createRequest({});
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('No image provided');
    });

    it('returns menu recommendations on success', async () => {
        const mockRecommendations = [
            {
                name: 'Grilled Salmon',
                description: 'Atlantic salmon with vegetables',
                reason: 'High protein, omega-3 rich',
                calories: 450,
                protein: 42,
                carbs: 8,
                fat: 28,
            },
            {
                name: 'Chicken Caesar Salad',
                description: 'Romaine lettuce with grilled chicken',
                reason: 'Low carb, high protein',
                calories: 380,
                protein: 35,
                carbs: 12,
                fat: 22,
            },
        ];
        mockedScanMenu.mockResolvedValueOnce(mockRecommendations);

        const req = createRequest({ image: 'base64-menu-image' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveLength(2);
        expect(data[0].name).toBe('Grilled Salmon');
        expect(data[1].name).toBe('Chicken Caesar Salad');
        expect(mockedScanMenu).toHaveBeenCalledWith('base64-menu-image');
    });

    it('handles empty recommendations', async () => {
        mockedScanMenu.mockResolvedValueOnce([]);

        const req = createRequest({ image: 'base64-menu-image' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual([]);
    });

    it('returns 500 on scan error', async () => {
        mockedScanMenu.mockRejectedValueOnce(new Error('Vision API error'));

        const req = createRequest({ image: 'base64-menu-image' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Vision API error');
    });

    it('handles timeout errors', async () => {
        mockedScanMenu.mockRejectedValueOnce(new Error('Request timeout'));

        const req = createRequest({ image: 'base64-menu-image' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Request timeout');
    });
});
