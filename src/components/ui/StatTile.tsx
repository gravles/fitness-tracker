'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from './Card';

interface StatTileProps {
  icon: LucideIcon;
  iconColor?: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  onClick?: () => void;
  stagger?: number;
  children?: ReactNode;
  'aria-label'?: string;
}

export function StatTile({
  icon: Icon,
  iconColor = 'var(--color-text-secondary)',
  label,
  value,
  sub,
  onClick,
  stagger,
  children,
  'aria-label': ariaLabel,
}: StatTileProps) {
  return (
    <Card onClick={onClick} stagger={stagger} padding="sm" aria-label={ariaLabel}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-4 h-4 shrink-0" style={{ color: iconColor }} aria-hidden="true" />
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">{label}</span>
      </div>
      <p className="text-base font-semibold text-[var(--color-text)] tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
      {children}
    </Card>
  );
}
