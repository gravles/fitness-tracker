'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { Card } from './Card';
import { Button } from './Button';

interface LoadErrorProps {
  /** Called when the user taps Retry — should re-run the page's load function */
  onRetry: () => void;
  /** Optional override for the default "Couldn't load this page" title */
  title?: string;
  className?: string;
}

/**
 * Shared page-load failure state. Renders a card with a retry action so a
 * network failure is distinguishable from a genuine empty state.
 */
export function LoadError({ onRetry, title, className = '' }: LoadErrorProps) {
  const { t } = useLanguage();
  return (
    <Card className={`text-center ${className}`}>
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
        style={{ background: 'var(--color-gold-muted)', color: 'var(--color-gold-text)' }}
      >
        <WifiOff className="w-6 h-6" aria-hidden="true" />
      </div>
      <h2 className="font-semibold text-base text-[var(--color-text)] mb-1">
        {title || t.common.loadErrorTitle}
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">{t.common.loadErrorMessage}</p>
      <Button variant="gold" onClick={onRetry} className="mx-auto">
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        {t.common.retry}
      </Button>
    </Card>
  );
}
