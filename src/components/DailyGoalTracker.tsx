'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, AlertCircle, Zap } from 'lucide-react';
import { DailyLog, UserSettings } from '@/lib/api';
import { useLanguage } from '@/components/LanguageProvider';

interface Props {
  todayLog: DailyLog | null;
  settings: UserSettings | null;
}

function getNudgeKey(todayLog: DailyLog | null): { key: keyof ReturnType<typeof useLanguage>['t']['goalTracker']['nudges']; urgent: boolean } {
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

interface GoalBarProps {
  label: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}

function GoalBar({ label, current, target, unit, color }: GoalBarProps) {
  const pct = Math.min(100, target > 0 ? Math.round((current / target) * 100) : 0);
  const over = current > target && target > 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-[var(--color-text-muted)]">{label}</span>
        <span className={over ? 'text-orange-500' : 'text-[var(--color-text)]'}>
          {current}<span className="text-[var(--color-text-muted)]">/{target}{unit}</span>
        </span>
      </div>
      <div className="h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: over ? '#f97316' : color }}
        />
      </div>
    </div>
  );
}

interface CheckItemProps {
  done: boolean;
  label: string;
}

function CheckItem({ done, label }: CheckItemProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done
        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        : <Circle className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
      }
      <span className={done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}>
        {label}
      </span>
    </div>
  );
}

export function DailyGoalTracker({ todayLog, settings }: Props) {
  const { t } = useLanguage();
  const nudge = getNudgeKey(todayLog);

  const protein = todayLog?.protein_grams ?? 0;
  const calories = todayLog?.calories ?? 0;
  const targetProtein = settings?.target_protein ?? 0;
  const targetCalories = settings?.target_calories ?? 0;

  const hasNutrition = !!(todayLog?.nutrition_logged || protein > 0);
  const hasMovement = !!(todayLog?.movement_completed);
  const hasWellness = !!(todayLog?.sleep_quality || todayLog?.energy_level);
  const hasBars = targetProtein > 0 || targetCalories > 0;

  return (
    <section aria-label="Today's goal tracker">
      <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-light)] rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <h3 className="font-bold text-sm text-[var(--color-text)] uppercase tracking-wide">{t.goalTracker.title}</h3>
          </div>
          <Link
            href="/log"
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            {t.goalTracker.logNow}
          </Link>
        </div>

        <div className={`flex items-start gap-2 text-sm rounded-xl px-3 py-2.5 ${
          nudge.urgent
            ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
            : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
        }`}>
          {nudge.urgent && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{t.goalTracker.nudges[nudge.key]}</span>
        </div>

        {hasBars && (
          <div className="space-y-3">
            {targetProtein > 0 && (
              <GoalBar
                label={t.nutrition.protein}
                current={protein}
                target={targetProtein}
                unit="g"
                color="var(--color-primary)"
              />
            )}
            {targetCalories > 0 && (
              <GoalBar
                label={t.nutrition.calories}
                current={calories}
                target={targetCalories}
                unit=" kcal"
                color="var(--color-success)"
              />
            )}
          </div>
        )}

        <div className="space-y-2 pt-1 border-t border-[var(--color-border-light)]">
          <CheckItem done={hasNutrition} label={t.goalTracker.checklist.nutrition} />
          <CheckItem done={hasMovement} label={t.goalTracker.checklist.movement} />
          <CheckItem done={hasWellness} label={t.goalTracker.checklist.wellness} />
        </div>
      </div>
    </section>
  );
}
