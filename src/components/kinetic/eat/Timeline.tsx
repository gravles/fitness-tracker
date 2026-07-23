'use client';

import { useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, Copy, Pencil, Trash2, X, Heart } from 'lucide-react';
import { FoodItem, Workout } from '@/lib/api';
import { PlannedMeal } from '@/lib/meal-plan-api';

export type FeedEntry =
  | { kind: 'food'; item: FoodItem; index: number }
  | { kind: 'workout'; workout: Workout }
  | { kind: 'planned'; meal: PlannedMeal };

interface TimelineProps {
  entries: FeedEntry[];
  onDuplicate: (item: FoodItem) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onFavorite?: (item: FoodItem) => void;
  onLogPlanned: (meal: PlannedMeal) => void;
  onSkipPlanned: (meal: PlannedMeal) => void;
}

const SOURCE_LABEL: Record<string, string> = {
  voice: 'voice logged',
  photo: 'snapped with camera',
  barcode: 'barcode scan',
  manual: 'quick add',
  plan: 'from meal plan',
};

function entryTime(e: FeedEntry): string | null {
  if (e.kind === 'food') {
    return e.item.logged_at ? format(parseISO(e.item.logged_at), 'HH:mm') : null;
  }
  if (e.kind === 'workout') {
    return e.workout.created_at ? format(parseISO(e.workout.created_at), 'HH:mm') : null;
  }
  return e.meal.scheduled_time ? e.meal.scheduled_time.slice(0, 5) : null;
}

function dotColor(e: FeedEntry): string {
  if (e.kind === 'planned') return 'var(--color-gold)';
  if (e.kind === 'workout') return 'var(--color-primary)';
  return e.item.source === 'voice' ? 'var(--color-primary)' : 'var(--chart-2)';
}

const qty = (item: FoodItem) => {
  const q = parseFloat(String(item.quantity ?? 1));
  return isNaN(q) ? 1 : q;
};

