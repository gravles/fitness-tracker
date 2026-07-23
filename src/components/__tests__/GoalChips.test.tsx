import { describe, it, expect } from 'vitest';
import { buildGoalChips } from '@/components/kinetic/eat/GoalChips';

const labels = { protein: 'Protein', calories: 'Calories', movement: 'Movement' };

describe('buildGoalChips', () => {
  it('computes progress against targets', () => {
    const [protein, calories, movement] = buildGoalChips({
      protein: 75, targetProtein: 150,
      calories: 1100, targetCalories: 2200,
      movementMin: 15, movementDone: false,
      labels,
    });
    expect(protein.progress).toBeCloseTo(0.5);
    expect(protein.met).toBe(false);
    expect(calories.progress).toBeCloseTo(0.5);
    expect(movement.progress).toBeCloseTo(0.5);
    expect(movement.met).toBe(false);
  });

  it('caps progress at 1 and marks goals met', () => {
    const [protein, , movement] = buildGoalChips({
      protein: 200, targetProtein: 150,
      calories: 0, targetCalories: 0,
      movementMin: 60, movementDone: false,
      labels,
    });
    expect(protein.progress).toBe(1);
    expect(protein.met).toBe(true);
    expect(movement.met).toBe(true);
  });

  it('honours the movement_completed flag regardless of minutes', () => {
    const [, , movement] = buildGoalChips({
      protein: 0, targetProtein: 0,
      calories: 0, targetCalories: 0,
      movementMin: 0, movementDone: true,
      labels,
    });
    expect(movement.progress).toBe(1);
    expect(movement.met).toBe(true);
  });

  it('shows zero progress when no targets are configured', () => {
    const [protein, calories] = buildGoalChips({
      protein: 50, targetProtein: 0,
      calories: 800, targetCalories: 0,
      movementMin: 0, movementDone: false,
      labels,
    });
    expect(protein.progress).toBe(0);
    expect(protein.met).toBe(false);
    expect(calories.met).toBe(false);
  });
});
