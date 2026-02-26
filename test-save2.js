const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text());
    });

    try {
        await page.goto('http://localhost:3000/log?date=2026-02-22');
        await page.waitForTimeout(2000);

        // In the UI, adding food can be done by typing in the Text Log Quick Add
        await page.click('text=Type');
        await page.fill('textarea', 'Banana');
        await page.click('button:has-text("Process")');

        console.log("Waiting 5 seconds for AI and autosave...");
        await page.waitForTimeout(5000);

        // Let's also try adding a favorite food directly if possible
        const favButton = await page.$('text=Favorites');
        if (favButton) {
            await favButton.click();
            await page.waitForTimeout(1000);
            const addFav = await page.$$('.food-item-add-btn');
            // We don't know the exact class, but we can just wait longer to ensure the first save fired
        }
        await page.waitForTimeout(2000);

    } catch (e) {
        console.error("Test Script Error:", e);
    } finally {
        await browser.close();
    }
})();
