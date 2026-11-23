import { test, expect } from '@playwright/test';

const base = 'http://127.0.0.1:3000';

/**
 * Regression: gear clicks in detached mode must sync configuringNodeId to the
 * detached window, switching to the Settings tab. Repeated clicks on the same
 * card toggle the selection off (main-window behavior) - verify the detached
 * window follows the main window state across repeated syncs.
 */
test('repeated gear clicks keep detached Settings tab in sync', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });
  await page.locator('.sidebar-section-toggle-btn', { hasText: 'Others' }).click();
  await page.locator('#sidebar-item-Internet').click();
  await page.locator('.react-flow__node').filter({ hasText: 'Internet' }).first().waitFor({ state: 'visible', timeout: 10000 });

  const detached = await context.newPage();
  await detached.goto(`${base}/?mode=sidebar-right`, { waitUntil: 'load' });
  await detached.waitForTimeout(800);
  await page.evaluate(async () => {
    const { useFlowStore } = await import('/src/store/index.ts');
    useFlowStore.setState({ isRightSidebarDetached: true });
  });

  const nodeCard = page.locator('.react-flow__node').filter({ hasText: 'Internet' }).first();
  const gear = nodeCard.locator('button').filter({ has: page.locator('svg.lucide-settings') }).first();

  const checkDetached = () => detached.evaluate(async () => {
    const { useFlowStore } = await import('/src/store/index.ts');
    const body = document.body.innerText;
    return {
      configuringNodeId: useFlowStore.getState().configuringNodeId,
      settingsActive: body.includes('Modify element properties') || body.includes('Select an element on the canvas'),
    };
  });

  // Step 1: gear click -> detached selects the node and shows Settings.
  await nodeCard.hover();
  await gear.click({ force: true });
  await expect(async () => {
    const state = await checkDetached();
    expect(state.configuringNodeId).toBeTruthy();
    expect(state.settingsActive).toBe(true);
  }).toPass({ timeout: 4000 });

  // Step 2: gear click again (same card) -> main toggles selection off.
  await nodeCard.hover();
  await gear.click({ force: true });
  await expect(async () => {
    const state = await checkDetached();
    expect(state.configuringNodeId).toBeNull();
  }).toPass({ timeout: 4000 });

  // Step 3: gear click again -> selection re-appears with Settings.
  await nodeCard.hover();
  await gear.click({ force: true });
  await expect(async () => {
    const state = await checkDetached();
    expect(state.configuringNodeId).toBeTruthy();
    expect(state.settingsActive).toBe(true);
  }).toPass({ timeout: 4000 });
});
