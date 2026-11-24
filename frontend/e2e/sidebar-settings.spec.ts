import { test, expect } from '@playwright/test';

const base = 'http://127.0.0.1:3000';

test('gear on Internet card opens Settings tab in attached mode', async ({ page }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });

  // Expand "Others" section (contains Internet card)
  await page.locator('.sidebar-section-toggle-btn', { hasText: 'Others' }).click();
  await page.locator('#sidebar-item-Internet').click();
  await page.locator('.react-flow__node').filter({ hasText: 'Internet' }).first().waitFor({ state: 'visible', timeout: 10000 });

  const nodeCard = page.locator('.react-flow__node').filter({ hasText: 'Internet' }).first();
  await nodeCard.hover();
  await nodeCard.locator('button').filter({ has: page.locator('svg.lucide-settings') }).first().click({ force: true });

  await expect(async () => {
    const body = await page.evaluate(() => document.body.innerText);
    expect(body.includes('Modify element properties') || body.includes('Select an element on the canvas')).toBe(true);
  }).toPass({ timeout: 5000 });
  await expect(page.locator('text=HARDWARE BUDGET').first()).toHaveCount(0);
});
