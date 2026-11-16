import { test, expect } from '@playwright/test';

test.describe('Initial App Launch and Useful Resources', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
  });

  test('renders application layout, canvas, and left sidebar cleanly on initial launch', async ({ page }) => {
    // Verify MenuBar and main canvas
    await expect(page.getByTestId('app-title')).toBeVisible();
    await expect(page.locator('#canvas-main')).toBeVisible();
    await expect(page.locator('.react-flow')).toBeVisible();

    // Verify left sidebar is open and visible
    const sidebar = page.locator('#sidebar-components');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('Components')).toBeVisible();
    await expect(sidebar.getByPlaceholder('Search...')).toBeVisible();

    // Verify Useful Resources section is visible and expanded by default
    const usefulToggle = sidebar.locator('.sidebar-section-toggle-btn').filter({ hasText: 'Useful Resources' });
    await expect(usefulToggle).toBeVisible();

    // Verify Useful Resources items
    const iamItem = sidebar.locator('#sidebar-item-IAM');
    const workerItem = sidebar.locator('#sidebar-item-Worker');

    await expect(iamItem).toBeVisible();
    await expect(iamItem).toContainText('Kube IAM');
    await expect(iamItem).toContainText('IAM User Management');

    await expect(workerItem).toBeVisible();
    await expect(workerItem).toContainText('Worker Nodes');
    await expect(workerItem).toContainText('Hardware & Scaling');
  });

  test('opens and closes Kube IAM modal from Useful Resources card', async ({ page }) => {
    const sidebar = page.locator('#sidebar-components');
    const iamItem = sidebar.locator('#sidebar-item-IAM');
    await expect(iamItem).toBeVisible();

    // Click Kube IAM card
    await iamItem.click();

    // Verify Kube IAM modal dialog opens
    const iamModal = page.locator('dialog.modal-overlay');
    await expect(iamModal).toBeVisible();
    await expect(iamModal.getByRole('heading', { name: 'Kube IAM Management' })).toBeVisible();
    await expect(iamModal.getByText('IAM Users')).toBeVisible();

    // Close via close button
    const closeBtn = iamModal.getByRole('button', { name: 'Close' });
    await closeBtn.click();
    await expect(iamModal).not.toBeVisible();
  });

  test('opens and closes Worker Nodes Budget modal from Useful Resources card', async ({ page }) => {
    const sidebar = page.locator('#sidebar-components');
    const workerItem = sidebar.locator('#sidebar-item-Worker');
    await expect(workerItem).toBeVisible();

    // Click Worker Nodes card
    await workerItem.click();

    // Verify Worker Nodes Budget modal opens
    await expect(page.getByText('Cluster Worker Nodes & Hardware Budget')).toBeVisible();
    await expect(page.getByTestId('worker-budget-modal-close')).toBeVisible();

    // Close via close button
    await page.getByTestId('worker-budget-modal-close').click();
    await expect(page.getByText('Cluster Worker Nodes & Hardware Budget')).not.toBeVisible();
  });

  test('toggles Useful Resources section collapse and expand', async ({ page }) => {
    const sidebar = page.locator('#sidebar-components');
    const usefulToggle = sidebar.locator('.sidebar-section-toggle-btn').filter({ hasText: 'Useful Resources' });
    const iamItem = sidebar.locator('#sidebar-item-IAM');

    // Initially expanded
    await expect(iamItem).toBeVisible();

    // Collapse Useful Resources
    await usefulToggle.click();
    await expect(iamItem).not.toBeVisible();

    // Re-expand Useful Resources
    await usefulToggle.click();
    await expect(iamItem).toBeVisible();
  });

  test('filters Useful Resources using search input', async ({ page }) => {
    const sidebar = page.locator('#sidebar-components');
    const searchInput = sidebar.getByPlaceholder('Search...');
    const iamItem = sidebar.locator('#sidebar-item-IAM');
    const workerItem = sidebar.locator('#sidebar-item-Worker');

    // Search for IAM
    await searchInput.fill('IAM');
    await expect(iamItem).toBeVisible();
    await expect(workerItem).not.toBeVisible();

    // Search for Worker
    await searchInput.fill('Worker');
    await expect(workerItem).toBeVisible();
    await expect(iamItem).not.toBeVisible();

    // Clear search
    await searchInput.clear();
    await expect(iamItem).toBeVisible();
    await expect(workerItem).toBeVisible();
  });
});

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
