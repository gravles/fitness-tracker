'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/LanguageProvider';
import { DailyLog, upsertDailyLog } from '@/lib/api';
import { checkAndAwardBadges } from '@/lib/badges';
import { haptics } from '@/lib/haptics';

interface Props {
  dateStr: string;
  log: DailyLog | null;
  onSaved: () => void | Promise<void>;
}

/**
 * Day-level nutrition details that used to live on the /log Nutrition tab:
 * the "all logged" completion toggle (feeds streaks/checklist), the standard
 * drinks counter, and the eating window. Saves are debounced partial upserts.
 */
export function DayDetailsCard({ dateStr, log, onSaved }: Props) {
  const { t } = useLanguage();
  const [logged, setLogged] = useState(false);
  const [drinks, setDrinks] = useState(0);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from the loaded log; re-sync when the viewed day changes
  useEffect(() => {
    setLogged(!!log?.nutrition_logged);
    setDrinks(log?.alcohol_drinks ?? 0);
    setWindowStart(log?.eating_window_start ?? '');
    setWindowEnd(log?.eating_window_end ?? '');
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, log?.id]);

  function queueSave(patch: Partial<DailyLog>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await upsertDailyLog({ date: dateStr, ...patch });
        await onSaved();
        checkAndAwardBadges();
      } catch (e) {
        console.error(e);
        toast.error('Failed to save');
      }
    }, 700);
  }

  return (
    <section
      aria-label="Day details"
      className="px-3.5 py-3 space-y-3"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 16,
      }}
    >
      {/* Nutrition complete toggle — drives the checklist ring & streaks */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-bold" style={{ color: logged ? 'var(--chart-2)' : 'var(--color-text)' }}>
            {t.nutrition.allLogged}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {logged ? t.nutrition.markedComplete : t.nutrition.toggleWhenDone}
          </p>
        </div>
        <button
          onClick={() => {
            const next = !logged;
            setLogged(next);
            haptics.tap();
            queueSave({ nutrition_logged: next });
          }}
          role="switch"
          aria-checked={logged}
          aria-label={logged ? 'Mark nutrition as incomplete' : 'Mark nutrition as complete'}
          className="relative w-12 h-6 rounded-full transition-colors shrink-0 focus-ring"
          style={{ background: logged ? 'var(--color-success)' : 'var(--color-bg-muted)' }}
        >
          <span
            className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm"
            style={{ transform: logged ? 'translateX(24px)' : 'translateX(0)' }}
          />
        </button>
      </div>

      {/* Standard drinks */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {t.alcohol.standardDrinks}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const next = Math.max(0, drinks - 1);
              setDrinks(next);
              queueSave({ alcohol_drinks: next });
            }}
            aria-label="One drink fewer"
            className="w-9 h-9 rounded-full flex items-center justify-center focus-ring active:scale-95 transition-transform"
            style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
          >
            <Minus className="w-4 h-4" aria-hidden="true" />
          </button>
          <span className="text-lg font-bold w-6 text-center tabular-nums text-[var(--color-text)]" aria-live="polite">
            {drinks}
          </span>
          <button
            onClick={() => {
              const next = drinks + 1;
              setDrinks(next);
              queueSave({ alcohol_drinks: next });
            }}
            aria-label="One drink more"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white focus-ring active:scale-95 transition-transform"
            style={{ background: 'var(--color-primary)' }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Eating window */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
          {t.nutrition.eatingWindow}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={windowStart}
            aria-label="Eating window start"
            onChange={e => { setWindowStart(e.target.value); queueSave({ eating_window_start: e.target.value || null, eating_window_end: windowEnd || null }); }}
            className="flex-1 p-2 rounded-xl text-sm font-medium text-[var(--color-text)]"
            style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-light)' }}
          />
          <span style={{ color: 'var(--color-text-muted)' }}>–</span>
          <input
            type="time"
            value={windowEnd}
            aria-label="Eating window end"
            onChange={e => { setWindowEnd(e.target.value); queueSave({ eating_window_start: windowStart || null, eating_window_end: e.target.value || null }); }}
            className="flex-1 p-2 rounded-xl text-sm font-medium text-[var(--color-text)]"
            style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-light)' }}
          />
        </div>
      </div>
    </section>
  );
}
