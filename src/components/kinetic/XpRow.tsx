'use client';

import { useSyncExternalStore } from 'react';
import { Zap } from 'lucide-react';
import { xpForLevel } from '@/lib/api';
import { useLanguage } from '@/components/LanguageProvider';

export const SHOW_XP_ROW_KEY = 'kinetic.showXpRow';
const PREF_EVENT = 'kinetic-xp-pref';

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(PREF_EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(PREF_EVENT, cb);
  };
}

/** Reactive read of the "Show XP on Home" preference (SSR-safe: false on the server). */
export function useXpRowEnabled(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(SHOW_XP_ROW_KEY) === 'true',
    () => false
  );
}

export function setXpRowEnabled(value: boolean) {
  localStorage.setItem(SHOW_XP_ROW_KEY, String(value));
  // storage events don't fire in the tab that wrote — notify local listeners
  window.dispatchEvent(new Event(PREF_EVENT));
}

interface Props {
  level: number;
  xp: number;
  onClick?: () => void;
}

/**
 * Compact Level/XP row — hidden by default (owner preference), enabled via the
 * "Show XP on Home" toggle in /more. Tapping opens the XP history modal.
 */
export function XpRow({ level, xp, onClick }: Props) {
  const { t } = useLanguage();
  const enabled = useXpRowEnabled();

  if (!enabled) return null;

  const currentLevelXP = xpForLevel(level);
  const nextLevelXP = xpForLevel(level + 1);
  const percent = Math.min(100, Math.max(0, ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100));
  const toNext = nextLevelXP - xp;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left focus-ring transition-kinetic active:scale-[0.99]"
      style={{
        background: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-card)',
      }}
      aria-label={`Level ${level}, ${toNext.toLocaleString()} XP to next level. Open XP history.`}
    >
      <Zap className="w-4 h-4 shrink-0" style={{ color: 'var(--color-gold-text)' }} aria-hidden="true" />
      <span className="text-xs font-bold text-[var(--color-text)] shrink-0">
        {t.dashboard.level} {level}
      </span>
      <span
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--color-bg-muted)' }}
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className="block h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%`, background: 'var(--color-gold)' }}
        />
      </span>
      <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        {toNext.toLocaleString()} {t.levelProgress.xpToNext}
      </span>
    </button>
  );
}
