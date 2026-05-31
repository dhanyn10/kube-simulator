import { test, expect } from '@playwright/test';

test.describe('Persistence & Projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
  });

  test('Save and Load Project', async ({ page }) => {
    // 1. Add node
    await page.getByRole('button', { name: 'Pod Atomic unit of K8s' }).click();
    await expect(page.locator('.react-flow__node-Pod')).toBeVisible();

    // 2. Save project
    await page.getByRole('button', { name: 'Resource' }).click();
    await page.getByText('Resource Manager').click();

    const projectName = `TS-Test-${Date.now()}`;
    await page.getByPlaceholder('Enter new architecture name...').fill(projectName);
    await page.getByRole('button', { name: 'Save New' }).click();
    await expect(page.getByText(projectName)).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^Active$/ })).toBeVisible();

    // 3. Reload and Load
    // Try to close any open panels (Manager or Config)
    // The transparent backdrop might intercept clicks on the X button if not careful
    // or the test might be hitting the wrong close button.
    // Let's close the modal specifically.
    const modalXButton = page.locator('dialog[open] button[aria-label="Close"]');
    if (await modalXButton.isVisible()) {
        await modalXButton.click();
    }

    await page.reload();
    await expect(page.locator('.react-flow__node-Pod')).not.toBeVisible();

    await page.getByRole('button', { name: 'Resource' }).click();
    await page.getByText('Resource Manager').click();
    await page.getByText(projectName).locator('..').locator('..').locator('..').getByRole('button', { name: 'Open' }).click();

    await expect(page.locator('.react-flow__node-Pod')).toBeVisible();
  });

  test('Activity Log recording', async ({ page }) => {
    // Perform actions
    await page.evaluate(() => {
        const state = (globalThis as any).useFlowStore.getState();
        state.addNode('Pod');
        state.addNode('Service');
    });

    await page.locator("button[title='Activity Log (BadgerDB)']").click();
    await expect(page.getByText('Activity Timeline')).toBeVisible();
    await expect(page.getByText('Add Pod', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Add Service', { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Loading Architecture Scenarios', async ({ page }) => {
    await page.getByRole('button', { name: 'Resource' }).click();
    await page.getByText('Scenarios').click();

    await page.getByText('Simple Web Service').click();

    // Auto-confirms if empty, but let's handle modal just in case
    const confirm = page.getByRole('button', { name: 'Confirm & Load' });
    if (await confirm.isVisible()) {
        await confirm.click();
    }

    await expect(page.locator('.react-flow__node-Internet')).toBeVisible();
    await expect(page.locator('.react-flow__node-Service')).toBeVisible();
    await expect(page.locator('.react-flow__node-Pod')).toBeVisible();
  });
});
