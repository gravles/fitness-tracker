import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { format } from 'date-fns';
import { FoodItemEditModal } from '@/components/daily-log/FoodItemEditModal';
import { FoodItem } from '@/lib/api';

// Local-noon timestamp so date-of-day assertions are timezone-stable
const LOGGED_AT = new Date('2026-07-21T12:40:00').toISOString();

const item: FoodItem = {
  name: 'Chicken bowl',
  calories: 600,
  protein: 45,
  carbs: 50,
  fat: 15,
  quantity: 1,
  logged_at: LOGGED_AT,
  source: 'voice',
};

function quantityInput() {
  // number inputs render in DOM order: quantity, calories, protein, carbs, fat
  return screen.getAllByRole('spinbutton')[0];
}

describe('FoodItemEditModal', () => {
  it('scales the totals row proportionally when quantity changes', () => {
    render(<FoodItemEditModal item={item} entryDate="2026-07-21" onSave={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText(/600 kcal · 45g P · 50g C · 15g F/)).toBeInTheDocument();

    fireEvent.change(quantityInput(), { target: { value: '0.5' } });
    expect(screen.getByText(/300 kcal · 23g P · 25g C · 8g F/)).toBeInTheDocument();

    fireEvent.change(quantityInput(), { target: { value: '2' } });
    expect(screen.getByText(/1200 kcal · 90g P · 100g C · 30g F/)).toBeInTheDocument();
  });

  it('saves an edited time on the same day without reporting a move', () => {
    const onSave = vi.fn();
    render(<FoodItemEditModal item={item} entryDate="2026-07-21" allowDateMove onSave={onSave} onClose={vi.fn()} />);

    const timeInput = document.querySelector('input[type="time"]')!;
    fireEvent.change(timeInput, { target: { value: '08:15' } });
    fireEvent.click(screen.getByText('Save Changes'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [updated, targetDate] = onSave.mock.calls[0];
    expect(targetDate).toBeUndefined();
    expect(format(new Date(updated.logged_at), 'yyyy-MM-dd HH:mm')).toBe('2026-07-21 08:15');
  });

  it('reports a date move and keeps the original time of day', () => {
    const onSave = vi.fn();
    render(<FoodItemEditModal item={item} entryDate="2026-07-21" allowDateMove onSave={onSave} onClose={vi.fn()} />);

    const dateInput = document.querySelector('input[type="date"]')!;
    fireEvent.change(dateInput, { target: { value: '2026-07-22' } });
    fireEvent.click(screen.getByText('Save Changes'));

    const [updated, targetDate] = onSave.mock.calls[0];
    expect(targetDate).toBe('2026-07-22');
    expect(format(new Date(updated.logged_at), 'yyyy-MM-dd HH:mm')).toBe('2026-07-22 12:40');
  });

  it('hides the date field when moves are not allowed but still edits time', () => {
    const onSave = vi.fn();
    render(<FoodItemEditModal item={item} entryDate="2026-07-21" onSave={onSave} onClose={vi.fn()} />);

    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(document.querySelector('input[type="time"]')).not.toBeNull();

    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '19:05' } });
    fireEvent.click(screen.getByText('Save Changes'));
    const [updated, targetDate] = onSave.mock.calls[0];
    expect(targetDate).toBeUndefined();
    expect(format(new Date(updated.logged_at), 'HH:mm')).toBe('19:05');
  });

  it('leaves legacy items without a timestamp untouched when time is not set', () => {
    const onSave = vi.fn();
    const legacy: FoodItem = { name: 'Old entry', calories: 200, protein: 10, carbs: 20, fat: 5 };
    render(<FoodItemEditModal item={legacy} entryDate="2026-07-21" allowDateMove onSave={onSave} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Save Changes'));
    const [updated] = onSave.mock.calls[0];
    expect(updated.logged_at).toBeUndefined();
  });
});
