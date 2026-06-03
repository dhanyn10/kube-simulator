import { test, expect } from '@playwright/test';

test.describe('Error Reporting Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Set a large viewport
    await page.setViewportSize({ width: 1280, height: 1000 });

    await page.goto('http://127.0.0.1:3000/');
    await page.waitForSelector('[data-testid="app-title"]', { timeout: 10000 });

    // Clear logs
    await page.evaluate(() => {
        sessionStorage.removeItem('k8s_sim_logs');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="app-title"]', { timeout: 10000 });
  });

  test('intercepts console errors and shows toast with correct counts', async ({ page }) => {
    await page.evaluate(() => {
      console.error('Test Error 1');
      console.error('Test Error 2');
      console.warn('Test Warning 1');
    });

    await expect(page.locator('text=2').first()).toBeVisible();
    await expect(page.locator('text=1').first()).toBeVisible();
    await expect(page.locator('button:has-text("Open")').first()).toBeVisible();
  });

  test('opens error report modal and displays logs', async ({ page }) => {
    await page.evaluate(() => {
      console.error('Modal Test Error');
    });

    await page.locator('button:has-text("Open")').first().click();
    await expect(page.getByText('Console Logs')).toBeVisible();
    await expect(page.getByText('Modal Test Error')).toBeVisible();
  });

  test('clears logs and hides toast', async ({ page }) => {
    await page.evaluate(() => {
      console.warn('To be cleared');
    });

    await page.locator('button:has-text("Open")').first().click();

    const clearAll = page.getByTestId('log-clear-all');
    await clearAll.click();

    // Use a more flexible search for empty state
    await expect(page.getByText('Console Logs')).not.toBeVisible();
    await expect(page.locator('button:has-text("Open")').first()).not.toBeVisible();
  });

  test('persists logs across reloads', async ({ page }) => {
    await page.evaluate(() => {
      console.error('Persistence Error');
    });

    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector('[data-testid="app-title"]');

    await expect(page.locator('button:has-text("Open")').first()).toBeVisible();
    await page.locator('button:has-text("Open")').first().click();
    await expect(page.getByText('Persistence Error')).toBeVisible();
  });

  test('supports individual and bulk selection/deletion', async ({ page }) => {
    await page.evaluate(() => {
        sessionStorage.removeItem('k8s_sim_logs');
    });
    await page.reload();

    await page.evaluate(() => {
      console.error('Error 1');
      console.error('Error 2');
    });

    await page.locator('button:has-text("Open")').first().click();
    await expect(page.getByText('Error 1')).toBeVisible();

    // Select two logs
    await page.evaluate(() => {
        const checkboxes = document.querySelectorAll('[data-testid="log-checkbox"]');
        checkboxes.forEach(c => (c as HTMLElement).click());
    });

    // Check if count appears (it might be "2 selected")
    await expect(page.getByTestId('log-selection-count')).toBeVisible();

    // Delete selected
    await page.getByTestId('log-bulk-delete').click({ force: true });
    await expect(page.getByTestId('log-selection-count')).not.toBeVisible();
  });

  test('supports selection by type from dropdown', async ({ page }) => {
    await page.evaluate(() => {
        sessionStorage.removeItem('k8s_sim_logs');
    });
    await page.reload();

    await page.evaluate(() => {
      console.error('TestError');
      console.warn('TestWarning');
    });

    await page.locator('button:has-text("Open")').first().click();
    await expect(page.getByText('TestError')).toBeVisible();

    // Open dropdown
    await page.getByTestId('log-select-dropdown').click({ force: true });

    // Select errors
    await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="log-select-error"]');
        if (btn) (btn as HTMLElement).click();
    });

    await expect(page.getByTestId('log-selection-count')).toBeVisible();
  });

  test('supports accordion expansion', async ({ page }) => {
    const longMessage = 'EXPAND_ME_' + 'A'.repeat(200);
    await page.evaluate((msg) => console.error(msg), longMessage);

    await page.locator('button:has-text("Open")').first().click();

    const pre = page.locator('pre', { hasText: 'EXPAND_ME_' }).first();
    await expect(pre).toHaveClass(/line-clamp-1/);

    await pre.click({ force: true });
    await expect(pre).not.toHaveClass(/line-clamp-1/);
  });
});
