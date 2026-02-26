const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('request', request => {
        if (request.url().includes('supabase') && request.method() === 'POST') {
            const postData = request.postData();
            if (postData && postData.includes('daily_logs')) {
                console.log('PAYLOAD INTERCEPTED:', postData);
            }
        }
    });

    try {
        await page.goto('http://localhost:3000/log?date=2026-02-22');
        await page.waitForLoadState('networkidle');

        await page.click('text=Type');
        await page.fill('textarea', 'Banana');
        await page.click('button:has-text("Process")');

        await page.waitForTimeout(5000);
    } catch (e) {
        console.error("Test Error:", e);
    } finally {
        await browser.close();
    }
})();
