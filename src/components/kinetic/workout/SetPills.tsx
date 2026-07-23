'use client';

interface SetLike {
  weight: string;
  reps: string;
  completed: boolean;
}

interface Props {
  sets: SetLike[];
  /** Previous-session sets — used as ghost values for the current pill */
  prevSets?: { weight: number | string; reps: number | string }[];
  /** Optional: tap a pill to jump to its editable row */
  onPillTap?: (setIndex: number) => void;
}

/**
 * Kinetic set pills (mock 2c): done = green "185×8 ✓", current = gold "190×?",
 * pending = muted "—". Purely visual summary — the editable grid below is the
 * canonical input path.
 */
export function SetPills({ sets, prevSets, onPillTap }: Props) {
  const currentIndex = sets.findIndex(s => !s.completed);

  return (
    <div className="flex gap-2" role="list" aria-label="Sets">
      {sets.map((set, i) => {
        const isCurrent = i === currentIndex;
        const ghost = prevSets?.[i];

        let label: string;
        let style: React.CSSProperties;
        if (set.completed) {
          label = `${set.weight || '—'}×${set.reps || '—'} ✓`;
          style = {
            background: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-success) 40%, transparent)',
            color: 'var(--chart-2)',
            fontWeight: 700,
          };
        } else if (isCurrent) {
          const w = set.weight || (ghost ? String(ghost.weight) : '?');
          label = `${w}×${set.reps || '?'}`;
          style = {
            background: 'color-mix(in srgb, var(--color-gold) 16%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-gold) 50%, transparent)',
            color: 'var(--color-gold-text)',
            fontWeight: 800,
          };
        } else {
          label = '—';
          style = {
            background: 'var(--color-bg-muted)',
            border: '1px solid var(--color-border-light)',
            color: 'var(--color-text-muted)',
            fontWeight: 600,
          };
        }

        return (
          <button
            key={i}
            role="listitem"
            onClick={onPillTap ? () => onPillTap(i) : undefined}
            aria-label={`Set ${i + 1}: ${set.completed ? `done, ${set.weight}×${set.reps}` : isCurrent ? 'current' : 'pending'}`}
            className="flex-1 text-center py-2 text-xs tabular-nums focus-ring"
            style={{ ...style, borderRadius: 'var(--radius-control)' }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
