const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text());
    });

    try {
        await page.goto('http://localhost:3000/log?date=2026-02-22');
        console.log("Waiting for network idle...");
        await page.waitForLoadState('networkidle');

        console.log("Looking for Type button...");
        // the button has "Type" text and an associated icon
        await page.waitForSelector('text=Type', { timeout: 10000 });
        await page.click('text=Type');

        console.log("Filling textarea...");
        await page.fill('textarea', 'Test Apple 100 calories');
        await page.click('button:has-text("Process")');

        console.log("Waiting 3 seconds for autosave...");
        await page.waitForTimeout(3000);

    } catch (e) {
        console.error("Test Script Error:", e);
    } finally {
        await browser.close();
    }
})();
