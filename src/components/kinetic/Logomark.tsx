'use client';

interface LogomarkProps {
  /** Box size in px — 30 for the Home header, 48 for the auth screen */
  size?: number;
}

/**
 * Kinetic "K" logomark — rounded square (radius ~30% of size), surface bg,
 * blue border tint, Sora 800 "K" in primary blue. Pure CSS per the handoff spec.
 */
export function Logomark({ size = 30 }: LogomarkProps) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: 'var(--color-surface-elevated)',
        border: '1px solid rgba(91, 156, 246, 0.35)',
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: size * 0.5,
        letterSpacing: '-0.03em',
        color: 'var(--color-primary)',
      }}
    >
      K
    </span>
  );
}
