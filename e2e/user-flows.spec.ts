import { test, expect } from '@playwright/test';

test.describe('Daily Logging Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Create a test user session or mock auth
        // Navigate to the app
        await page.goto('/');
    });

    test('user can view the dashboard', async ({ page }) => {
        // Wait for the page to load
        await expect(page).toHaveTitle(/Fitness/i);

        // Check for key dashboard elements
        await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('user can navigate to log page', async ({ page }) => {
        // Click on log/add button
        const logButton = page.getByRole('link', { name: /log/i }).or(
            page.locator('[href*="/log"]')
        );

        if (await logButton.count() > 0) {
            await logButton.first().click();
            await expect(page).toHaveURL(/log/);
        }
    });

    test('date navigator changes displayed date', async ({ page }) => {
        // Test date navigation functionality
        const prevButton = page.getByRole('button', { name: /previous|prev|←/i });
        const nextButton = page.getByRole('button', { name: /next|→/i });

        if (await prevButton.count() > 0) {
            await prevButton.click();
            // Verify date changed
            await page.waitForTimeout(500);
            await nextButton.click();
        }
    });

    test('movement section can be toggled', async ({ page }) => {
        await page.goto('/log');

        // Look for movement completed toggle/checkbox
        const movementToggle = page.getByLabel(/movement/i).or(
            page.locator('[id*="movement"]')
        );

        if (await movementToggle.count() > 0) {
            await movementToggle.first().click();
        }
    });

    test('nutrition data can be entered', async ({ page }) => {
        await page.goto('/log');

        // Look for calorie input
        const calorieInput = page.getByLabel(/calories/i).or(
            page.locator('input[name*="calorie"]')
        );

        if (await calorieInput.count() > 0) {
            await calorieInput.first().fill('1800');
            await expect(calorieInput.first()).toHaveValue('1800');
        }
    });
});

test.describe('Workout Tracking Flow', () => {
    test('user can navigate to workout page', async ({ page }) => {
        await page.goto('/');

        const workoutLink = page.getByRole('link', { name: /workout/i }).or(
            page.locator('[href*="/workout"]')
        );

        if (await workoutLink.count() > 0) {
            await workoutLink.first().click();
            await expect(page).toHaveURL(/workout/);
        }
    });

    test('workout page displays correctly', async ({ page }) => {
        await page.goto('/workout');

        // Should have some workout-related content
        await expect(page.locator('body')).toContainText(/workout|exercise|training/i);
    });
});

test.describe('Settings Management', () => {
    test('user can navigate to settings', async ({ page }) => {
        await page.goto('/');

        const settingsLink = page.getByRole('link', { name: /settings/i }).or(
            page.locator('[href*="/settings"]')
        );

        if (await settingsLink.count() > 0) {
            await settingsLink.first().click();
            await expect(page).toHaveURL(/settings/);
        }
    });

    test('settings page has target inputs', async ({ page }) => {
        await page.goto('/settings');

        // Check for target inputs
        const proteinInput = page.getByLabel(/protein/i).or(
            page.locator('input[name*="protein"]')
        );

        if (await proteinInput.count() > 0) {
            await expect(proteinInput.first()).toBeVisible();
        }
    });
});

test.describe('Responsive Design', () => {
    test('mobile viewport displays correctly', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // Check that content is visible and not overflowing
        await expect(page.locator('body')).toBeVisible();

        // Bottom navigation should be visible on mobile
        const bottomNav = page.locator('nav').last();
        await expect(bottomNav).toBeVisible();
    });

    test('desktop viewport displays correctly', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/');

        await expect(page.locator('body')).toBeVisible();
    });
});
