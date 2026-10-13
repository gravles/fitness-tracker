import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
    getEarliestWeightEntries: vi.fn(),
    setBodyWeightForDate: vi.fn().mockResolvedValue(undefined),
    isAuthError: () => false,
}));

vi.mock('@/components/ConfirmDialog', () => ({
    confirm: vi.fn().mockResolvedValue(true),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { StartingWeightSection } from '../StartingWeightSection';
import { getEarliestWeightEntries, setBodyWeightForDate } from '@/lib/api';

const mockedGetEntries = vi.mocked(getEarliestWeightEntries);
const mockedSetWeight = vi.mocked(setBodyWeightForDate);

describe('StartingWeightSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when there are no weigh-ins', async () => {
        mockedGetEntries.mockResolvedValueOnce([]);
        const { container } = render(<StartingWeightSection weightUnit="imperial" />);
        await waitFor(() => expect(mockedGetEntries).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the first weigh-in and saves a corrected value in lbs', async () => {
        mockedGetEntries.mockResolvedValue([{ date: '2026-07-01', weight: 190 }]);
        render(<StartingWeightSection weightUnit="imperial" />);

        expect(await screen.findByText(/190 lbs/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reset starting weight' }));
        fireEvent.change(screen.getByLabelText(/Correct weight/), { target: { value: '180' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(mockedSetWeight).toHaveBeenCalledWith('2026-07-01', 180));
    });

    it('converts a metric correction to lbs before saving', async () => {
        mockedGetEntries.mockResolvedValue([{ date: '2026-07-01', weight: 220.5 }]);
        render(<StartingWeightSection weightUnit="metric" />);

        fireEvent.click(await screen.findByRole('button', { name: 'Reset starting weight' }));
        fireEvent.change(screen.getByLabelText(/Correct weight/), { target: { value: '80' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(mockedSetWeight).toHaveBeenCalledWith('2026-07-01', 176.4));
    });

    it('offers a one-tap fix when the first weigh-in was saved in kg', async () => {
        // 81.6 kg ≈ 179.9 lbs, matching the next weigh-in
        mockedGetEntries.mockResolvedValue([
            { date: '2026-07-01', weight: 81.6 },
            { date: '2026-07-02', weight: 180 },
        ]);
        render(<StartingWeightSection weightUnit="imperial" />);

        fireEvent.click(await screen.findByRole('button', { name: 'Fix to 179.9 lbs' }));
        await waitFor(() => expect(mockedSetWeight).toHaveBeenCalledWith('2026-07-01', 179.9));
    });

    it('does not suggest the kg fix for a normal starting weight', async () => {
        mockedGetEntries.mockResolvedValue([
            { date: '2026-07-01', weight: 185 },
            { date: '2026-07-02', weight: 184 },
        ]);
        render(<StartingWeightSection weightUnit="imperial" />);

        await screen.findByText(/185 lbs/);
        expect(screen.queryByRole('button', { name: /Fix to/ })).not.toBeInTheDocument();
    });

    it('removes the weigh-in after confirmation', async () => {
        mockedGetEntries.mockResolvedValue([{ date: '2026-07-01', weight: 190 }]);
        render(<StartingWeightSection weightUnit="imperial" />);

        fireEvent.click(await screen.findByRole('button', { name: 'Reset starting weight' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove this weigh-in' }));

        await waitFor(() => expect(mockedSetWeight).toHaveBeenCalledWith('2026-07-01', null));
    });
});
