import { test, expect } from '@playwright/test';

test('tour looks good in dark mode', async ({ page }) => {
  await page.goto('http://127.0.0.1:3001');
  await page.waitForSelector('button:has-text("Help")');
  await page.click('button:has-text("Help")');
  await page.click('button:has-text("Take a Tour")');
  await page.waitForSelector('.shepherd-content');
  await page.screenshot({ path: '../verification/final_dark.png' });
});

test('tour looks good in light mode', async ({ page }) => {
  await page.goto('http://127.0.0.1:3001');
  await page.waitForSelector('button[title="Toggle Theme"]');

  // Toggle theme
  await page.click('button[title="Toggle Theme"]');

  // Click Help and Start Tour
  await page.click('button:has-text("Help")');
  await page.click('button:has-text("Take a Tour")');

  await page.waitForSelector('.shepherd-content');
  // Wait a bit for transitions
  await page.waitForTimeout(500);
  await page.screenshot({ path: '../verification/final_light.png' });
});
