'use client';

import { ReactNode, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

type Size = 'sm' | 'md' | 'lg';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Rendered as an accessible header with a close button. Omit to supply your own header (set aria-label instead). */
  title?: string;
  'aria-label'?: string;
  size?: Size;
  /** Bottom sheet on mobile, centered card on larger screens (default). Set false to always center. */
  sheet?: boolean;
  /** Allow Escape / backdrop click to close (default true). */
  dismissible?: boolean;
  /** 'top' renders above other modals (confirm dialogs, pickers opened from a modal). */
  zTier?: 'modal' | 'top';
  /** Extra classes for the panel */
  className?: string;
  /** Remove default panel padding (for media-heavy content) */
  padding?: boolean;
}

const sizeClass: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Track nested modals so body scroll unlocks only when the last one closes. */
let scrollLockCount = 0;

/**
 * Shared accessible modal shell: role="dialog", aria-modal, Escape-to-close,
 * focus trap + restore, body scroll lock, standardized backdrop.
 */
export function Modal({
  isOpen,
  onClose,
  children,
  title,
  'aria-label': ariaLabel,
  size = 'md',
  sheet = true,
  dismissible = true,
  zTier = 'modal',
  className = '',
  padding = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    scrollLockCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0) document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus management: save/restore focus, focus the panel on open
  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    // Focus the first focusable element, or the panel itself
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    }
    return () => {
      previousFocus.current?.focus?.();
    };
  }, [isOpen]);

  // Escape + focus trap
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.offsetParent !== null || el === document.activeElement
      );
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
    // Bubble phase so controls inside the dialog (e.g. an inline prompt) can
    // handle Escape themselves and stopPropagation to keep the modal open.
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, dismissible, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 flex justify-center bg-black/60 backdrop-blur-sm ${
        sheet ? 'items-end sm:items-center' : 'items-center p-6'
      }`}
      style={{ zIndex: zTier === 'top' ? 'var(--z-modal-top, 300)' : 'var(--z-modal, 100)' }}
      onClick={dismissible ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className={`w-full ${sizeClass[size]} ${padding ? 'p-6' : ''} ${
          sheet ? 'rounded-t-3xl sm:rounded-3xl sm:mx-6 pb-safe sm:pb-6' : 'rounded-3xl'
        } max-h-[90dvh] overflow-y-auto shadow-2xl outline-none ${className}`}
        style={{
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border-light)',
        }}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 id={titleId} className="font-bold text-lg text-[var(--color-text)]">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 -mr-2 rounded-full transition-colors hover:bg-[var(--color-bg-subtle)] focus-ring tap-target"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
