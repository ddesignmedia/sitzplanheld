const { test, expect } = require('@playwright/test');

test('verify tab wrapping', async ({ page }) => {
  await page.goto('file://' + __dirname + '/../index.html');

  // Add 12 tabs
  for (let i = 0; i < 11; i++) {
    await page.click('#addTabButton');
  }

  await page.screenshot({ path: 'e2e/screenshot.png' });
});
