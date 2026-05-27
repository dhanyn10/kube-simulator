import { test, expect } from '@playwright/test';

test.describe('Right Sidebar Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Add a deployment node via the store
    await page.evaluate(() => {
        // @ts-ignore
        const store = globalThis.useFlowStore.getState();
        store.addNode('Deployment', { x: 100, y: 100 });
    });
    // Wait for node to appear
    await page.waitForSelector("[data-id^='deployment-']");
  });

  test('clicking gear icon opens sidebar', async ({ page }) => {
    // Ensure sidebar is hidden
    await page.evaluate(() => {
        // @ts-ignore
        globalThis.useFlowStore.getState().setRightSidebarVisible(false);
    });

    const sidebar = page.locator('.w-72.border-l');
    await expect(sidebar).not.toBeVisible();

    const deploymentNode = page.locator("[data-id^='deployment-']");
    await deploymentNode.hover();

    const gearButton = deploymentNode.locator('button').filter({ has: page.locator('.lucide-settings') });
    await gearButton.click();

    await expect(sidebar).toBeVisible();
  });

  test('clicking gear icon twice toggles sidebar closed', async ({ page }) => {
    // Ensure sidebar is hidden
    await page.evaluate(() => {
        // @ts-ignore
        globalThis.useFlowStore.getState().setRightSidebarVisible(false);
    });

    const sidebar = page.locator('.w-72.border-l');
    const deploymentNode = page.locator("[data-id^='deployment-']");
    await deploymentNode.hover();
    const gearButton = deploymentNode.locator('button').filter({ has: page.locator('.lucide-settings') });

    // Open
    await gearButton.click();
    await expect(sidebar).toBeVisible();

    // Close
    await gearButton.click();
    await expect(sidebar).not.toBeVisible();
  });
});
