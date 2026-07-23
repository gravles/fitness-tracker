'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import {
  getDailyLog, upsertDailyLog, appendFoodItems, getWorkouts, getSettings, addFavoriteFood,
  DailyLog, FoodItem, Workout, UserSettings, isAuthError,
} from '@/lib/api';
import { foodTotals } from '@/lib/food-merge';
import { getPlannedMealsForRange, logPlannedMealAsEaten, skipPlannedMeal, PlannedMeal } from '@/lib/meal-plan-api';
import { useLanguage } from '@/components/LanguageProvider';
import { confirm } from '@/components/ConfirmDialog';
import { haptics } from '@/lib/haptics';
import { checkAndAwardBadges } from '@/lib/badges';
import { DateNavigator } from '@/components/DateNavigator';
import { FoodItemEditModal } from '@/components/daily-log/FoodItemEditModal';
import { GoalChips, buildGoalChips } from '@/components/kinetic/eat/GoalChips';
import { Timeline, FeedEntry } from '@/components/kinetic/eat/Timeline';
import { EatCapture, CaptureAction } from '@/components/kinetic/eat/EatCapture';
import { DayDetailsCard } from '@/components/kinetic/eat/DayDetailsCard';
import { LoadError } from '@/components/ui';

const CAPTURE_ACTIONS: CaptureAction[] = ['voice', 'camera', 'barcode', 'text', 'scan', 'favorites'];

