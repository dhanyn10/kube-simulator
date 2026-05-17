import { test, expect } from '@playwright/test';

test.describe('Workload Resource Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
  });

  test('shows red button and warning icon when limit < request', async ({ page }) => {
    // Add a Pod node
    await page.getByRole('button', { name: 'Pod', exact: false }).first().click();

    const podNode = page.locator('.react-flow__node-Pod');
    await expect(podNode).toBeVisible();

    // Open Config Panel
    await podNode.hover();
    await podNode.locator('button:has(svg.lucide-settings)').click();

    // Open Advanced Options to reveal Resource Settings
    await page.getByText('Advanced Options').click();

    // Set Request to 500m
    await page.getByRole('button', { name: '500m' }).first().click();

    // Set Limit to 250m (which is < 500m)
    await page.getByRole('button', { name: '250m' }).last().click();

    // Check for red button (bg-red-600)
    const redButton = page.locator('button.bg-red-600');
    await expect(redButton).toBeVisible();
    await expect(redButton).toContainText('500m');

    // Check for warning icon
    const warningIcon = page.locator('.workload-resource-warning');
    await expect(warningIcon).toBeVisible();

    // Check for tooltip on hover
    await warningIcon.hover();
    await expect(page.getByText('Limit must be greater than or equal to Request')).toBeVisible();

    // Fix the error: Set Limit to 1 Core
    await page.getByRole('button', { name: '1 Core' }).last().click();

    // Red button should be gone, replaced by emerald button
    await expect(page.locator('button.bg-red-600')).not.toBeVisible();
    await expect(page.locator('button.bg-emerald-600')).toBeVisible();
    await expect(warningIcon).not.toBeVisible();
  });
});
