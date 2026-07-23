'use client';

interface SparklineProps {
  points: number[];
  color: string;
  width?: number;
  height?: number;
  'aria-label'?: string;
}

/**
 * Tiny inline-SVG 7-point sparkline for bento tiles (90×26 per the mock).
 * Draw-in animation is CSS-driven so the global reduced-motion rule disables it.
 */
export function Sparkline({ points, color, width = 90, height = 26, 'aria-label': ariaLabel }: SparklineProps) {
  if (points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const pts = points
    .map((v, i) => `${((i / (points.length - 1)) * width).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="mt-1.5 block"
      role="img"
      aria-label={ariaLabel ?? 'Trend sparkline'}
    >
      <polyline
        points={pts}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="spark-draw"
      />
    </svg>
  );
}
