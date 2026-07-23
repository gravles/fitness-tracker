'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { useFabAction } from '@/components/kinetic/FabContext';
import { CaptureSheet } from '@/components/kinetic/CaptureSheet';

interface Tab {
  href: string;
  label: string;
}

/**
 * Kinetic floating glass pill nav: Home · Workout · [gold FAB] · Eat · Trends.
 * The FAB is context-aware — screens may register an action via FabContext;
 * otherwise it opens the capture sheet.
 */
export function KineticNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { action } = useFabAction();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');

  const leftTabs: Tab[] = [
    { href: '/', label: t.nav.home },
    { href: '/schedule', label: t.nav.workout },
  ];
  const rightTabs: Tab[] = [
    { href: '/nutrition', label: t.nav.eat },
    { href: '/trends', label: t.nav.trends },
  ];

  const renderTab = ({ href, label }: Tab) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className="tap-target focus-ring rounded-full px-3"
      >
        <span
          className="text-[11px] tracking-wide transition-colors duration-200"
          style={{
            fontWeight: active ? 700 : 500,
            color: active ? 'var(--color-gold-text)' : 'var(--color-text-muted)',
          }}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Fade scrolling content out before it reaches the floating pill */}
      <div aria-hidden="true" className="bottom-scrim" style={{ height: 110 }} />
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="fixed inset-x-0 max-w-2xl mx-auto px-3.5 pointer-events-none"
        style={{ bottom: 'max(14px, env(safe-area-inset-bottom))', zIndex: 'var(--z-nav, 50)' }}
      >
        <div className="glass-nav pointer-events-auto flex justify-around items-center rounded-full px-2 py-1">
          {leftTabs.map(renderTab)}

          <button
            onClick={() => (action ? action.onPress() : setSheetOpen(true))}
            aria-label={action?.label ?? t.nav.log}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 focus-ring transition-kinetic active:scale-95"
            style={{ background: 'var(--gradient-fab)', boxShadow: 'var(--shadow-fab)' }}
          >
            {/* Dark icon on the gold gradient in both themes — navy is theme-invariant */}
            <Plus className="w-5 h-5" strokeWidth={2.5} style={{ color: 'var(--color-navy)' }} aria-hidden="true" />
          </button>

          {rightTabs.map(renderTab)}
        </div>
      </nav>

      <CaptureSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
