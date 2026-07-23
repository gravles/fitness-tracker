'use client';

import Link from 'next/link';
import { Mic, Camera, Barcode, Keyboard, Heart, Dumbbell, NotebookPen } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { Modal } from '@/components/ui';

interface CaptureTilesProps {
  /** Called after a tile is tapped (close the sheet before navigating away). */
  onNavigate?: () => void;
  /** Icon-only single row — used by the Eat screen's docked bar to stay low-profile. */
  compact?: boolean;
}

/**
 * The capture grid — every quick way to get something into today's log.
 * Food captures deep-link into the daily log's flows; Workout lands on the
 * log's Activity tab (presets, custom entry, AI coach). Shared between the
 * FAB sheet and the Eat screen's docked capture bar.
 */
export function CaptureTiles({ onNavigate, compact = false }: CaptureTilesProps) {
  const { t } = useLanguage();

  const tiles = [
    { href: '/nutrition?action=voice', icon: Mic, label: t.dashboard.voiceLog, ariaLabel: 'Log with voice' },
    { href: '/nutrition?action=camera', icon: Camera, label: t.dashboard.snapMeal, ariaLabel: 'Snap a photo of your meal' },
    { href: '/nutrition?action=barcode', icon: Barcode, label: t.dashboard.barcode, ariaLabel: 'Scan a barcode' },
    { href: '/nutrition?action=text', icon: Keyboard, label: t.nutrition.actions.type, ariaLabel: 'Type what you ate' },
    { href: '/nutrition?action=favorites', icon: Heart, label: t.nutrition.actions.favorites, ariaLabel: 'Favorites, recent & saved meals' },
    { href: '/schedule', icon: Dumbbell, label: t.nav.workout, ariaLabel: 'Log a workout' },
  ];

  if (compact) {
    return (
      <div className="flex justify-between gap-1.5">
        {tiles.map(({ href, icon: Icon, ariaLabel }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-label={ariaLabel}
            title={ariaLabel}
            className="flex-1 flex items-center justify-center tap-target focus-ring transition-kinetic active:scale-[0.95]"
            style={{
              borderRadius: 14,
              background: 'var(--color-gold-muted)',
              border: '1px solid var(--color-gold-border)',
            }}
          >
            <Icon className="w-[18px] h-[18px]" style={{ color: 'var(--color-gold-text)' }} aria-hidden="true" />
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {tiles.map(({ href, icon: Icon, label, ariaLabel }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-label={ariaLabel}
          className="flex flex-col items-center gap-1.5 px-1 py-2.5 tap-target focus-ring transition-kinetic active:scale-[0.97]"
          style={{
            borderRadius: 14,
            background: 'var(--color-gold-muted)',
            border: '1px solid var(--color-gold-border)',
          }}
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: 'var(--color-gold-text)' }} aria-hidden="true" />
          <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">{label}</span>
        </Link>
      ))}
    </div>
  );
}

interface CaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Bottom capture sheet opened by the gold FAB from any tab. */
export function CaptureSheet({ isOpen, onClose }: CaptureSheetProps) {
  const { t } = useLanguage();

  return (
    <Modal isOpen={isOpen} onClose={onClose} aria-label={t.dashboard.quickAdd} size="sm" padding={false}>
      <div className="px-5 pt-2.5 pb-4">
        {/* Drag handle */}
        <div
          aria-hidden="true"
          className="mx-auto mb-3"
          style={{ width: 36, height: 4, borderRadius: 100, background: 'var(--color-bg-muted)' }}
        />
        <CaptureTiles onNavigate={onClose} />
        <Link
          href="/nutrition"
          onClick={onClose}
          className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] tap-target focus-ring rounded-xl"
        >
          <NotebookPen className="w-3.5 h-3.5" aria-hidden="true" />
          {t.dashboard.openFullLog}
        </Link>
      </div>
    </Modal>
  );
}
