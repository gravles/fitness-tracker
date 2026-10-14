import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({ getWorkouts: vi.fn() }));
vi.mock('@/lib/badges', () => ({ checkAndAwardBadges: vi.fn() }));
vi.mock('@/lib/haptics', () => ({ haptics: { tap: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/partner-api', () => ({ logSharedItem: vi.fn().mockResolvedValue(undefined) }));

import { LogSharedItemModal } from '../LogSharedItemModal';
import { getWorkouts } from '@/lib/api';
import { logSharedItem, SharedItem } from '@/lib/partner-api';

const base = {
    id: 's1', partnership_id: 'p1', from_user_id: 'f', to_user_id: 'me',
    message: 'Great ride!', status: 'new' as const, created_at: '2026-10-13T20:00:00Z', fromName: 'Alex',
};

const meal: SharedItem = {
    ...base, item_type: 'logged_meal',
    payload: { name: 'Pizza + 1 more', date: '2026-10-13', food_items: [
        { name: 'Pizza', calories: 800, protein: 30, quantity: 1 },
        { name: 'Salad', calories: 200, protein: 6 },
    ] },
};

const ride: SharedItem = {
    ...base, item_type: 'logged_activity',
    payload: { name: 'Cycling', date: '2026-10-12', activity_type: 'Cycling', duration: 90, intensity: 'Moderate', distance: 30000 },
};

describe('LogSharedItemModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getWorkouts).mockResolvedValue([]);
    });

    it('renders nothing without an item', () => {
        const { container } = render(<LogSharedItemModal item={null} onClose={vi.fn()} onLogged={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('logs a half portion of a shared meal on the original date', async () => {
        const onLogged = vi.fn();
        render(<LogSharedItemModal item={meal} onClose={vi.fn()} onLogged={onLogged} />);

        expect(screen.getByText(/1000 kcal · 36g protein/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: '½' }));
        expect(screen.getByText(/500 kcal · 18g protein/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Add to my log' }));
        await waitFor(() => expect(logSharedItem).toHaveBeenCalledWith(meal, { date: '2026-10-13', portion: 0.5 }));
        expect(onLogged).toHaveBeenCalledWith(meal);
    });

    it('logs an activity with my own duration and calories', async () => {
        render(<LogSharedItemModal item={ride} onClose={vi.fn()} onLogged={vi.fn()} />);

        expect(screen.getByText(/30\.0 km/)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Duration (min)'), { target: { value: '85' } });
        fireEvent.change(screen.getByLabelText('Calories burned (optional)'), { target: { value: '640' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add to my log' }));

        await waitFor(() => expect(logSharedItem).toHaveBeenCalledWith(ride, { date: '2026-10-12', duration: 85, calories: 640 }));
    });

    it('warns when the same activity is already logged that day', async () => {
        vi.mocked(getWorkouts).mockResolvedValue([
            { id: 'x', date: '2026-10-12', activity_type: 'Ride', duration: 92, intensity: 'Moderate', source: 'strava' },
        ]);
        render(<LogSharedItemModal item={ride} onClose={vi.fn()} onLogged={vi.fn()} />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Ride (92 min)');
        expect(getWorkouts).toHaveBeenCalledWith('2026-10-12');
    });

    it('does not warn when nothing similar is logged', async () => {
        vi.mocked(getWorkouts).mockResolvedValue([
            { id: 'y', date: '2026-10-12', activity_type: 'Yoga', duration: 30, intensity: 'Light' },
        ]);
        render(<LogSharedItemModal item={ride} onClose={vi.fn()} onLogged={vi.fn()} />);
        await waitFor(() => expect(getWorkouts).toHaveBeenCalled());
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
