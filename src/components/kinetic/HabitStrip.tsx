'use client';

import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { DailyLog } from '@/lib/api';

interface Props {
  /** Daily logs covering (at least) the trailing 7 days */
  logs: DailyLog[];
}

type DayStatus = 'done' | 'partial' | 'none';

function statusFor(log: DailyLog | undefined): DayStatus {
  if (!log) return 'none';
  const nutrition = !!(log.nutrition_logged || (log.calories ?? 0) > 0);
  const movement = !!log.movement_completed;
  const wellness = !!(log.sleep_quality || log.energy_level);
  if (nutrition && movement) return 'done';
  if (nutrition || movement || wellness) return 'partial';
  return 'none';
}

const STYLE: Record<DayStatus, { bg: string; border: string; color: string; glyph: string; label: string }> = {
  done: {
    bg: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
    border: 'color-mix(in srgb, var(--color-success) 40%, transparent)',
    color: 'var(--chart-2)',
    glyph: '✓',
    label: 'complete',
  },
  partial: {
    bg: 'var(--color-gold-muted)',
    border: 'var(--color-gold-border)',
    color: 'var(--color-gold-text)',
    glyph: '•',
    label: 'partial',
  },
  none: {
    bg: 'var(--color-bg-muted)',
    border: 'var(--color-border-light)',
    color: 'var(--color-text-muted)',
    glyph: '',
    label: 'no activity',
  },
};

/**
 * 7-day habit strip (Kinetic mock 2a). Each day links to that day's log so
 * every checklist item stays reachable, not just the aggregate.
 */
export function HabitStrip({ logs }: Props) {
  const byDate = new Map(logs.map(l => [l.date, l]));
  const today = new Date();

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    return { date, dateStr, status: statusFor(byDate.get(dateStr)) };
  });

  return (
    <section aria-label="Last 7 days checklist" className="grid grid-cols-7 gap-1.5 px-0.5 py-1">
      {days.map(({ date, dateStr, status }) => {
        const s = STYLE[status];
        return (
          <Link
            key={dateStr}
            href={`/nutrition?date=${dateStr}`}
            aria-label={`${format(date, 'EEEE')}: ${s.label} — open day`}
            className="flex flex-col items-center gap-1 tap-target focus-ring rounded-xl"
          >
            <span className="text-[9px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              {format(date, 'EEEEE')}
            </span>
            <span
              aria-hidden="true"
              className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px]"
              style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
            >
              {s.glyph}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
