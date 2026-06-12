'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'gold' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-primary)',
    color: '#ffffff',
    border: '1px solid transparent',
  },
  gold: {
    background: 'var(--color-gold-muted)',
    color: 'var(--color-gold-text)',
    border: '1px solid var(--color-gold-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
  },
  danger: {
    background: 'var(--color-danger)',
    color: '#ffffff',
    border: '1px solid transparent',
  },
};

export function Button({
  variant = 'primary',
  fullWidth = false,
  children,
  className = '',
  style,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`${fullWidth ? 'w-full' : ''} py-3 px-4 font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] focus-ring tap-target disabled:opacity-50 disabled:pointer-events-none ${className}`}
      style={{ borderRadius: 'var(--radius-control)', ...variantStyles[variant], ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}
