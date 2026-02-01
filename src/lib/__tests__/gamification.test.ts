import { describe, it, expect } from 'vitest';
import { calculateXP, BADGES } from '../gamification';
import type { DailyLog } from '../api';

describe('gamification', () => {
    describe('calculateXP', () => {
        it('awards 10 XP for base logging', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: false,
            };
            expect(calculateXP(log)).toBe(10);
        });

        it('awards additional 10 XP for movement completed', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: true,
            };
            expect(calculateXP(log)).toBe(20);
        });

        it('awards movement XP when duration > 0 even if movement_completed is false', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: false,
                movement_duration: 30,
            };
            expect(calculateXP(log)).toBe(20);
        });

        it('awards 5 XP for hitting protein goal', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: false,
                protein_grams: 150,
            };
            const targets = { daily_protein: 150 };
            expect(calculateXP(log, targets)).toBe(15);
        });

        it('does not award protein XP when below target', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: false,
                protein_grams: 100,
            };
            const targets = { daily_protein: 150 };
            expect(calculateXP(log, targets)).toBe(10);
        });

        it('awards 5 XP for tracking calories with a goal', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: false,
                calories: 1800,
            };
            const targets = { daily_calories: 2000 };
            expect(calculateXP(log, targets)).toBe(15);
        });

        it('does not award calorie XP if calories are 0', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: false,
                calories: 0,
            };
            const targets = { daily_calories: 2000 };
            expect(calculateXP(log, targets)).toBe(10);
        });

        it('awards 5 XP per habit completed', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: false,
                habits: ['Drink Water', 'Meditate', 'Stretch'],
            };
            expect(calculateXP(log)).toBe(25); // 10 base + 15 habits
        });

        it('calculates full XP for a complete log', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: true,
                protein_grams: 160,
                calories: 2100,
                habits: ['Drink Water', 'Sleep 8 Hours'],
            };
            const targets = { daily_protein: 150, daily_calories: 2200 };
            // 10 base + 10 movement + 5 protein + 5 calories + 10 habits = 40
            expect(calculateXP(log, targets)).toBe(40);
        });

        it('handles empty habits array', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: false,
                habits: [],
            };
            expect(calculateXP(log)).toBe(10);
        });

        it('handles null habits', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: false,
                habits: null,
            };
            expect(calculateXP(log)).toBe(10);
        });

        it('handles undefined targets', () => {
            const log: DailyLog = {
                date: '2026-01-31',
                movement_completed: true,
                protein_grams: 200,
                calories: 2500,
            };
            expect(calculateXP(log, undefined)).toBe(20);
        });
    });

    describe('BADGES', () => {
        describe('first_step badge', () => {
            const badge = BADGES.find(b => b.id === 'first_step')!;

            it('is awarded when at least one log exists', () => {
                const logs: DailyLog[] = [{ date: '2026-01-31', movement_completed: false }];
                expect(badge.condition(logs, 0)).toBe(true);
            });

            it('is not awarded with empty logs', () => {
                expect(badge.condition([], 0)).toBe(false);
            });
        });

        describe('heating_up badge', () => {
            const badge = BADGES.find(b => b.id === 'heating_up')!;

            it('is awarded at 3-day streak', () => {
                expect(badge.condition([], 3)).toBe(true);
            });

            it('is not awarded below 3-day streak', () => {
                expect(badge.condition([], 2)).toBe(false);
            });
        });

        describe('unstoppable badge', () => {
            const badge = BADGES.find(b => b.id === 'unstoppable')!;

            it('is awarded at 7-day streak', () => {
                expect(badge.condition([], 7)).toBe(true);
            });

            it('is awarded above 7-day streak', () => {
                expect(badge.condition([], 10)).toBe(true);
            });

            it('is not awarded below 7-day streak', () => {
                expect(badge.condition([], 6)).toBe(false);
            });
        });

        describe('weekend_warrior badge', () => {
            const badge = BADGES.find(b => b.id === 'weekend_warrior')!;

            it('is awarded for logging movement on Saturday', () => {
                // 2026-01-31 is a Saturday
                const logs: DailyLog[] = [
                    { date: '2026-01-31', movement_completed: true }
                ];
                expect(badge.condition(logs, 0)).toBe(true);
            });

            it('is awarded for logging movement on Sunday', () => {
                // 2026-02-01 is a Sunday
                const logs: DailyLog[] = [
                    { date: '2026-02-01', movement_completed: true }
                ];
                expect(badge.condition(logs, 0)).toBe(true);
            });

            it('is not awarded without movement completed', () => {
                const logs: DailyLog[] = [
                    { date: '2026-01-31', movement_completed: false }
                ];
                expect(badge.condition(logs, 0)).toBe(false);
            });

            it('is not awarded on weekdays', () => {
                // 2026-01-30 is a Friday
                const logs: DailyLog[] = [
                    { date: '2026-01-30', movement_completed: true }
                ];
                expect(badge.condition(logs, 0)).toBe(false);
            });

            it('is not awarded with empty logs', () => {
                expect(badge.condition([], 0)).toBe(false);
            });
        });

        describe('protein_pro badge', () => {
            const badge = BADGES.find(b => b.id === 'protein_pro')!;

            it('is awarded for hitting 150g protein', () => {
                const logs: DailyLog[] = [
                    { date: '2026-01-31', movement_completed: false, protein_grams: 150 }
                ];
                expect(badge.condition(logs, 0)).toBe(true);
            });

            it('is awarded for exceeding 150g protein', () => {
                const logs: DailyLog[] = [
                    { date: '2026-01-31', movement_completed: false, protein_grams: 200 }
                ];
                expect(badge.condition(logs, 0)).toBe(true);
            });

            it('is not awarded below 150g protein', () => {
                const logs: DailyLog[] = [
                    { date: '2026-01-31', movement_completed: false, protein_grams: 149 }
                ];
                expect(badge.condition(logs, 0)).toBe(false);
            });

            it('handles undefined protein_grams', () => {
                const logs: DailyLog[] = [
                    { date: '2026-01-31', movement_completed: false }
                ];
                expect(badge.condition(logs, 0)).toBe(false);
            });
        });
    });
});
