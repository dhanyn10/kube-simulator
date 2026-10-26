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

    // 2. Save project via File Backstage View
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await expect(page.getByTestId('file-backstage-view')).toBeVisible();

    const projectName = `TS-Test-${Date.now()}`;
    await page.getByPlaceholder('Enter project/architecture name...').fill(projectName);
    await page.getByTestId('backstage-save-btn').click();
    await expect(page.getByTestId('file-backstage-view')).not.toBeVisible();

    // Verify saved project is active in File Backstage View
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await expect(page.getByText(projectName)).toBeVisible();
    await expect(page.locator('tr', { hasText: projectName }).getByText('Active')).toBeVisible();

    // Return to canvas
    await page.getByTestId('file-backstage-back-btn').click();
    await expect(page.getByTestId('file-backstage-view')).not.toBeVisible();

    // 3. Reload and Load
    await page.reload();
    await expect(page.locator('.react-flow__node-Pod')).not.toBeVisible();

    await page.getByRole('button', { name: 'File', exact: true }).click();
    await expect(page.getByTestId('file-backstage-view')).toBeVisible();
    await page.locator('tr', { hasText: projectName }).getByRole('button', { name: 'Open' }).click();
    await expect(page.getByTestId('file-backstage-view')).not.toBeVisible();

    await expect(page.locator('.react-flow__node-Pod')).toBeVisible();
  });

  test('Activity Log recording', async ({ page }) => {
    // Perform actions
    await page.evaluate(async () => {
        const state = (globalThis as any).useFlowStore.getState();
        state.addNode('Pod');
        await new Promise(resolve => setTimeout(resolve, 100));
        state.addNode('Service');
    });

    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.locator('.menubar-dropdown-panel').getByRole('button', { name: 'History' }).click();
    await expect(page.getByText('Activity Timeline')).toBeVisible();
    await expect(page.getByText('Add Pod', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Add Service', { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Loading Architecture Scenarios', async ({ page }) => {
    await page.getByRole('button', { name: 'Resource', exact: true }).click();
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
