'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, AlertCircle, Zap } from 'lucide-react';
import { DailyLog, UserSettings } from '@/lib/api';

interface Props {
  todayLog: DailyLog | null;
  settings: UserSettings | null;
}

function getTimeNudge(todayLog: DailyLog | null): { message: string; urgent: boolean } {
  const hour = new Date().getHours();
  const hasLogged = !!(todayLog?.nutrition_logged || todayLog?.protein_grams);
  const hasMovement = !!(todayLog?.movement_completed);

  if (hour < 9) {
    return { message: "Morning! Log your weight and plan your meals for today.", urgent: false };
  }
  if (hour < 12) {
    if (!hasLogged) return { message: "Log breakfast now while it's fresh.", urgent: false };
    return { message: "Good start — keep logging meals as you go.", urgent: false };
  }
  if (hour < 15) {
    if (!hasLogged) return { message: "It's noon — you haven't logged yet today. Don't let the day slip.", urgent: true };
    return { message: "Midday check-in. Log lunch if you haven't.", urgent: false };
  }
  if (hour < 19) {
    if (!hasLogged) return { message: "Afternoon and no logs yet — quick, log your meals before you forget.", urgent: true };
    if (!hasMovement) return { message: "Good on nutrition. Still time to get movement in today.", urgent: false };
    return { message: "You're on track — keep it up through dinner.", urgent: false };
  }
  // Evening
  if (!hasLogged) return { message: "Evening — streak at risk. Log today before midnight.", urgent: true };
  if (!hasMovement) return { message: "Almost done. Log your activity if you moved today.", urgent: false };
  return { message: "Strong day. Log dinner and wrap up.", urgent: false };
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
  const nudge = getTimeNudge(todayLog);

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <h3 className="font-bold text-sm text-[var(--color-text)] uppercase tracking-wide">On Track Today?</h3>
          </div>
          <Link
            href="/log"
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            Log now →
          </Link>
        </div>

        {/* Time-aware nudge */}
        <div className={`flex items-start gap-2 text-sm rounded-xl px-3 py-2.5 ${
          nudge.urgent
            ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
            : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
        }`}>
          {nudge.urgent && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{nudge.message}</span>
        </div>

        {/* Progress bars (only when targets are set) */}
        {hasBars && (
          <div className="space-y-3">
            {targetProtein > 0 && (
              <GoalBar
                label="Protein"
                current={protein}
                target={targetProtein}
                unit="g"
                color="var(--color-primary)"
              />
            )}
            {targetCalories > 0 && (
              <GoalBar
                label="Calories"
                current={calories}
                target={targetCalories}
                unit=" kcal"
                color="var(--color-success)"
              />
            )}
          </div>
        )}

        {/* Checklist */}
        <div className="space-y-2 pt-1 border-t border-[var(--color-border-light)]">
          <CheckItem done={hasNutrition} label="Nutrition logged" />
          <CheckItem done={hasMovement} label="Movement logged" />
          <CheckItem done={hasWellness} label="Wellness check-in" />
        </div>
      </div>
    </section>
  );
}
