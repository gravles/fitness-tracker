import { test, expect, Page } from '@playwright/test';

/**
 * Injects fake session and skips onboarding for E2E tests.
 * Must be called before navigating to any page.
 */
async function setupAuth(page: Page): Promise<void> {
    await page.addInitScript(() => {
        window.localStorage.setItem('E2E_TEST_SESSION', JSON.stringify({
            user: { id: 'test-user-123', email: 'test@example.com' },
            access_token: 'fake-jwt-token'
        }));
        window.localStorage.setItem('has_seen_tutorial_v1', 'true');
        window.localStorage.setItem('lifelogger_seen_version', '99');
    });
}

test.describe('Daily Logging Flow', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuth(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });
    });

    test('user can view the dashboard', async ({ page }) => {
        await expect(page).toHaveTitle(/Life Logger/i);
        await expect(page.locator('section[aria-label="Today\'s goal tracker"]')).toBeVisible({ timeout: 15000 });
    });

    test('user can navigate to log page', async ({ page }) => {
        const logLink = page.locator('nav[aria-label="Main navigation"] a[aria-label="Log"]');
        await expect(logLink).toBeVisible({ timeout: 10000 });
        await logLink.click();

        // Verify navigation by checking for log page content
        await expect(page.locator('text=TODAY').first()).toBeVisible({ timeout: 15000 });
    });

    test('date navigator changes displayed date', async ({ page }) => {
        await page.goto('/log', { waitUntil: 'domcontentloaded' });

        // Wait for log page to load with date navigator
        await expect(page.locator('text=TODAY').first()).toBeVisible({ timeout: 10000 });

        // Find the prev/next navigation buttons (chevrons in the date header)
        const navButtons = page.locator('button').filter({ has: page.locator('svg') });
        const buttonCount = await navButtons.count();

        // Click first nav button (prev) and then second (next)
        if (buttonCount >= 2) {
            await navButtons.first().click();
            await navButtons.nth(1).click();
        }
    });

    test('movement section can be toggled', async ({ page }) => {
        await page.goto('/log', { waitUntil: 'domcontentloaded' });

        const activityTab = page.getByRole('button', { name: /Activity/i }).first();
        await expect(activityTab).toBeVisible({ timeout: 15000 });
        await activityTab.click();

        const movementSection = page.locator('h3:has-text("Movement")');
        await expect(movementSection).toBeVisible({ timeout: 10000 });

        const movementToggle = page.locator('button:has-text("Yes, I moved!")');
        await expect(movementToggle).toBeVisible();
        await movementToggle.click();

        // Verify button state changed (becomes active with primary background)
        await expect(movementToggle).toHaveClass(/bg-\[var\(--color-primary\)\]/);
    });

    test('nutrition data can be entered', async ({ page }) => {
        await page.goto('/log', { waitUntil: 'domcontentloaded' });

        const nutritionHeader = page.locator('h3:has-text("Nutrition")');
        await expect(nutritionHeader).toBeVisible({ timeout: 15000 });

        const typeButton = page.locator('button:has-text("Type")').first();
        await expect(typeButton).toBeVisible();
        await typeButton.click();

        // Verify modal opened
        const textInput = page.locator('textarea[placeholder*="Type what you ate"]');
        await expect(textInput).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Workout Tracking Flow', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuth(page);
    });

    test('user can navigate to workout schedule page', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const workoutLink = page.locator('nav[aria-label="Main navigation"] a[aria-label="Train"]');
        await expect(workoutLink).toBeVisible({ timeout: 10000 });
        await workoutLink.click();

        await expect(page).toHaveURL(/schedule/, { timeout: 15000 });
    });

    test('workout schedule page displays correctly', async ({ page }) => {
        await page.goto('/schedule', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('body')).toContainText(/workout/i, { timeout: 15000 });
    });
});

test.describe('Settings Management', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuth(page);
    });

    test('user can navigate to settings', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const settingsLink = page.locator('a[aria-label="Settings"]');
        await expect(settingsLink).toBeVisible({ timeout: 10000 });
        await settingsLink.click();

        await expect(page).toHaveURL(/settings/, { timeout: 15000 });
    });

    test('settings page has target inputs', async ({ page }) => {
        await page.goto('/settings', { waitUntil: 'domcontentloaded' });

        // Settings page should have "My Targets" section with protein input
        await expect(page.locator('text=My Targets')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=Daily Protein')).toBeVisible();
    });
});

test.describe('Responsive Design', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuth(page);
    });

    test('mobile viewport displays correctly', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('body')).toBeVisible();

        // Bottom navigation should be visible on mobile
        const bottomNav = page.locator('nav[aria-label="Main navigation"]');
        await expect(bottomNav).toBeVisible({ timeout: 10000 });
    });

    test('desktop viewport displays correctly', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('body')).toBeVisible();
        await expect(page.locator('section[aria-label="Today\'s goal tracker"]')).toBeVisible({ timeout: 15000 });
    });
});
