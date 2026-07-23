'use client';

import { format, isToday, isTomorrow } from 'date-fns';
import { useLanguage } from '@/components/LanguageProvider';
import { useNextWorkout } from '@/components/kinetic/useNextWorkout';

/** "Up next" workout card with the blue Start pill (Kinetic mock 2a). */
export function UpNextCard() {
  const { t } = useLanguage();
  const { workout, start } = useNextWorkout();

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00');
    if (isToday(date)) return t.upcoming.today;
    if (isTomorrow(date)) return t.upcoming.tomorrow;
    return format(date, 'EEE, MMM d');
  }

  const title = workout
    ? `${workout.title} · ${isToday(new Date(workout.scheduled_date + 'T00:00:00')) ? workout.scheduled_time.slice(0, 5) : formatDate(workout.scheduled_date)}`
    : t.dashboard.noneScheduled;

  return (
    <section
      aria-label={t.dashboard.nextWorkout}
      className="flex items-center justify-between px-4 py-3.5"
      style={{
        background: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <div className="min-w-0">
        <p
          className="text-[10px] font-bold uppercase"
          style={{ letterSpacing: '0.1em', color: 'var(--color-primary)' }}
        >
          {t.dashboard.nextWorkout}
        </p>
        <p
          className="mt-0.5 text-[15px] font-bold text-[var(--color-text)] truncate"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </p>
      </div>
      <button
        onClick={start}
        className="shrink-0 px-4 py-2 rounded-full text-xs font-bold text-white focus-ring transition-kinetic active:scale-95"
        style={{ background: 'var(--color-primary)', boxShadow: '0 6px 20px rgba(91, 156, 246, 0.3)' }}
        aria-label={workout ? `Start ${workout.title}` : 'Open workout schedule'}
      >
        {workout ? 'Start' : 'Plan'}
      </button>
    </section>
  );
}
