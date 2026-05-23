import { test, expect } from '@playwright/test';

test('verify final sidebar layout', async ({ page }) => {
  await page.goto('http://localhost:3001');

  await page.waitForSelector('.react-flow');

  // 1. Check Hardware Budget (default)
  await expect(page.locator('h3').filter({ hasText: /HARDWARE BUDGET/i })).toBeVisible();

  // 2. Add and Select Node using Store
  await page.evaluate(() => {
    // @ts-ignore
    const { addNode, setConfiguringNodeId } = globalThis.useFlowStore.getState();
    addNode('Pod', { x: 100, y: 100 });

    const nodes = globalThis.useFlowStore.getState().nodes;
    const pod = nodes.find(n => n.type === 'Pod');
    if (pod) setConfiguringNodeId(pod.id);
  });

  // Verify Config header
  await expect(page.locator('h3').filter({ hasText: /Pod Config/i })).toBeVisible();

  // 3. Toggle Indicators from Canvas Dropdown
  await page.locator('button').filter({ hasText: /CANVAS/i }).click();

  const objStatsItem = page.locator('button').filter({ hasText: 'Object Statistics' });
  const hasCheck = await objStatsItem.locator('svg.text-blue-500').count() > 0;

  if (!hasCheck) {
    await objStatsItem.click();
  }

  await page.mouse.click(0, 0); // close dropdown

  // Verify INDICATORS header
  await expect(page.locator('h3').filter({ hasText: /INDICATORS/i })).toBeVisible();

  // Screenshot
  await page.screenshot({ path: '/home/jules/verification/sidebar_final_v6.png' });
});
