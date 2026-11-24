import { test, expect } from '@playwright/test';

const base = 'http://127.0.0.1:3000';

/**
 * Detaches the main-window sidebar via the real UI button.
 * In a real Wails app the detached window opens as a new window;
 * in the browser/dev fallback we open it manually.
 */
async function detachSidebar(page: any, context: any, side: 'left' | 'right') {
  const pagePromise = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await page.getByTestId(`${side}-sidebar-detach-btn`).click();
  const popped = await pagePromise;
  if (popped) {
    await popped.waitForLoadState('load');
    return popped;
  }
  const detached = await context.newPage();
  await detached.goto(`${base}/?mode=sidebar-${side}`, { waitUntil: 'load' });
  await detached.getByTestId(`attach-${side}-sidebar-btn`).waitFor({ state: 'visible', timeout: 5000 });
  return detached;
}

async function mainStore(page: any): Promise<any> {
  return page.evaluate(async () => {
    const { useFlowStore } = await import('/src/store/index.ts');
    return useFlowStore.getState();
  });
}

async function detachedStore(detached: any): Promise<any> {
  return detached.evaluate(async () => {
    const { useFlowStore } = await import('/src/store/index.ts');
    return useFlowStore.getState();
  });
}

test('detach left sidebar opens detached window', async ({ page }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });

  const detached = await detachSidebar(page, page.context(), 'left');
  expect((await mainStore(page)).isSidebarDetached).toBe(true);
  await expect(detached.getByTestId('attach-left-sidebar-btn')).toBeVisible();
  await expect(detached.locator('text=Components Palette')).toBeVisible();
});

test('detach right sidebar opens detached window', async ({ page }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });

  const detached = await detachSidebar(page, page.context(), 'right');
  expect((await mainStore(page)).isRightSidebarDetached).toBe(true);
  await expect(detached.getByTestId('attach-right-sidebar-btn')).toBeVisible();
});

test('IAM opened in detached palette shows modal in main window', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });

  const detached = await detachSidebar(page, context, 'left');
  await detached.locator('#sidebar-item-IAM').click();
  await expect(async () => {
    expect((await mainStore(page)).isKubeIamModalOpen).toBe(true);
  }).toPass({ timeout: 5000 });

  const state = await mainStore(page);
  expect(state.isKubeIamModalOpen).toBe(true);
  await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('dialog').first()).toContainText('Kube IAM Management');
});

test('attach left sidebar while IAM modal is open', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });

  const detached = await detachSidebar(page, context, 'left');
  await detached.locator('#sidebar-item-IAM').click();
  await expect(page.locator('dialog')).toBeVisible({ timeout: 5000 });
  expect((await mainStore(page)).isKubeIamModalOpen).toBe(true);

  await detached.getByTestId('attach-left-sidebar-btn').click();
  await expect(async () => {
    expect((await mainStore(page)).isSidebarDetached).toBe(false);
  }).toPass({ timeout: 5000 });

  const state = await mainStore(page);
  expect(state.isSidebarDetached).toBe(false);
  expect(state.isSidebarVisible).toBe(true);
  await expect(page.locator('#sidebar-components')).toBeVisible();
});

test('gear on Internet card switches detached right window to Settings tab', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });

  // Expand "Others" section (contains Internet card)
  await page.locator('.sidebar-section-toggle-btn', { hasText: 'Others' }).click();
  await page.locator('#sidebar-item-Internet').click();
  await page.locator('.react-flow__node').filter({ hasText: 'Internet' }).first().waitFor({ state: 'visible', timeout: 10000 });

  const detached = await detachSidebar(page, context, 'right');

  // Gear click on the Internet card in the MAIN window
  const nodeCard = page.locator('.react-flow__node').filter({ hasText: 'Internet' }).first();
  await nodeCard.hover();
  const gear = nodeCard.locator('button').filter({ has: page.locator('svg.lucide-settings') }).first();
  await gear.click({ force: true });

  await expect(async () => {
    expect((await detachedStore(detached)).configuringNodeId).toBeTruthy();
  }).toPass({ timeout: 5000 });

  const detachedState = await detachedStore(detached);
  expect(detachedState.configuringNodeId).toBeTruthy();

  const body = await detached.evaluate(() => document.body.innerText);
  expect(body.includes('Modify element properties') || body.includes('Select an element on the canvas')).toBe(true);
  await expect(detached.locator('text=HARDWARE BUDGET').first()).toHaveCount(0);
});

test('Explore More from detached Internet opens InternetProfileModal in main window', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });
  await page.locator('.sidebar-section-toggle-btn', { hasText: 'Others' }).click();
  await page.locator('#sidebar-item-Internet').click();
  await page.locator('.react-flow__node').filter({ hasText: 'Internet' }).first().waitFor({ state: 'visible', timeout: 10000 });

  const detached = await detachSidebar(page, context, 'right');

  const nodeCard = page.locator('.react-flow__node').filter({ hasText: 'Internet' }).first();
  await nodeCard.hover();
  await nodeCard.locator('button').filter({ has: page.locator('svg.lucide-settings') }).first().click({ force: true });
  await expect(async () => {
    expect((await detachedStore(detached)).configuringNodeId).toBeTruthy();
  }).toPass({ timeout: 5000 });

  await expect(detached.getByRole('button', { name: /Explore More/i })).toBeVisible();
  await detached.getByRole('button', { name: /Explore More/i }).click();

  // Poll the main-window store + dialog until the modal actually opens.
  await expect(async () => {
    expect((await mainStore(page)).isInternetProfileModalOpen).toBe(true);
  }).toPass({ timeout: 5000 });
  await expect(page.locator('dialog').filter({ hasText: /Connection Simulation Profile Templates/ })).toBeVisible({ timeout: 3000 });
  expect((await detachedStore(detached)).isInternetProfileModalOpen).toBe(false);
});

test('attach right sidebar while InternetProfileModal is open', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });
  await page.locator('.sidebar-section-toggle-btn', { hasText: 'Others' }).click();
  await page.locator('#sidebar-item-Internet').click();
  await page.locator('.react-flow__node').filter({ hasText: 'Internet' }).first().waitFor({ state: 'visible', timeout: 10000 });

  const detached = await detachSidebar(page, context, 'right');

  // Gear click on the Internet card in the MAIN window
  const nodeCard = page.locator('.react-flow__node').filter({ hasText: 'Internet' }).first();
  await nodeCard.hover();
  await nodeCard.locator('button').filter({ has: page.locator('svg.lucide-settings') }).first().click({ force: true });
  await expect(async () => {
    expect((await detachedStore(detached)).configuringNodeId).toBeTruthy();
  }).toPass({ timeout: 5000 });

  // Explore More -> InternetProfileModal in main window
  await expect(detached.getByRole('button', { name: /Explore More/i })).toBeVisible();
  await detached.getByRole('button', { name: /Explore More/i }).click();
  await expect(async () => {
    expect((await mainStore(page)).isInternetProfileModalOpen).toBe(true);
  }).toPass({ timeout: 5000 });

  await detached.getByTestId('attach-right-sidebar-btn').click();
  await expect(async () => {
    expect((await mainStore(page)).isRightSidebarDetached).toBe(false);
  }).toPass({ timeout: 5000 });

  const state = await mainStore(page);
  expect(state.isRightSidebarDetached).toBe(false);
  await expect(page.locator('#right-sidebar')).toBeVisible();
});