/** Swipe-right = duplicate; long-press = edit; the ⋯ menu is the always-visible tap path. */
function FoodCard({
  entry,
  onDuplicate,
  onEdit,
  onDelete,
  onFavorite,
}: {
  entry: Extract<FeedEntry, { kind: 'food' }>;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFavorite?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const gesture = useRef<{ startX: number; startY: number; horizontal: boolean | null; longPress: ReturnType<typeof setTimeout> | null; fired: boolean }>({
    startX: 0, startY: 0, horizontal: null, longPress: null, fired: false,
  });

  const { item } = entry;
  const time = entryTime(entry);
  const method = item.source ? SOURCE_LABEL[item.source] : null;
  const sub = [time, method].filter(Boolean).join(' · ') || item.portion_estimate || 'logged';
  const color = dotColor(entry);

  function clearGesture() {
    if (gesture.current.longPress) clearTimeout(gesture.current.longPress);
    gesture.current.longPress = null;
  }

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="absolute -left-[21px] top-2 w-2 h-2 rounded-full"
        style={{ background: color }}
      />
      <div
        className="flex justify-between items-center px-3.5 py-3 select-none"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 16,
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragX ? undefined : 'transform 0.3s var(--ease-kinetic)',
        }}
        onPointerDown={e => {
          // Capture so move/up keep firing even if the pointer leaves the card —
          // without this a swipe released off-card left the card stuck mid-drag
          e.currentTarget.setPointerCapture?.(e.pointerId);
          gesture.current = {
            startX: e.clientX,
            startY: e.clientY,
            horizontal: null,
            fired: false,
            longPress: setTimeout(() => {
              gesture.current.fired = true;
              onEdit();
            }, 550),
          };
        }}
        onPointerMove={e => {
          const g = gesture.current;
          if (g.fired) return;
          const dx = e.clientX - g.startX;
          const dy = e.clientY - g.startY;
          if (g.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            g.horizontal = Math.abs(dx) > Math.abs(dy);
            if (g.longPress) clearTimeout(g.longPress);
          }
          if (g.horizontal) setDragX(Math.max(0, Math.min(96, dx)));
        }}
        onPointerUp={() => {
          const g = gesture.current;
          clearGesture();
          if (!g.fired && g.horizontal && dragX > 72) onDuplicate();
          setDragX(0);
        }}
        onPointerCancel={() => {
          clearGesture();
          setDragX(0);
        }}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[var(--color-text)] truncate">{item.name}</p>
          <p className="mt-px text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
            {Math.round((item.protein || 0) * qty(item))}g · {Math.round((item.calories || 0) * qty(item))}
          </span>
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label={`Actions for ${item.name}`}
            aria-expanded={menuOpen}
            className="p-1.5 rounded-lg tap-target focus-ring"
            style={{ color: 'var(--color-text-muted)', minWidth: 32, minHeight: 32 }}
          >
            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className="absolute right-0 top-full mt-1 z-20 py-1 rounded-xl shadow-lg"
          style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)' }}
          role="menu"
        >
          {[
            { label: 'Duplicate', icon: Copy, action: onDuplicate },
            { label: 'Edit', icon: Pencil, action: onEdit },
            ...(onFavorite ? [{ label: 'Favorite', icon: Heart, action: onFavorite }] : []),
            { label: 'Delete', icon: Trash2, action: onDelete, danger: true },
          ].map(({ label, icon: Icon, action, danger }) => (
            <button
              key={label}
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                action();
              }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-xs font-semibold focus-ring"
              style={{ color: danger ? 'var(--color-danger)' : 'var(--color-text)' }}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Day-feed timeline with the gold→blue rail (Kinetic mock 2b). */
export function Timeline({ entries, onDuplicate, onEdit, onDelete, onFavorite, onLogPlanned, onSkipPlanned }: TimelineProps) {
  return (
    <div className="relative pl-[22px] flex flex-col gap-3">
      <div
        aria-hidden="true"
        className="absolute left-1.5 top-1.5 bottom-1.5 w-0.5 rounded-full"
        style={{ background: 'var(--gradient-rail)', opacity: 0.35 }}
      />

      {entries.map((entry, i) => {
        if (entry.kind === 'food') {
          return (
            <FoodCard
              key={`food-${entry.index}-${i}`}
              entry={entry}
              onDuplicate={() => onDuplicate(entry.item)}
              onEdit={() => onEdit(entry.index)}
              onDelete={() => onDelete(entry.index)}
              onFavorite={onFavorite ? () => onFavorite(entry.item) : undefined}
            />
          );
        }

        const color = dotColor(entry);
        const time = entryTime(entry);

        if (entry.kind === 'workout') {
          const w = entry.workout;
          return (
            <div key={`workout-${w.id ?? i}`} className="relative">
              <span aria-hidden="true" className="absolute -left-[21px] top-2 w-2 h-2 rounded-full" style={{ background: color }} />
              <div
                className="flex justify-between items-center px-3.5 py-3"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 16 }}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[var(--color-text)] truncate">{w.activity_type}</p>
                  <p className="mt-px text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {[time, w.source === 'strava' ? 'synced from Strava' : 'workout'].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-bold" style={{ color }}>
                  {w.duration} min
                </span>
              </div>
            </div>
          );
        }

        const meal = entry.meal;
        return (
          <div key={`planned-${meal.id}`} className="relative">
            <span aria-hidden="true" className="absolute -left-[21px] top-2 w-2 h-2 rounded-full" style={{ background: color, opacity: 0.7 }} />
            {/* Suggestion, not a logged entry — dashed and dimmed to keep actual food primary */}
            <div
              className="flex justify-between items-center gap-2 px-3.5 py-3"
              style={{
                background: 'transparent',
                border: `1.5px dashed color-mix(in srgb, ${color} 45%, transparent)`,
                borderRadius: 16,
                opacity: 0.9,
              }}
            >
              <div className="min-w-0">
                <p className="text-[13px] font-bold truncate" style={{ color: 'var(--color-text-secondary)' }}>{meal.name}</p>
                <p className="mt-px text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {[time ?? meal.slot, 'planned', `${meal.protein}g protein`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onLogPlanned(meal)}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-full focus-ring tap-target"
                  style={{ color, border: `1px solid color-mix(in srgb, ${color} 40%, transparent)` }}
                  aria-label={`Log planned meal ${meal.name}`}
                >
                  Ate it
                </button>
                <button
                  onClick={() => onSkipPlanned(meal)}
                  className="p-1.5 rounded-full focus-ring tap-target"
                  style={{ color: 'var(--color-text-muted)', minWidth: 32, minHeight: 32 }}
                  aria-label={`Skip planned meal ${meal.name} — off plan`}
                  title="Skip — off plan"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <div
        className="text-center text-xs px-3.5 py-2.5"
        style={{
          border: '1.5px dashed var(--color-border)',
          borderRadius: 16,
          color: 'var(--color-text-muted)',
        }}
      >
        Swipe right to duplicate · hold to edit · ⋯ for all actions
      </div>
    </div>
  );
}
