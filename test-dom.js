const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/log?date=2026-02-22');
    await page.waitForTimeout(2000);

    // Find and add a food item using Quick Log
    await page.click('text=Type');
    await page.fill('textarea', 'Chicken breast and rice');
    await page.click('button:has-text("Process")');
    await page.waitForTimeout(3000);

    // Extract the HTML of the nutrition cards at the bottom
    const grid = await page.evaluate(() => {
        const cards = document.querySelectorAll('.bg-blue-50, .bg-orange-50');
        const results = [];
        cards.forEach(card => {
            results.push(card.innerHTML);
        });
        return results;
    });

    console.log("CARD HTML:");
    console.log(JSON.stringify(grid, null, 2));

    await browser.close();
})();
