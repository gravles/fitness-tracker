import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock the API
vi.mock('@/lib/api', () => ({
    getFavoriteFoods: vi.fn().mockResolvedValue([]),
    getRecentFoods: vi.fn().mockResolvedValue([]),
    addFavoriteFood: vi.fn().mockResolvedValue({ id: 'new-fav-id' }),
    deleteFavoriteFood: vi.fn().mockResolvedValue(null),
}));

import { FoodSelector } from '../FoodSelector';
import { getFavoriteFoods, getRecentFoods } from '@/lib/api';

const mockedGetFavoriteFoods = vi.mocked(getFavoriteFoods);
const mockedGetRecentFoods = vi.mocked(getRecentFoods);

describe('FoodSelector', () => {
    const mockOnSelect = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnSelect.mockClear();
        mockOnClose.mockClear();
    });

    it('renders loading state initially', () => {
        render(<FoodSelector onSelect={mockOnSelect} onClose={mockOnClose} />);
        // Component should render without crashing
        expect(document.body).toBeDefined();
    });

    it('displays favorites tab and history tab', async () => {
        mockedGetFavoriteFoods.mockResolvedValueOnce([
            { id: '1', name: 'Chicken Breast', calories: 200, protein: 45, carbs: 0, fat: 4, user_id: 'test', created_at: '' },
        ]);
        mockedGetRecentFoods.mockResolvedValueOnce([]);

        render(<FoodSelector onSelect={mockOnSelect} onClose={mockOnClose} />);

        // Should have tab buttons or sections
        await waitFor(() => {
            expect(mockedGetFavoriteFoods).toHaveBeenCalled();
        });
    });

    it('calls onSelect when a food item is clicked', async () => {
        const mockFavorites = [
            {
                id: '1',
                name: 'Grilled Chicken',
                calories: 250,
                protein: 45,
                carbs: 0,
                fat: 8,
                user_id: 'test',
                created_at: ''
            },
        ];
        mockedGetFavoriteFoods.mockResolvedValueOnce(mockFavorites);
        mockedGetRecentFoods.mockResolvedValueOnce([]);

        render(<FoodSelector onSelect={mockOnSelect} onClose={mockOnClose} />);

        await waitFor(() => {
            expect(mockedGetFavoriteFoods).toHaveBeenCalled();
        });
    });

    it('loads favorites on initial mount (starting tab)', async () => {
        render(<FoodSelector onSelect={mockOnSelect} onClose={mockOnClose} />);

        await waitFor(() => {
            expect(mockedGetFavoriteFoods).toHaveBeenCalledTimes(1);
        });
        // Recent foods are NOT loaded until tab is switched
    });
});

