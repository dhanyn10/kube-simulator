import { test, expect } from '@playwright/test';

const base = 'http://127.0.0.1:3000';

/**
 * Realistic flow: click a palette item (e.g. Pod) in the detached sidebar window
 * -> the node should appear in the MAIN window canvas.
 */
test('clicking Pod in detached palette adds it to main window canvas', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });

  // Detached left window via real button (browser fallback: manual goto)
  const detached = await context.newPage();
  await detached.goto(`${base}/?mode=sidebar-left`, { waitUntil: 'load' });
  await detached.waitForTimeout(800);

  // Click the Pod card in the detached palette
  await detached.locator('#sidebar-item-Pod').click();

  // The node should appear in the MAIN window canvas
  const node = page.locator('.react-flow__node-Pod').first();
  await expect(node).toBeVisible({ timeout: 5000 });
});
