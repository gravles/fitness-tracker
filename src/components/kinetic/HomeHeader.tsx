'use client';

import Link from 'next/link';
import { Flame, Menu } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { Logomark } from '@/components/kinetic/Logomark';

interface HomeHeaderProps {
  /** null while loading — hides the streak pill to avoid a 0 flash */
  streak: number | null;
}

/** Kinetic Home header: K logomark + wordmark, streak pill, More entry point. */
export function HomeHeader({ streak }: HomeHeaderProps) {
  const { t } = useLanguage();

  return (
    <header className="flex justify-between items-center px-1 pb-1">
      <div className="flex items-center gap-2.5">
        <Logomark size={30} />
        <span
          className="text-base font-bold text-[var(--color-text)]"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
        >
          Kinetic
        </span>
      </div>

      <div className="flex items-center gap-2">
        {streak !== null && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--color-gold-muted)', border: '1px solid var(--color-gold-border)' }}
            aria-label={`${t.dashboard.streak.label}: ${streak} ${t.dashboard.streak.days}`}
            title={
              streak === 0
                ? t.dashboard.streak.zero
                : streak < 7
                  ? t.dashboard.streak.low
                  : streak < 30
                    ? t.dashboard.streak.mid
                    : t.dashboard.streak.high
            }
          >
            <Flame className="w-3.5 h-3.5" style={{ color: 'var(--color-gold-text)' }} aria-hidden="true" />
            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-gold-text)' }}>
              {streak}
            </span>
          </div>
        )}
        {/* Not in the mock — kept so coach/partners/progress/settings stay one tap away */}
        <Link
          href="/more"
          className="p-2 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-gold-text)] transition-colors focus-ring tap-target"
          aria-label="More — coach, partners, progress, settings"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
