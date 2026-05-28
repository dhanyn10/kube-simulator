import { test, expect } from '@playwright/test';

test.describe('Error Reporting Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for it to be ready
    await page.goto('http://127.0.0.1:3000/');
    await page.waitForSelector('[data-testid="app-title"]');
    // Clear logs from previous runs
    await page.evaluate(() => {
        localStorage.removeItem('k8s_sim_logs');
        sessionStorage.removeItem('k8s_sim_logs');
    });
    await page.reload();
  });

  test('intercepts console errors and shows toast with correct counts', async ({ page }) => {
    // Trigger error and warning
    await page.evaluate(() => {
      console.error('Test Error 1');
      console.error('Test Error 2');
      console.warn('Test Warning 1');
    });

    // Toast should be visible (contains counts)
    const errorCount = page.locator('text=2').first();
    await expect(errorCount).toBeVisible();

    const warnCount = page.locator('text=1').first();
    await expect(warnCount).toBeVisible();

    // Check for "Open" button
    const openButton = page.locator('button:has-text("Open")').first();
    await expect(openButton).toBeVisible();
  });

  test('opens error report modal and displays logs', async ({ page }) => {
    await page.evaluate(() => {
      console.error('Modal Test Error');
    });

    await page.locator('button:has-text("Open")').first().click();

    // Modal should be open. Using heading search because text search might be flaky
    await expect(page.getByText('Console Logs')).toBeVisible();
    await expect(page.locator('text=Modal Test Error')).toBeVisible();

    // Toast should STILL be visible
    await expect(page.locator('button:has-text("Open")').first()).toBeVisible();
  });

  test('clears logs and hides toast', async ({ page }) => {
    await page.evaluate(() => {
      console.warn('To be cleared');
    });

    await page.locator('button:has-text("Open")').first().click();
    await page.locator('button:has-text("Clear All")').click();

    // Modal should show "No logs"
    await expect(page.locator('text=No logs recorded in this category.')).toBeVisible();

    // Toast should be hidden
    await expect(page.locator('button:has-text("Open")').first()).not.toBeVisible();
  });

  test('persists logs across reloads', async ({ page }) => {
    await page.evaluate(() => {
      console.error('Persistence Error');
    });

    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector('[data-testid="app-title"]');

    // Toast should re-appear after reload because logs are in sessionStorage
    await expect(page.locator('button:has-text("Open")').first()).toBeVisible();

    await page.locator('button:has-text("Open")').first().click();
    await expect(page.locator('text=Persistence Error')).toBeVisible();
  });
});
