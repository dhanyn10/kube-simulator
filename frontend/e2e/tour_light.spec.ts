import { test, expect } from '@playwright/test';

test('tour looks good in light mode', async ({ page }) => {
  await page.goto('http://127.0.0.1:3001');

  // Wait for the app to load
  await page.waitForSelector('button:has-text("Help")');

  // Toggle theme to light mode
  // The theme toggle is the first button with an SVG in the MenuBar
  await page.click('button:has(svg)');

  // Wait for light mode class on html element
  await page.waitForSelector('html.light');

  // Open Help menu
  await page.click('button:has-text("Help")');
  // Click Take a Tour
  await page.click('button:has-text("Take a Tour")');

  // Wait for shepherd to appear
  await page.waitForSelector('.shepherd-content');

  // Take screenshot
  await page.screenshot({ path: '../verification/shepherd_light.png' });
});
