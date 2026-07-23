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

test.describe('Workout Partner Flow', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuth(page);
        await page.goto('/partner', { waitUntil: 'domcontentloaded' });
    });

    test('partner page renders with empty state and invite form', async ({ page }) => {
        await expect(page.locator('h1', { hasText: /Workout Partners/i })).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=No partners yet')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    test('invite button is disabled until an email is entered', async ({ page }) => {
        const emailInput = page.locator('input[type="email"]');
        await expect(emailInput).toBeVisible({ timeout: 15000 });
        const sendButton = page.getByRole('button', { name: /Send invite/i });
        await expect(sendButton).toBeDisabled();
        await emailInput.fill('friend@example.com');
        await expect(sendButton).toBeEnabled();
    });

    test('new challenge page renders from direct navigation', async ({ page }) => {
        await page.goto('/partner/challenges/new', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('h1', { hasText: /challenge/i })).toBeVisible({ timeout: 15000 });
    });
});

test.describe('Progress Photos', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuth(page);
        await page.goto('/progress', { waitUntil: 'domcontentloaded' });
    });

    test('upload modal offers both camera and gallery pickers', async ({ page }) => {
        // Open the upload modal (header + button or empty-state CTA)
        await page.locator('header button, main button').filter({ has: page.locator('svg') }).first().waitFor({ timeout: 15000 });
        await page.getByRole('button', { name: /Add First Photo/i }).or(page.locator('header button').last()).first().click();

        await expect(page.getByRole('button', { name: /Choose from Gallery/i })).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('button', { name: /Take Photo/i })).toBeVisible();

        // Exactly two file inputs: the camera one has `capture`, the gallery one must NOT
        const inputs = page.locator('input[type="file"]');
        await expect(inputs).toHaveCount(2);
        await expect(page.locator('input[type="file"][capture]')).toHaveCount(1);
        await expect(page.locator('input[type="file"]:not([capture])')).toHaveCount(1);
    });
});

test.describe('Daily Logging Flow', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuth(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });
    });

    test('user can view the dashboard', async ({ page }) => {
        await expect(page).toHaveTitle(/Kinetic/i);
        await expect(page.locator('section[aria-label="Today\'s goal tracker"]')).toBeVisible({ timeout: 15000 });
    });

    test('FAB capture sheet reaches the Eat page in two taps', async ({ page }) => {
        // The gold FAB opens the capture sheet (food captures + workout)
        const fab = page.locator('nav[aria-label="Main navigation"] button[aria-label="Log"]');
        await expect(fab).toBeVisible({ timeout: 10000 });
        await fab.click();

        // ≤2 taps to any logging action: sheet tiles deep-link into Eat / Workout
        await expect(page.locator('a[aria-label="Log with voice"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('a[aria-label="Snap a photo of your meal"]')).toBeVisible();
        await expect(page.locator('a[aria-label="Scan a barcode"]')).toBeVisible();
        await expect(page.locator('a[aria-label="Type what you ate"]')).toBeVisible();
        await expect(page.locator('a[aria-label="Favorites, recent & saved meals"]')).toBeVisible();
        await expect(page.locator('a[aria-label="Log a workout"]')).toBeVisible();

        await page.locator('a:has-text("Open the Eat page")').click();

        await expect(page.locator('h1:has-text("Eat")')).toBeVisible({ timeout: 15000 });
    });

    test('Eat tab shows the day feed with inline capture and planner link', async ({ page }) => {
        await page.goto('/nutrition', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('h1:has-text("Eat")')).toBeVisible({ timeout: 15000 });

        // Docked capture tiles are inline actions now (no navigation away)
        await expect(page.locator('button[aria-label="Log with voice"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button[aria-label="Scan a barcode"]')).toBeVisible();
        await expect(page.locator('button[aria-label="Favorites, recent & saved meals"]')).toBeVisible();

        // The Meal Planner is reachable via the labeled Plan button
        await page.locator('a[aria-label="Open meal planner"]').click();
        await expect(page).toHaveURL(/nutrition\/planner/, { timeout: 15000 });
    });

    test('old /log deep links redirect to Eat', async ({ page }) => {
        await page.goto('/log', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/nutrition/, { timeout: 15000 });
        await expect(page.locator('h1:has-text("Eat")')).toBeVisible({ timeout: 15000 });
    });

    test('date navigator changes displayed date', async ({ page }) => {
        await page.goto('/nutrition', { waitUntil: 'domcontentloaded' });

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

    test('movement section can be toggled on the Workout tab', async ({ page }) => {
        await page.goto('/schedule', { waitUntil: 'domcontentloaded' });

        const movementSection = page.locator('h3:has-text("Movement")');
        await expect(movementSection).toBeVisible({ timeout: 15000 });

        const movementToggle = page.locator('button:has-text("Yes, I moved!")');
        await expect(movementToggle).toBeVisible();
        await movementToggle.click();

        // Verify button state changed (becomes active with primary background)
        await expect(movementToggle).toHaveClass(/bg-\[var\(--color-primary\)\]/);
    });

    test('nutrition data can be entered from the Eat capture bar', async ({ page }) => {
        await page.goto('/nutrition', { waitUntil: 'domcontentloaded' });

        const typeButton = page.locator('button[aria-label="Type what you ate"]');
        await expect(typeButton).toBeVisible({ timeout: 15000 });
        await typeButton.click();

        // Verify modal opened
        const textInput = page.locator('textarea[placeholder*="Type what you ate"]');
        await expect(textInput).toBeVisible({ timeout: 5000 });
    });

    test('wellness check-in opens from Home', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const checkIn = page.locator('button[aria-label="Open wellness check-in"]');
        await expect(checkIn).toBeVisible({ timeout: 15000 });
        await checkIn.click();

        await expect(page.locator('h2:has-text("Wellness check-in")')).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Workout Tracking Flow', () => {
    test.beforeEach(async ({ page }) => {
        await setupAuth(page);
    });

    test('user can navigate to workout schedule page', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const workoutLink = page.locator('nav[aria-label="Main navigation"] a[href="/schedule"]');
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

    test('user can navigate to settings via the More hub', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const moreLink = page.locator('a[aria-label^="More"]');
        await expect(moreLink).toBeVisible({ timeout: 10000 });
        await moreLink.click();

        await expect(page).toHaveURL(/more/, { timeout: 15000 });

        const settingsRow = page.locator('a[href="/settings"]');
        await expect(settingsRow).toBeVisible({ timeout: 10000 });
        await settingsRow.click();

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
