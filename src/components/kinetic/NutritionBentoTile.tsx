'use client';

import Link from 'next/link';
import { DailyLog, UserSettings } from '@/lib/api';
import { useLanguage } from '@/components/LanguageProvider';
import { ProgressRing } from '@/components/ui';

interface Props {
  todayLog: DailyLog | null;
  settings: UserSettings | null;
}

/**
 * Hero bento tile (row-span 2): triple ring — protein / calories / checklist —
 * on the gradient surface with a gold border, per Kinetic mock 2a.
 */
export function NutritionBentoTile({ todayLog, settings }: Props) {
  const { t } = useLanguage();

  const protein = todayLog?.protein_grams ?? 0;
  const calories = todayLog?.calories ?? 0;
  const targetProtein = settings?.target_protein ?? 0;
  const targetCalories = settings?.target_calories ?? 0;

  const hasNutrition = !!(todayLog?.nutrition_logged || protein > 0);
  const hasMovement = !!todayLog?.movement_completed;
  const hasWellness = !!(todayLog?.sleep_quality || todayLog?.energy_level);
  const checklistDone = [hasNutrition, hasMovement, hasWellness].filter(Boolean).length;

  return (
    <section
      aria-label="Today's goal tracker"
      className="row-span-2 flex flex-col justify-between p-4 min-h-[190px]"
      style={{
        background: 'var(--gradient-tile)',
        border: '1px solid var(--color-gold-border)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <div className="flex justify-between items-baseline">
        <p
          className="text-[10px] font-bold uppercase"
          style={{ letterSpacing: '0.1em', color: 'var(--color-gold-text)' }}
        >
          {t.nutrition.title}
        </p>
        <Link href="/nutrition" className="text-[10px] font-bold text-[var(--color-primary)] focus-ring rounded whitespace-nowrap">
          {t.goalTracker.logNow}
        </Link>
      </div>

      <ProgressRing
        size={110}
        strokeWidth={9}
        gap={3}
        className="self-center"
        aria-label={`Protein ${protein} of ${targetProtein}, calories ${calories} of ${targetCalories}, checklist ${checklistDone} of 3`}
        rings={[
          { progress: targetProtein > 0 ? protein / targetProtein : 0, color: 'var(--chart-1)', label: t.nutrition.protein },
          { progress: targetCalories > 0 ? calories / targetCalories : 0, color: 'var(--chart-2)', label: t.nutrition.calories },
          { progress: checklistDone / 3, color: 'var(--color-gold)', label: t.goalTracker.title },
        ]}
      />

      <div className="flex justify-between">
        <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--chart-1)' }}>
          {protein}g <span className="font-normal text-[var(--color-text-muted)]">prot</span>
        </span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--chart-2)' }}>
          {calories.toLocaleString()} <span className="font-normal text-[var(--color-text-muted)]">kcal</span>
        </span>
      </div>
    </section>
  );
}
