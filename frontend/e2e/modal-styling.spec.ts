import { test, expect } from '@playwright/test';

test.describe('Modal Styling and Behavior', () => {
  const openModal = async (page: any, name: string) => {
    await page.getByRole('button', { name: 'Resource', exact: true }).click();
    await page.locator(`button:has-text("${name}")`).click();
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
  });

  test('Modals should not have blur or dim effects', async ({ page }) => {
    await openModal(page, 'Resource Manager');

    const modal = page.locator('dialog[open]');
    await expect(modal).toBeVisible();

    // Check that the backdrop-blur-sm class is NOT present
    await expect(modal).not.toHaveClass(/backdrop-blur-sm/);

    // The backdrop button should be transparent
    const backdrop = modal.locator('button.bg-transparent').first();
    await expect(backdrop).toBeVisible();
  });

  test('Modals should not contain forbidden text', async ({ page }) => {
    await openModal(page, 'Resource Manager');

    // Verify absence of "JetBrains" and "WebStorm"
    const bodyText = await page.innerText('body');
    expect(bodyText).not.toContain('JetBrains');
    expect(bodyText).not.toContain('WebStorm');
  });

  test('Modals should close on clicking outside (backdrop)', async ({ page }) => {
    await openModal(page, 'Resource Manager');

    const modal = page.locator('dialog[open]');
    await expect(modal).toBeVisible();

    // Click at the top-left corner (outside the modal container)
    await page.mouse.click(10, 10);

    // Modal should be hidden
    await expect(modal).not.toBeVisible();
  });

  test('Scenario Modal should also have clean styling', async ({ page }) => {
    await openModal(page, 'Scenarios');

    const modal = page.locator('dialog[open]');
    await expect(modal).toBeVisible();
    await expect(modal).not.toHaveClass(/backdrop-blur-sm/);

    const backdrop = modal.locator('button.bg-transparent').first();
    await expect(backdrop).toBeVisible();
  });
});
