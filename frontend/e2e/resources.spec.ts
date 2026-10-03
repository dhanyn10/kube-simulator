import { test, expect } from '@playwright/test';

test.describe('Workload Resource Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
  });

  test('disables request options higher than current limit', async ({ page }) => {
    // Add a Pod node from sidebar
    await page.getByText('Pod', { exact: true }).first().click();

    const podNode = page.locator('.react-flow__node-Pod');
    await expect(podNode).toBeVisible();

    // Open Config Panel by clicking the pod node
    await podNode.click();

    // Open Resource Limits modal by clicking Attach/Configure Resource Limit button
    await page.getByRole('button', { name: /Resource Limit/i }).first().click();

    // Verify Resource Limit modal is visible
    await expect(page.getByText('Configure CPU and Memory limits/requests')).toBeVisible();

    // Set CPU Limit to 250m
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
