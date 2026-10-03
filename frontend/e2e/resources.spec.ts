import { test, expect } from '@playwright/test';

test.describe('Workload Resource Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
  });

  test('disables request options higher than current limit', async ({ page }) => {
    // Add a Resource Limit node from sidebar
    await page.evaluate(() => {
      // @ts-ignore
      const store = globalThis.useFlowStore.getState();
      store.addNode('ResourceLimit', { x: 100, y: 100 });
    });

    const resourceLimitNode = page.locator('.react-flow__node-ResourceLimit');
    await expect(resourceLimitNode).toBeVisible();

    // Open Resource Limit modal
    await page.evaluate(() => {
      // @ts-ignore
      const store = globalThis.useFlowStore.getState();
      const node = store.nodes.find((n: any) => n.type === 'ResourceLimit');
      if (node) {
        store.setResourceLimitModalTargetNode({ id: node.id, label: node.data?.label || 'ResourceLimit' });
      }
    });

    // Verify modal is open
    await expect(page.getByText('Resource Limit Name')).toBeVisible();

    // Set CPU Limit to 250m (CPU Limit is first group)
    await page.getByRole('button', { name: '250m' }).first().click();

    // CPU Request options higher than 250m (500m, 1 Core, 2 Cores in CPU Request group) should be disabled
    const req500m = page.getByRole('button', { name: '500m' }).nth(1);
    const req1Core = page.getByRole('button', { name: '1 Core' }).nth(1);
    await expect(req500m).toBeDisabled();
    await expect(req1Core).toBeDisabled();

    // Upgrade CPU Limit to 1 Core
    await page.getByRole('button', { name: '1 Core' }).first().click();

    // Now CPU Request option 500m should be enabled
    await expect(req500m).toBeEnabled();
  });
});
