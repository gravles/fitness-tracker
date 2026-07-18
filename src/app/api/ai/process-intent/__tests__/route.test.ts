import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the AI module before importing the route
vi.mock('@/lib/ai', () => ({
    processVoiceIntent: vi.fn(),
}));

// Mock auth so route tests don't need Supabase credentials
vi.mock('@/lib/api-auth', () => ({
    authenticateRequest: vi.fn(),
}));

import { POST } from '../route';
import { processVoiceIntent } from '@/lib/ai';
import { authenticateRequest } from '@/lib/api-auth';

const mockedProcessVoiceIntent = vi.mocked(processVoiceIntent);
const mockedAuthenticateRequest = vi.mocked(authenticateRequest);

describe('POST /api/ai/process-intent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedAuthenticateRequest.mockResolvedValue('user-123');
    });

    function createRequest(body: object): NextRequest {
        return new NextRequest('http://localhost:3000/api/ai/process-intent', {
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

        const req = createRequest({ transcript: 'log a run' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
        expect(mockedProcessVoiceIntent).not.toHaveBeenCalled();
    });

    it('returns 400 when no transcript is provided', async () => {
        const req = createRequest({});
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('No transcript provided');
    });

    it('processes workout logging intent', async () => {
        const mockIntent = {
            action: 'log_workout',
            data: {
                activity_type: 'Running',
                duration: 30,
            },
        };
        mockedProcessVoiceIntent.mockResolvedValueOnce(mockIntent);

        const req = createRequest({ transcript: 'I just went for a 30 minute run' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual(mockIntent);
        expect(mockedProcessVoiceIntent).toHaveBeenCalledWith('I just went for a 30 minute run');
    });

    it('processes workout set logging intent', async () => {
        const mockIntent = {
            action: 'log_set',
            data: {
                reps: 10,
                weight: 135,
                weight_unit: 'lbs',
            },
        };
        mockedProcessVoiceIntent.mockResolvedValueOnce(mockIntent);

        const req = createRequest({ transcript: '10 reps at 135 pounds' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.action).toBe('log_set');
        expect(data.data.reps).toBe(10);
        expect(data.data.weight).toBe(135);
    });

    it('handles unknown intent gracefully', async () => {
        const mockIntent = {
            action: 'unknown',
            message: 'Could not understand the request',
        };
        mockedProcessVoiceIntent.mockResolvedValueOnce(mockIntent);

        const req = createRequest({ transcript: 'random gibberish' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.action).toBe('unknown');
    });

    it('returns 500 on processing error', async () => {
        mockedProcessVoiceIntent.mockRejectedValueOnce(new Error('Processing failed'));

        const req = createRequest({ transcript: 'some text' });
        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Processing failed');
    });
});
