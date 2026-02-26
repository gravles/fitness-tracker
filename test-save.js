const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Capture console logs from the browser
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER ERROR:', msg.text());
        } else {
            console.log('BROWSER LOG:', msg.text());
        }
    });

    try {
        await page.goto('http://localhost:3000/log?date=2026-02-22');
        await page.waitForTimeout(2000);

        // Add a food item
        await page.click('text=Type');
        await page.fill('textarea', 'Test apple');
        await page.click('button:has-text("Process")');

        console.log("Waiting 5 seconds for autosave to trigger...");
        await page.waitForTimeout(5000);

    } catch (e) {
        console.error("Test Script Error:", e);
    } finally {
        await browser.close();
    }
})();
