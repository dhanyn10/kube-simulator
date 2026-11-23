import { test, expect } from '@playwright/test';

const base = 'http://127.0.0.1:3000';

async function mainStore(page: any): Promise<any> {
  return page.evaluate(async () => {
    const { useFlowStore } = await import('/src/store/index.ts');
    return useFlowStore.getState();
  });
}

async function detachedPalette(page: any, context: any, section: string): Promise<any> {
  const detached = await context.newPage();
  await detached.goto(`${base}/?mode=sidebar-left`, { waitUntil: 'load' });
  await detached.waitForTimeout(800);
  // Expand the section containing the card
  await detached.locator('.sidebar-section-toggle-btn', { hasText: section }).click();
  return detached;
}

const CASES = [
  { section: 'Configuration', card: 'ConfigMap', check: (state: any) => expect(state.configMapModalTargetNode?.label).toBe('Cluster ConfigMaps') },
  { section: 'Configuration', card: 'Secret', check: (state: any) => expect(state.secretModalTargetNode?.label).toBe('Cluster Secrets') },
  { section: 'Scaling', card: 'HPA', check: (state: any) => expect(state.activeOverviewModal).toBe('HPA') },
  { section: 'Scaling', card: 'ResourceLimit', check: (state: any) => expect(state.activeOverviewModal).toBe('ResourceLimit') },
  { section: 'Useful Resources', card: 'Worker', check: (state: any) => expect(state.isWorkerBudgetModalOpen).toBe(true) },
];

for (const tc of CASES) {
  test(`detached palette ${tc.card} opens modal in main window`, async ({ page, context }) => {
    await page.goto(base + '/');
    await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });
    const detached = await detachedPalette(page, context, tc.section);
    await detached.locator(`#sidebar-item-${tc.card}`).click();

    await expect(async () => {
      tc.check(await mainStore(page));
    }).toPass({ timeout: 4000 });
  });
}

test('detached palette ConfigMap modal visible in main window', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });
  const detached = await detachedPalette(page, context, 'Configuration');
  await detached.locator('#sidebar-item-ConfigMap').click();
  await expect(page.locator('dialog').first()).toBeVisible();
});

test('detached palette Secret modal visible in main window', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });
  const detached = await detachedPalette(page, context, 'Configuration');
  await detached.locator('#sidebar-item-Secret').click();
  await expect(page.locator('dialog').first()).toBeVisible();
});

test('detached palette HPA overview visible in main window', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });
  const detached = await detachedPalette(page, context, 'Scaling');
  await detached.locator('#sidebar-item-HPA').click();
  await expect(async () => {
    await expect(page.locator('dialog').first()).toContainText('Cluster Horizontal Pod Autoscalers Overview');
  }).toPass({ timeout: 4000 });
});

test('detached palette ResourceLimit overview visible in main window', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });
  const detached = await detachedPalette(page, context, 'Scaling');
  await detached.locator('#sidebar-item-ResourceLimit').click();
  await expect(async () => {
    await expect(page.locator('dialog').first()).toContainText('Cluster Resource Limits Overview');
  }).toPass({ timeout: 4000 });
});

test('detached palette Worker modal visible in main window', async ({ page, context }) => {
  await page.goto(base + '/');
  await page.waitForSelector('#sidebar-components', { state: 'visible', timeout: 15000 });
  const detached = await detachedPalette(page, context, 'Useful Resources');
  await detached.locator('#sidebar-item-Worker').click();
  await expect(async () => {
    await expect(page.locator('[data-testid="worker-budget-modal"]').first()).toContainText('Cluster Worker Nodes & Hardware Budget');
  }).toPass({ timeout: 4000 });
});
