import { test, expect } from '@playwright/test';

test.describe('ConfigMap and Secret', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
  });

  test('can add and configure ConfigMap', async ({ page }) => {
    await page.getByRole('button', { name: 'Configuration' }).click();
    await page.getByRole('button', { name: 'ConfigMap' }).click();

    const configMapNode = page.locator('.react-flow__node-ConfigMap');
    await expect(configMapNode).toBeVisible();

    await configMapNode.hover();
    const settingsBtn = configMapNode.locator('button:has(svg.lucide-settings)');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    const addItemBtn = page.locator('button:has-text("Add Item")');
    await expect(addItemBtn).toBeVisible();
    await addItemBtn.click();

    await page.getByPlaceholder('KEY').first().fill('TEST_KEY');
    await page.getByPlaceholder('Value').first().fill('TEST_VALUE');

    // Toggle visibility to show on card (it's hidden by default now)
    await page.getByTitle('Show/Hide on Card').click();

    await expect(configMapNode).toContainText('TEST_KEY');
    await expect(configMapNode).toContainText('TEST_VALUE');
  });

  test('can add and configure Secret', async ({ page }) => {
    await page.getByRole('button', { name: 'Configuration' }).click();
    await page.getByRole('button', { name: 'Secret' }).click();

    const secretNode = page.locator('.react-flow__node-Secret');
    await expect(secretNode).toBeVisible();

    await secretNode.hover();
    await secretNode.locator('button:has(svg.lucide-settings)').click();

    await page.locator('button:has-text("Add Item")').click();
    await page.getByPlaceholder('KEY').first().fill('SECRET_KEY');
    await page.getByPlaceholder('Secret Value').first().fill('SECRET_VALUE');

    // Toggle visibility to show on card (it's hidden by default now)
    await page.getByTitle('Show/Hide on Card').click();

    await expect(secretNode).toContainText('SECRET_KEY');
    await expect(secretNode).not.toContainText('SECRET_VALUE');
    await expect(secretNode).toContainText('********');
  });

  test('generates correct YAML with environment variables', async ({ page }) => {
    await page.getByRole('button', { name: 'Resource' }).click();
    await page.getByText('Scenarios').first().click();
    await page.getByText('Configured Application').click();

    // Establishing the connection manually to trigger env injection logic
    // We use evaluate to access window.useFlowStore directly
    await page.evaluate(() => {
        const store = (window as any).useFlowStore.getState();
        const nodes = store.nodes;
        const cm = nodes.find((n: any) => n.type === 'ConfigMap');
        const sec = nodes.find((n: any) => n.type === 'Secret');
        const deploy = nodes.find((n: any) => n.type === 'Deployment');

        if (cm && deploy && sec) {
            // Check for existing edges to avoid duplicates if any
            const edges = store.edges;
            const hasCmEdge = edges.some((e: any) => e.source === cm.id && e.target === deploy.id);
            const hasSecEdge = edges.some((e: any) => e.source === sec.id && e.target === deploy.id);

            if (!hasCmEdge) {
                store.onConnect({
                    source: cm.id,
                    target: deploy.id,
                    sourceHandle: 'right-s',
                    targetHandle: 'left-t'
                });
            }
            if (!hasSecEdge) {
                store.onConnect({
                    source: sec.id,
                    target: deploy.id,
                    sourceHandle: 'right-s',
                    targetHandle: 'left-t'
                });
            }
        }
    });

    // Wait for state update
    await page.waitForTimeout(500);

    await page.getByText('Canvas', { exact: true }).click();
    await page.getByText('Open YAML Inspector').click();

    const pre = page.locator('pre');
    await expect(pre).toContainText('kind: ConfigMap');
    await expect(pre).toContainText('kind: Secret');
    await expect(pre).toContainText('kind: Deployment');

    // Check env injection
    // Using a more lenient check for substrings
    const content = await pre.innerText();
    expect(content).toContain('name: API_URL');
    expect(content).toContain('configMapKeyRef:');
    expect(content).toContain('name: app-config');

    expect(content).toContain('name: DB_PASSWORD');
    expect(content).toContain('secretKeyRef:');
    expect(content).toContain('name: app-secret');
  });
});
