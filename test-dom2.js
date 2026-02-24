const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.goto('http://localhost:3000/log?date=2026-02-22');
        await page.waitForTimeout(2000);

        // Extract the HTML of the nutrition cards at the bottom FIRST
        const grid1 = await page.evaluate(() => {
            const cards = document.querySelectorAll('.bg-blue-50, .bg-orange-50');
            return Array.from(cards).map(c => c.innerHTML);
        });
        console.log("INITIAL CARD HTML:", grid1);

        // Find and add a food item using Quick Log
        await page.click('text=Type');
        await page.fill('textarea', 'Chicken breast and rice');
        await page.click('button:has-text("Process")');
        await page.waitForTimeout(5000); // 5 sec to wait for AI and rendering

        // Extract the HTML of the nutrition cards at the bottom again
        const grid2 = await page.evaluate(() => {
            const cards = document.querySelectorAll('.bg-blue-50, .bg-orange-50');
            return Array.from(cards).map(c => c.innerHTML);
        });

        console.log("FINAL CARD HTML:", grid2);

        const tabs = await page.evaluate(() => {
            const items = document.querySelectorAll('button span');
            return Array.from(items).map(i => i.innerHTML);
        });
        console.log("TABS:", tabs);
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
