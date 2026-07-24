import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayDetailsCard } from '@/components/kinetic/eat/DayDetailsCard';
import type { DailyLog } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  upsertDailyLog: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/badges', () => ({ checkAndAwardBadges: vi.fn() }));
vi.mock('@/lib/haptics', () => ({ haptics: { tap: vi.fn(), success: vi.fn() } }));

const day = '2026-07-23';
const logWith = (drinks: number): DailyLog => ({ date: day, alcohol_drinks: drinks });

function drinkCount() {
  // The count sits between the "fewer"/"more" stepper buttons
  return screen.getByLabelText('One drink more').previousElementSibling!.textContent;
}

describe('DayDetailsCard', () => {
  it('re-syncs the drink count when the log updates externally (voice-logged beer, check-in)', () => {
    const { rerender } = render(<DayDetailsCard dateStr={day} log={logWith(0)} onSaved={vi.fn()} />);
    expect(drinkCount()).toBe('0');

    // Fresh log object arrives from a reload with drinks added elsewhere
    rerender(<DayDetailsCard dateStr={day} log={logWith(2)} onSaved={vi.fn()} />);
    expect(drinkCount()).toBe('2');
  });

  it('does not clobber a pending local edit with a stale reload', () => {
    const { rerender } = render(<DayDetailsCard dateStr={day} log={logWith(0)} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('One drink more'));
    expect(drinkCount()).toBe('1');

    // A reload with the pre-edit value lands while the save is still debouncing
    rerender(<DayDetailsCard dateStr={day} log={logWith(0)} onSaved={vi.fn()} />);
    expect(drinkCount()).toBe('1');
  });
});
