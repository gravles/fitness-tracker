import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('WorkoutSpotter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('voice command parsing', () => {
        it('parses reps only command', () => {
            // Test cases for voice parsing logic that could be extracted
            const parseCommand = (text: string) => {
                text = text.toLowerCase();
                let reps = 0;
                let weight = 0;
                let unit = 'lbs';

                // Extract reps
                const repsMatch = text.match(/(\d+)\s*(?:reps?|times?)/i) ||
                    text.match(/^(\d+)$/);
                if (repsMatch) reps = parseInt(repsMatch[1], 10);

                // Extract weight
                const weightMatch = text.match(/(\d+)\s*(?:lbs?|pounds?|kilos?|kg)/i);
                if (weightMatch) {
                    weight = parseInt(weightMatch[1], 10);
                    if (/kg|kilo/i.test(text)) unit = 'kg';
                }

                return { reps, weight, unit };
            };

            expect(parseCommand('10 reps')).toEqual({ reps: 10, weight: 0, unit: 'lbs' });
            expect(parseCommand('8')).toEqual({ reps: 8, weight: 0, unit: 'lbs' });
            expect(parseCommand('10 reps at 135 lbs')).toEqual({ reps: 10, weight: 135, unit: 'lbs' });
            expect(parseCommand('12 reps 50 kg')).toEqual({ reps: 12, weight: 50, unit: 'kg' });
        });

        it('handles various weight unit formats', () => {
            const parseWeight = (text: string) => {
                const match = text.match(/(\d+)\s*(?:lbs?|pounds?|kilos?|kg)/i);
                if (!match) return { weight: 0, unit: 'lbs' };
                return {
                    weight: parseInt(match[1], 10),
                    unit: /kg|kilo/i.test(text) ? 'kg' : 'lbs',
                };
            };

            expect(parseWeight('135 lbs')).toEqual({ weight: 135, unit: 'lbs' });
            expect(parseWeight('135 lb')).toEqual({ weight: 135, unit: 'lbs' });
            expect(parseWeight('135 pounds')).toEqual({ weight: 135, unit: 'lbs' });
            expect(parseWeight('60 kg')).toEqual({ weight: 60, unit: 'kg' });
            expect(parseWeight('60 kilos')).toEqual({ weight: 60, unit: 'kg' });
        });
    });

    describe('spoken feedback', () => {
        it('generates correct confirmation messages', () => {
            const generateConfirmation = (reps: number, weight: number, unit: string) => {
                if (weight > 0) {
                    return `Got it! ${reps} reps at ${weight} ${unit}`;
                }
                return `Got it! ${reps} reps`;
            };

            expect(generateConfirmation(10, 135, 'lbs')).toBe('Got it! 10 reps at 135 lbs');
            expect(generateConfirmation(8, 0, 'lbs')).toBe('Got it! 8 reps');
            expect(generateConfirmation(12, 60, 'kg')).toBe('Got it! 12 reps at 60 kg');
        });
    });
});
