import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSmartAdvice } from '../smartCoach';
import type { DailyLog } from '../api';
import { format, subDays } from 'date-fns';

describe('smartCoach', () => {
    describe('getSmartAdvice', () => {
        let mockDate: Date;

        beforeEach(() => {
            // Mock date to 2026-01-31 for consistent tests
            mockDate = new Date('2026-01-31T12:00:00');
            vi.useFakeTimers();
            vi.setSystemTime(mockDate);
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        describe('streak-based advice', () => {
            it('returns success tip for 7+ day streak', () => {
                const logs: DailyLog[] = [{ date: '2026-01-31', movement_completed: true }];
                const result = getSmartAdvice(logs, 7);

                expect(result.type).toBe('success');
                expect(result.message).toContain('7');
            });

            it('returns success tip for very high streak', () => {
                const logs: DailyLog[] = [{ date: '2026-01-31', movement_completed: true }];
                const result = getSmartAdvice(logs, 30);

                expect(result.type).toBe('success');
                expect(result.message).toContain('30');
            });

            it('returns building momentum tip for 3-6 day streak', () => {
                const logs: DailyLog[] = [{ date: '2026-01-31', movement_completed: true }];
                const result = getSmartAdvice(logs, 3);

                expect(result.type).toBe('success');
            });
        });

        describe('inactivity warnings', () => {
            it('returns info welcome message for new users with no logs', () => {
                const result = getSmartAdvice([], 0);

                expect(result.type).toBe('info');
                expect(result.title).toContain('Welcome');
            });
        });

        describe('protein goal advice', () => {
            it('returns protein reminder when below target today', () => {
                const today = format(mockDate, 'yyyy-MM-dd');
                const logs: DailyLog[] = [{
                    date: today,
                    movement_completed: true,
                    protein_grams: 100
                }];
                const settings = { target_protein: 150 };
                const result = getSmartAdvice(logs, 0, settings);

                expect(result.title).toContain('Protein');
                expect(result.message).toContain('50g');
                expect(result.type).toBe('info');
            });

            it('uses default protein target of 150g if not specified', () => {
                const today = format(mockDate, 'yyyy-MM-dd');
                const logs: DailyLog[] = [{
                    date: today,
                    movement_completed: true,
                    protein_grams: 50
                }];
                const result = getSmartAdvice(logs, 0);

                expect(result.message).toContain('100g');
            });

            it('returns general tip when protein goal is met', () => {
                const today = format(mockDate, 'yyyy-MM-dd');
                const logs: DailyLog[] = [{
                    date: today,
                    movement_completed: true,
                    protein_grams: 160
                }];
                const settings = { target_protein: 150 };
                const result = getSmartAdvice(logs, 0, settings);

                // Should fall through to general tips since protein goal is met
                expect(result.type).toBe('info');
            });
        });

        describe('general tips fallback', () => {
            it('returns info type for general wellness tips', () => {
                const today = format(mockDate, 'yyyy-MM-dd');
                const logs: DailyLog[] = [{
                    date: today,
                    movement_completed: true,
                    protein_grams: 200 // Above any target
                }];
                const result = getSmartAdvice(logs, 0);

                expect(result.type).toBe('info');
                expect(result.title).toBeDefined();
                expect(result.message).toBeDefined();
            });
        });

        describe('tip structure', () => {
            it('always returns a tip with title, message, and type', () => {
                const testCases = [
                    { logs: [], streak: 0 },
                    { logs: [{ date: '2026-01-31', movement_completed: true }] as DailyLog[], streak: 7 },
                    { logs: [{ date: '2026-01-31', movement_completed: false }] as DailyLog[], streak: 0 },
                ];

                testCases.forEach(({ logs, streak }) => {
                    const result = getSmartAdvice(logs, streak);
                    expect(result).toHaveProperty('title');
                    expect(result).toHaveProperty('message');
                    expect(result).toHaveProperty('type');
                    expect(['success', 'warning', 'info']).toContain(result.type);
                });
            });
        });
    });
});
