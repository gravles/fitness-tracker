'use client';

import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

const fieldClass =
  'w-full px-4 py-3 bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] transition-colors focus:border-[var(--color-gold)] focus:bg-[var(--color-surface-elevated)]';
const fieldStyle = { borderRadius: 'var(--radius-control)' };

interface LabelledProps {
  label?: string;
}

export function Input({ label, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & LabelledProps) {
  const field = <input className={`${fieldClass} ${className}`} style={fieldStyle} {...rest} />;
  return label ? <Field label={label}>{field}</Field> : field;
}

export function Select({ label, className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & LabelledProps) {
  const field = (
    <select className={`${fieldClass} appearance-none ${className}`} style={fieldStyle} {...rest}>
      {children}
    </select>
  );
  return label ? <Field label={label}>{field}</Field> : field;
}

export function Textarea({ label, className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & LabelledProps) {
  const field = <textarea className={`${fieldClass} resize-none ${className}`} style={fieldStyle} {...rest} />;
  return label ? <Field label={label}>{field}</Field> : field;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
