'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Sparkline } from '@/components/kinetic/Sparkline';

interface Props {
  label: string;
  value: ReactNode;
  /** 7-day series for the sparkline; hidden when under 2 points */
  points: number[];
  sparkColor: string;
  href: string;
  'aria-label': string;
}

/** Small bento tile: uppercase label, Sora value, 90×26 sparkline. Taps through to trends. */
export function MetricBentoTile({ label, value, points, sparkColor, href, 'aria-label': ariaLabel }: Props) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="block p-3.5 focus-ring transition-kinetic active:scale-[0.98]"
      style={{
        background: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <p
        className="text-[10px] font-bold uppercase"
        style={{ letterSpacing: '0.1em', color: 'var(--color-text-muted)' }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-lg font-bold text-[var(--color-text)] tabular-nums"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value}
      </p>
      <Sparkline points={points} color={sparkColor} aria-label={`${label} 7-day trend`} />
    </Link>
  );
}
