'use client';

import { useLanguage } from '@/components/LanguageProvider';

export interface GoalChip {
  label: string;
  value: string;
  /** 0..1 progress toward the goal */
  progress: number;
  accent: string;
  met: boolean;
}

export function buildGoalChips(opts: {
  protein: number;
  targetProtein: number;
  calories: number;
  targetCalories: number;
  movementMin: number;
  movementDone: boolean;
  labels: { protein: string; calories: string; movement: string };
}): GoalChip[] {
  const { protein, targetProtein, calories, targetCalories, movementMin, movementDone, labels } = opts;
  // Movement goal: an explicit completion flag or 30+ active minutes
  const movementProgress = movementDone ? 1 : Math.min(1, movementMin / 30);
  return [
    {
      label: labels.protein,
      value: `${protein}g`,
      progress: targetProtein > 0 ? Math.min(1, protein / targetProtein) : 0,
      accent: 'var(--chart-1)',
      met: targetProtein > 0 && protein >= targetProtein,
    },
    {
      label: labels.calories,
      value: calories.toLocaleString(),
      progress: targetCalories > 0 ? Math.min(1, calories / targetCalories) : 0,
      accent: 'var(--chart-2)',
      met: targetCalories > 0 && calories >= targetCalories * 0.8,
    },
    {
      label: labels.movement,
      value: `${movementMin}m`,
      progress: movementProgress,
      accent: 'var(--color-gold)',
      met: movementProgress >= 1,
    },
  ];
}

/** Three goal chips — Protein / Calories / Movement — with 3px progress bars (mock 2b). */
export function GoalChips({ chips }: { chips: GoalChip[] }) {
  const { t } = useLanguage();

  return (
    <div className="flex gap-2" role="list" aria-label={t.dashboard.today}>
      {chips.map(chip => (
        <div
          key={chip.label}
          role="listitem"
          className="flex-1 px-3 py-2.5"
          style={{
            borderRadius: 14,
            background: `color-mix(in srgb, ${chip.accent} 8%, transparent)`,
            border: `1px solid color-mix(in srgb, ${chip.accent} 25%, transparent)`,
          }}
          aria-label={`${chip.label}: ${chip.value}, ${Math.round(chip.progress * 100)}% of goal`}
        >
          <p
            className="text-[9px] font-bold uppercase"
            style={{ letterSpacing: '0.08em', color: chip.accent }}
          >
            {chip.label}
          </p>
          <p className="mt-0.5 text-sm font-bold text-[var(--color-text)] tabular-nums">{chip.value}</p>
          <div
            className="mt-1.5 h-[3px] rounded-full overflow-hidden"
            style={{ background: 'var(--color-bg-muted)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${chip.progress * 100}%`, background: chip.accent }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
