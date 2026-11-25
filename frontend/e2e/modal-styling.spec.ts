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

  test('Modals overlay has the standard backdrop blur applied (current styling)', async ({ page }) => {
    await openModal(page, 'Resource Manager');

    const modal = page.locator('dialog[open]');
    await expect(modal).toBeVisible();

    // Current condition: the modal overlay carries backdrop-blur-sm
    await expect(modal).toHaveClass(/backdrop-blur-sm/);

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

  test('Modals should close when clicking on the backdrop outside the modal container', async ({ page }) => {
    await openModal(page, 'Resource Manager');

    const modal = page.locator('dialog[open]');
    await expect(modal).toBeVisible();

    // Click on the backdrop (a point outside the modal container;
    // the menu bar covers the very top-left, so use a point on the backdrop)
    await page.mouse.click(640, 700);

    // Modal should be hidden
    await expect(modal).not.toBeVisible();
  });

  test('Scenario modal also has the standard overlay styling', async ({ page }) => {
    await openModal(page, 'Scenarios');

    const modal = page.locator('dialog[open]');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveClass(/backdrop-blur-sm/);

    const backdrop = modal.locator('button.bg-transparent').first();
    await expect(backdrop).toBeVisible();
  });
});
