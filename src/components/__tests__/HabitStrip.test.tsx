import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { format, subDays } from 'date-fns';
import { HabitStrip } from '@/components/kinetic/HabitStrip';
import { DailyLog } from '@/lib/api';

function logFor(daysAgo: number, patch: Partial<DailyLog>): DailyLog {
  return { date: format(subDays(new Date(), daysAgo), 'yyyy-MM-dd'), ...patch };
}

describe('HabitStrip', () => {
  it('renders 7 day links pointing at each day\'s log', () => {
    render(<HabitStrip logs={[]} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(7);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    expect(links[6]).toHaveAttribute('href', `/nutrition?date=${todayStr}`);
  });

  it('marks nutrition + movement days complete', () => {
    render(<HabitStrip logs={[logFor(0, { nutrition_logged: true, movement_completed: true })]} />);
    expect(screen.getByLabelText(new RegExp(`${format(new Date(), 'EEEE')}: complete`))).toBeInTheDocument();
  });

  it('treats calories > 0 as nutrition even without the flag', () => {
    render(<HabitStrip logs={[logFor(0, { calories: 500, movement_completed: true })]} />);
    expect(screen.getByLabelText(/complete/)).toBeInTheDocument();
  });

  it('marks single-signal days partial', () => {
    render(<HabitStrip logs={[
      logFor(0, { movement_completed: true }),
      logFor(1, { sleep_quality: 4 }),
    ]} />);
    expect(screen.getAllByLabelText(/partial/)).toHaveLength(2);
  });

  it('marks empty days as no activity', () => {
    render(<HabitStrip logs={[]} />);
    expect(screen.getAllByLabelText(/no activity/)).toHaveLength(7);
  });
});
