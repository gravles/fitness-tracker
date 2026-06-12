'use client';

import { useEffect, useState } from 'react';

export interface RingSpec {
  /** 0..1+ — values above 1 render as a full ring */
  progress: number;
  color: string;
  label?: string;
}

interface ProgressRingProps {
  /** Outermost ring first */
  rings: RingSpec[];
  size?: number;
  strokeWidth?: number;
  gap?: number;
  className?: string;
  'aria-label'?: string;
}

export function ProgressRing({
  rings,
  size = 116,
  strokeWidth = 8,
  gap = 4,
  className = '',
  'aria-label': ariaLabel,
}: ProgressRingProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const center = size / 2;
  const outerRadius = center - strokeWidth / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel ?? 'Progress rings'}
      className={className}
    >
      {rings.map((ring, i) => {
        const radius = outerRadius - i * (strokeWidth + gap);
        if (radius <= strokeWidth) return null;
        const circumference = 2 * Math.PI * radius;
        const clamped = Math.min(1, Math.max(0, ring.progress));
        const offset = mounted ? circumference * (1 - clamped) : circumference;
        return (
          <g key={i}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="var(--color-bg-muted)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={ring.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${center} ${center})`}
              style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
            >
              {ring.label && <title>{ring.label}</title>}
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
