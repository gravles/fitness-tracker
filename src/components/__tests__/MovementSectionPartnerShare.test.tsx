import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', () => ({
    addWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
    updateWorkout: vi.fn(),
}));
vi.mock('@/lib/partner-api', () => ({
    shareWithPartners: vi.fn(),
}));

const partners = [
    { id: 'p1', otherName: 'Alex', invitee_email: 'alex@example.com', otherUserId: 'u-alex', status: 'active' },
    { id: 'p2', otherName: 'Sam', invitee_email: 'sam@example.com', otherUserId: 'u-sam', status: 'active' },
];
let mockPartners: typeof partners = partners;
vi.mock('@/components/useActivePartners', () => ({ useActivePartners: () => mockPartners }));
vi.mock('@/components/ShareToPartnerSheet', () => ({
    ShareToPartnerSheet: ({ payload }: { payload: { name: string } }) => <div data-testid="share-sheet">{payload.name}</div>,
}));

import { MovementSection } from '../daily-log/MovementSection';
import { addWorkout } from '@/lib/api';
import { shareWithPartners } from '@/lib/partner-api';
import { toast } from 'sonner';

function renderSection(workouts = [] as Parameters<typeof MovementSection>[0]['workouts']) {
    return render(
        <MovementSection
            movementCompleted
            setMovementCompleted={vi.fn()}
            workouts={workouts}
            setWorkouts={vi.fn()}
            dateStr="2026-10-12"
            onOpenAiCoach={vi.fn()}
            onAddWorkoutStart={vi.fn()}
            addingWorkout={false}
            onDeleteWorkoutStart={vi.fn()}
        />,
    );
}

describe('MovementSection partner sharing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPartners = partners;
    });

    it('shares a custom workout with the partners tagged in "Did this with…"', async () => {
        vi.mocked(addWorkout).mockResolvedValue({
            id: 'w1', date: '2026-10-12', activity_type: 'Hiking', duration: 150, intensity: 'Moderate',
        });
        vi.mocked(shareWithPartners).mockResolvedValue({ sent: [partners[0]] as never, error: null });
        renderSection();

        fireEvent.click(screen.getByRole('button', { name: /Custom Workout/ }));
        fireEvent.change(screen.getByPlaceholderText('e.g. Cycling, Lifting, Yoga'), { target: { value: 'Hiking' } });
        fireEvent.click(screen.getByRole('button', { name: 'Alex' }));
        expect(screen.getByRole('button', { name: 'Alex' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Add Workout' }));

        await waitFor(() => expect(shareWithPartners).toHaveBeenCalledWith(
            [partners[0]],
            'logged_activity',
            { name: 'Hiking', date: '2026-10-12', activity_type: 'Hiking', duration: 150, intensity: 'Moderate' },
        ));
        expect(toast.success).toHaveBeenCalledWith('Shared with Alex');
    });

    it('does not share when nobody is tagged', async () => {
        vi.mocked(addWorkout).mockResolvedValue({ id: 'w2', date: '2026-10-12', activity_type: 'Yoga', duration: 30, intensity: 'Moderate' });
        renderSection();

        fireEvent.click(screen.getByRole('button', { name: /Custom Workout/ }));
        fireEvent.change(screen.getByPlaceholderText('e.g. Cycling, Lifting, Yoga'), { target: { value: 'Yoga' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add Workout' }));

        await waitFor(() => expect(addWorkout).toHaveBeenCalled());
        expect(shareWithPartners).not.toHaveBeenCalled();
    });

    it('opens the share sheet for an already-logged workout', () => {
        renderSection([{ id: 'w3', date: '2026-10-12', activity_type: 'Ride', duration: 90, intensity: 'Moderate', average_heartrate: 140 }]);
        fireEvent.click(screen.getByRole('button', { name: 'Share with partner: Ride' }));
        expect(screen.getByTestId('share-sheet')).toHaveTextContent('Ride');
    });

    it('hides partner features for users without partners', () => {
        mockPartners = [];
        renderSection([{ id: 'w4', date: '2026-10-12', activity_type: 'Ride', duration: 90, intensity: 'Moderate' }]);
        fireEvent.click(screen.getByRole('button', { name: /Custom Workout/ }));
        expect(screen.queryByText('Did this with…')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Share with partner/ })).not.toBeInTheDocument();
    });
});