export default function EatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();

  // ?date= deep links (habit strip, calendar) land on that day's feed
  const [date, setDate] = useState(() => {
    const q = searchParams.get('date');
    if (q) {
      const parsed = parseISO(q);
      if (isValid(parsed)) return parsed;
    }
    return new Date();
  });
  const [initialAction] = useState<CaptureAction | null>(() => {
    const a = searchParams.get('action');
    return CAPTURE_ACTIONS.includes(a as CaptureAction) ? (a as CaptureAction) : null;
  });

  const [log, setLog] = useState<DailyLog | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [planned, setPlanned] = useState<PlannedMeal[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Legacy deep links: /nutrition?tab=… belongs to the Meal Planner
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) router.replace(`/nutrition/planner?tab=${tab}`);
  }, [searchParams, router]);

  const dateStr = format(date, 'yyyy-MM-dd');

  const loadDay = useCallback(async () => {
    try {
      const [dayLog, dayWorkouts, dayPlanned, userSettings] = await Promise.all([
        getDailyLog(dateStr).catch(() => null),
        getWorkouts(dateStr).catch(() => []),
        getPlannedMealsForRange(dateStr, dateStr),
        getSettings().catch(() => null),
      ]);
      setLoadError(false);
      setLog(dayLog);
      setWorkouts(dayWorkouts);
      setPlanned(dayPlanned);
      setSettings(userSettings);
    } catch (error) {
      console.error(error);
      if (!isAuthError(error)) setLoadError(true);
    }
  }, [dateStr]);

  useEffect(() => {
    // Async data fetch — state updates land after the awaits, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDay();
  }, [loadDay]);

  const foodItems: FoodItem[] = log?.food_items ?? [];

  /** Persist a full replacement of the day's food items with recomputed totals. */
  async function saveFoodItems(items: FoodItem[]) {
    const totals = foodTotals(items);
    await upsertDailyLog({
      date: dateStr,
      food_items: items,
      calories: totals.calories,
      protein_grams: totals.protein,
      carbs_grams: totals.carbs,
      fat_grams: totals.fat,
    });
    await loadDay();
  }

  async function handleDuplicate(item: FoodItem) {
    try {
      // Duplicates always land in TODAY's log, keeping the original entry's
      // time of day (duplicate yesterday's 08:10 breakfast → today 08:10).
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const copy: FoodItem = { ...item, source: item.source ?? 'manual' };
      if (item.logged_at) {
        copy.logged_at = new Date(`${todayStr}T${format(new Date(item.logged_at), 'HH:mm:ss')}`).toISOString();
      } else {
        delete copy.logged_at; // legacy item — appendFoodItems stamps "now"
      }
      await appendFoodItems(todayStr, [copy]);
      haptics.success();
      const time = copy.logged_at ? format(new Date(copy.logged_at), 'HH:mm') : null;
      toast.success(
        dateStr === todayStr
          ? `Duplicated '${item.name}'`
          : `Added '${item.name}' to today${time ? ` at ${time}` : ''}`
      );
      await loadDay();
      checkAndAwardBadges();
    } catch (e) {
      console.error(e);
      toast.error('Failed to duplicate item');
    }
  }

  async function handleDelete(index: number) {
    const item = foodItems[index];
    if (!item) return;
    if (!await confirm({ title: 'Delete entry', message: `Remove '${item.name}' from this day?` })) return;
    try {
      await saveFoodItems(foodItems.filter((_, i) => i !== index));
      haptics.tap();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete item');
    }
  }

  async function handleFavorite(item: FoodItem) {
    try {
      await addFavoriteFood({
        name: item.name,
        calories: item.calories ?? 0,
        protein: item.protein ?? 0,
        carbs: item.carbs ?? 0,
        fat: item.fat ?? 0,
        portion_estimate: item.portion_estimate,
      });
      haptics.tap();
      toast.success(`Saved '${item.name}' to favorites`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save favorite');
    }
  }

  async function handleSaveEdit(updated: FoodItem, targetDate?: string) {
    if (editingIndex === null) return;
    try {
      if (targetDate && targetDate !== dateStr) {
        // Entry moved to another day: remove here, append there (with its edits)
        await saveFoodItems(foodItems.filter((_, i) => i !== editingIndex));
        await appendFoodItems(targetDate, [{ ...updated, source: updated.source ?? 'manual' }]);
        toast.success(`Moved '${updated.name}' to ${format(new Date(`${targetDate}T00:00:00`), 'EEE, MMM d')}`);
      } else {
        const items = [...foodItems];
        items[editingIndex] = updated;
        await saveFoodItems(items);
      }
      setEditingIndex(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save changes');
    }
  }

  async function handleLogPlanned(meal: PlannedMeal) {
    try {
      await logPlannedMealAsEaten(meal);
      haptics.success();
      toast.success(`Logged '${meal.name}'`);
      await loadDay();
      checkAndAwardBadges();
    } catch (e) {
      console.error(e);
      toast.error('Failed to log planned meal');
    }
  }

  async function handleSkipPlanned(meal: PlannedMeal) {
    try {
      await skipPlannedMeal(meal.id);
      haptics.tap();
      toast(`Skipped '${meal.name}' — off plan`);
      await loadDay();
    } catch (e) {
      console.error(e);
      toast.error('Failed to skip planned meal');
    }
  }

  async function handleSkipAllPlanned(meals: PlannedMeal[]) {
    if (!await confirm({
      title: 'Off plan today?',
      message: `Skip the ${meals.length} remaining planned meals for this day? They stay in your plan history as skipped.`,
    })) return;
    try {
      await Promise.all(meals.map(m => skipPlannedMeal(m.id)));
      haptics.tap();
      toast(`Skipped ${meals.length} planned meals`);
      await loadDay();
    } catch (e) {
      console.error(e);
      toast.error('Failed to skip planned meals');
    }
  }

  // Build the timeline: timed entries in order, legacy (un-stamped) food first
  const timed: { at: string; entry: FeedEntry }[] = [];
  const legacy: FeedEntry[] = [];

  foodItems.forEach((item, index) => {
    const entry: FeedEntry = { kind: 'food', item, index };
    if (item.logged_at) timed.push({ at: item.logged_at, entry });
    else legacy.push(entry);
  });
  workouts.forEach(w => {
    if (w.created_at) timed.push({ at: w.created_at, entry: { kind: 'workout', workout: w } });
    else legacy.push({ kind: 'workout', workout: w });
  });
  timed.sort((a, b) => a.at.localeCompare(b.at));

  // Un-logged planned meals trail the feed as gold suggestions —
  // actual logged food always comes first
  const pendingPlanned = planned.filter(m => m.status === 'planned');
  const plannedEntries: FeedEntry[] = pendingPlanned.map(meal => ({ kind: 'planned', meal }));

  const entries: FeedEntry[] = [...legacy, ...timed.map(x => x.entry), ...plannedEntries];

  const protein = log?.protein_grams ?? 0;
  const calories = log?.calories ?? 0;
  const movementMin = workouts.reduce((a, w) => a + (w.duration || 0), 0) || (log?.movement_duration ?? 0);
  const chips = buildGoalChips({
    protein,
    targetProtein: settings?.target_protein ?? 0,
    calories,
    targetCalories: settings?.target_calories ?? 0,
    movementMin,
    movementDone: !!log?.movement_completed,
    labels: { protein: t.nutrition.protein, calories: t.nutrition.calories, movement: t.dashboard.movement },
  });
  const goalsMet = chips.filter(c => c.met).length;

  return (
    <main className="p-5 pt-11 pb-56 max-w-2xl mx-auto">
      <header className="flex justify-between items-center mb-3.5">
        <h1
          className="text-2xl font-extrabold text-[var(--color-text)]"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
        >
          Eat<span style={{ color: 'var(--color-gold)' }}>.</span>
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>
            {format(date, 'EEE MMM d')} · {goalsMet} of 3 goals
          </span>
          {/* Meal planning entry point — labeled so it reads as "plan", not "calendar" */}
          <Link
            href="/nutrition/planner"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-kinetic focus-ring"
            style={{ background: 'var(--color-gold-muted)', border: '1px solid var(--color-gold-border)', color: 'var(--color-gold-text)' }}
            aria-label="Open meal planner"
          >
            <CalendarRange className="w-4 h-4" aria-hidden="true" />
            Plan
          </Link>
        </div>
      </header>

      <DateNavigator date={date} setDate={setDate} />

      {loadError ? (
        <LoadError onRetry={loadDay} />
      ) : (
        <>
          <div className="mb-4">
            <GoalChips chips={chips} />
          </div>

          {entries.length > 0 ? (
            <>
              <Timeline
                entries={entries}
                onDuplicate={handleDuplicate}
                onEdit={setEditingIndex}
                onDelete={handleDelete}
                onFavorite={handleFavorite}
                onLogPlanned={handleLogPlanned}
                onSkipPlanned={handleSkipPlanned}
              />
              {pendingPlanned.length >= 2 && (
                <button
                  onClick={() => handleSkipAllPlanned(pendingPlanned)}
                  className="mt-3 w-full text-center text-xs font-semibold tap-target focus-ring rounded-xl"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Off plan today? Skip the {pendingPlanned.length} remaining planned meals
                </button>
              )}
            </>
          ) : (
            <div
              className="text-center text-sm px-4 py-10"
              style={{
                border: '1.5px dashed var(--color-border)',
                borderRadius: 16,
                color: 'var(--color-text-muted)',
              }}
            >
              Nothing logged {dateStr === format(new Date(), 'yyyy-MM-dd') ? 'yet today' : 'this day'} — capture a meal below.
            </div>
          )}

          <div className="mt-4">
            <DayDetailsCard dateStr={dateStr} log={log} onSaved={loadDay} />
          </div>
        </>
      )}

      {editingIndex !== null && foodItems[editingIndex] && (
        <FoodItemEditModal
          item={foodItems[editingIndex]}
          entryDate={dateStr}
          allowDateMove
          onSave={handleSaveEdit}
          onClose={() => setEditingIndex(null)}
        />
      )}

      {/* Taller scrim: this page's floating stack is capture bar + nav */}
      <div aria-hidden="true" className="bottom-scrim" style={{ height: 210 }} />

      {/* Persistent capture bar, docked above the glass nav */}
      <div
        className="fixed inset-x-0 max-w-2xl mx-auto px-3.5 pointer-events-none"
        style={{ bottom: 'calc(max(14px, env(safe-area-inset-bottom)) + 68px)', zIndex: 'var(--z-nav, 50)' }}
      >
        <div
          className="glass-nav glass-dense pointer-events-auto px-4 pt-2 pb-3"
          style={{ borderRadius: 22 }}
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-2"
            style={{ width: 36, height: 4, borderRadius: 100, background: 'var(--color-bg-muted)' }}
          />
          <EatCapture dateStr={dateStr} initialAction={initialAction} onLogged={loadDay} />
        </div>
      </div>
    </main>
  );
}
