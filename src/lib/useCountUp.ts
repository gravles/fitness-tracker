'use client';

import { useEffect, useRef, useState } from 'react';

/** Animates a number from 0 (or its previous value) to `target`. Respects prefers-reduced-motion. */
export function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      if (reduceMotion) {
        setValue(target);
        fromRef.current = target;
        return;
      }
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs]);

  return value;
}
