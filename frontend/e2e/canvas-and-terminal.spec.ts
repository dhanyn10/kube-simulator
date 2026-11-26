import { test, expect } from '@playwright/test';

test.describe('Canvas Interactions & Terminal CLI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('adds nodes from sidebar and deletes selected node with Delete key', async ({ page }) => {
    const initialNodes = await page.locator('.react-flow__node').count();

    // Add a Pod node from the left sidebar
    const podItem = page.locator('#sidebar-item-Pod');
    await expect(podItem).toBeVisible();
    await podItem.click();

    await expect(page.locator('.react-flow__node')).toHaveCount(initialNodes + 1);

    // Select the newly added node and delete it with Delete key
    const lastNode = page.locator('.react-flow__node').last();
    await lastNode.click();
    await page.keyboard.press('Delete');

    await expect(page.locator('.react-flow__node')).toHaveCount(initialNodes);
  });

  test('leaves cards untouched when no card is active and Delete is pressed', async ({ page }) => {
    const initialNodes = await page.locator('.react-flow__node').count();

    const podItem = page.locator('#sidebar-item-Pod');
    await expect(podItem).toBeVisible();
    await podItem.click();

    await expect(page.locator('.react-flow__node')).toHaveCount(initialNodes + 1);

    // No card is clicked/activated: Delete should not remove cards
    await page.keyboard.press('Delete');

    // Synchronize on the observable condition: the node is still rendered on the canvas
    await expect(page.locator('.react-flow__node')).toHaveCount(initialNodes + 1);
  });

  test('pans the canvas viewport using WASD keys', async ({ page }) => {
    const viewport = page.locator('.react-flow__viewport');
    await expect(viewport).toBeVisible();

    const initialTransform = await viewport.getAttribute('style');

    await page.locator('.react-flow__pane').click({ position: { x: 200, y: 200 } });
    await page.keyboard.down('d');
    await expect
      .poll(() => viewport.getAttribute('style'), { timeout: 3000 })
      .not.toBe(initialTransform);
    await page.keyboard.up('d');
  });
});
