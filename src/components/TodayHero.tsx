'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { DailyLog, UserSettings } from '@/lib/api';
import { useLanguage } from '@/components/LanguageProvider';
import { Card, ProgressRing } from '@/components/ui';
import { useCountUp } from '@/lib/useCountUp';

interface Props {
  todayLog: DailyLog | null;
  settings: UserSettings | null;
  stagger?: number;
}

function getNudgeKey(todayLog: DailyLog | null): { key: 'earlyMorning' | 'morningLogged' | 'morningNotLogged' | 'noonNotLogged' | 'noonLogged' | 'afternoonNotLogged' | 'afternoonNoMovement' | 'afternoonOnTrack' | 'eveningNotLogged' | 'eveningNoMovement' | 'eveningGood'; urgent: boolean } {
  const hour = new Date().getHours();
  const hasLogged = !!(todayLog?.nutrition_logged || todayLog?.protein_grams);
  const hasMovement = !!(todayLog?.movement_completed);

  if (hour < 9) return { key: 'earlyMorning', urgent: false };
  if (hour < 12) {
    if (!hasLogged) return { key: 'morningNotLogged', urgent: false };
    return { key: 'morningLogged', urgent: false };
  }
  if (hour < 15) {
    if (!hasLogged) return { key: 'noonNotLogged', urgent: true };
    return { key: 'noonLogged', urgent: false };
  }
  if (hour < 19) {
    if (!hasLogged) return { key: 'afternoonNotLogged', urgent: true };
    if (!hasMovement) return { key: 'afternoonNoMovement', urgent: false };
    return { key: 'afternoonOnTrack', urgent: false };
  }
  if (!hasLogged) return { key: 'eveningNotLogged', urgent: true };
  if (!hasMovement) return { key: 'eveningNoMovement', urgent: false };
  return { key: 'eveningGood', urgent: false };
}

function MetricLine({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const shown = useCountUp(value);
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{label}</p>
      <p className="text-base font-semibold text-[var(--color-text)] tabular-nums leading-tight">
        {shown.toLocaleString()}
        {target > 0 && (
          <span className="text-xs font-normal text-[var(--color-text-muted)]"> / {target.toLocaleString()}{unit}</span>
        )}
      </p>
    </div>
  );
}

export function TodayHero({ todayLog, settings, stagger }: Props) {
  const { t } = useLanguage();
  const nudge = getNudgeKey(todayLog);

  const protein = todayLog?.protein_grams ?? 0;
  const calories = todayLog?.calories ?? 0;
  const targetProtein = settings?.target_protein ?? 0;
  const targetCalories = settings?.target_calories ?? 0;

  const hasNutrition = !!(todayLog?.nutrition_logged || protein > 0);
  const hasMovement = !!(todayLog?.movement_completed);
  const hasWellness = !!(todayLog?.sleep_quality || todayLog?.energy_level);
  const checklistDone = [hasNutrition, hasMovement, hasWellness].filter(Boolean).length;

  const checklist = [
    { done: hasNutrition, label: t.goalTracker.checklist.nutrition },
    { done: hasMovement, label: t.goalTracker.checklist.movement },
    { done: hasWellness, label: t.goalTracker.checklist.wellness },
  ];

  return (
    <section aria-label="Today's goal tracker">
      <Card stagger={stagger}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-[var(--color-text)] uppercase tracking-wide">{t.dashboard.today}</h3>
          <Link href="/log" className="text-xs font-semibold text-[var(--color-primary)] hover:underline focus-ring rounded">
            {t.goalTracker.logNow}
          </Link>
        </div>

        <div className="flex items-center gap-5">
          <ProgressRing
            size={116}
            strokeWidth={9}
            gap={4}
            aria-label={`Protein ${protein} of ${targetProtein}, calories ${calories} of ${targetCalories}, checklist ${checklistDone} of 3`}
            rings={[
              { progress: targetProtein > 0 ? protein / targetProtein : 0, color: 'var(--chart-1)', label: t.nutrition.protein },
              { progress: targetCalories > 0 ? calories / targetCalories : 0, color: 'var(--chart-2)', label: t.nutrition.calories },
              { progress: checklistDone / 3, color: 'var(--color-gold)', label: t.dashboard.today },
            ]}
          />
          <div className="flex-1 space-y-2.5 min-w-0">
            <MetricLine label={t.nutrition.protein} value={protein} target={targetProtein} unit="g" color="var(--chart-1)" />
            <MetricLine label={t.nutrition.calories} value={calories} target={targetCalories} unit="" color="var(--chart-2)" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-gold-text)' }}>{t.goalTracker.title}</p>
              <div className="flex gap-3 mt-1">
                {checklist.map(({ done, label }) => (
                  <span key={label} title={label} aria-label={`${label}: ${done ? '✓' : '–'}`}>
                    {done
                      ? <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" aria-hidden="true" />
                      : <Circle className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={`mt-4 flex items-start gap-2 text-sm px-3 py-2.5 ${
          nudge.urgent
            ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
            : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]'
        }`} style={{ borderRadius: 'var(--radius-control)' }}>
          {nudge.urgent && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />}
          <span>{t.goalTracker.nudges[nudge.key]}</span>
        </div>
      </Card>
    </section>
  );
}
