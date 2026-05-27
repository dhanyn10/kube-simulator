import { test, expect } from '@playwright/test';

test.describe('Sidebar UX and Style Polish', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
  });

  test('switching to settings and back to canvas via dropdown', async ({ page }) => {
    // Add a node to enable settings tab
    await page.getByRole('button', { name: 'Pod', exact: false }).first().click();
    const podNode = page.locator('.react-flow__node-Pod');
    await podNode.click();

    // Verify we are on Settings tab (look for 'POD CONFIG')
    await expect(page.locator('h3').filter({ hasText: /POD CONFIG/i })).toBeVisible();

    // Click Canvas dropdown toggle
    await page.getByTestId('canvas-dropdown-toggle').click();

    // Verify we are back on Canvas tab (look for 'HARDWARE BUDGET' widget header)
    await expect(page.locator('h3').filter({ hasText: /HARDWARE BUDGET/i })).toBeVisible();
  });

  test('consistent scrollbar width and styling classes', async ({ page }) => {
    // Check for theme classes on root
    const root = page.locator('div.flex.flex-col.h-screen.w-screen');
    await expect(root).toHaveClass(/dark|light/);

    // Verify custom-scrollbar class is present in sidebar content
    const sidebarContent = page.locator('.custom-scrollbar');
    await expect(sidebarContent).toBeVisible();
  });

  test('main canvas container should not have static grid class', async ({ page }) => {
    // Verify that the main container does not have the 'canvas-grid' class
    // which was causing static background issues in light theme.
    const mainContainer = page.locator('main');
    await expect(mainContainer).not.toHaveClass(/canvas-grid/);
  });
});
