'use client';

import { ReactNode, KeyboardEvent } from 'react';

interface CardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  /** Stagger delay in ms for the entrance animation; omit to disable */
  stagger?: number;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md';
  'aria-label'?: string;
}

export function Card({
  children,
  onClick,
  className = '',
  stagger,
  elevated = true,
  padding = 'md',
  'aria-label': ariaLabel,
}: CardProps) {
  const pad = padding === 'none' ? '' : padding === 'sm' ? 'p-4' : 'p-5';
  const interactive = onClick
    ? 'cursor-pointer hover:border-[var(--color-border)] hover:shadow-md active:scale-[0.99] focus-ring'
    : '';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={onClick ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`${pad} border border-[var(--color-border-light)] shadow-sm transition-all ${interactive} ${stagger !== undefined ? 'animate-in' : ''} ${className}`}
      style={{
        background: elevated ? 'var(--color-surface-elevated)' : 'var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        ...(stagger !== undefined ? { ['--stagger' as string]: `${stagger}ms` } : {}),
      }}
    >
      {children}
    </div>
  );
}
