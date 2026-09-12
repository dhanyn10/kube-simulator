import { test, expect } from '@playwright/test';

test.describe('ConfigMap and Secret', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
  });

  test('can add and attach ConfigMap to Deployment via store', async ({ page }) => {
    // Add a Deployment card via store directly
    await page.evaluate(() => {
      const store = (globalThis as any).useFlowStore.getState();
      store.addNode('Deployment');
    });

    const deploymentNode = page.locator('.react-flow__node-Deployment');
    await expect(deploymentNode).toBeVisible();

    // Attach ConfigMap to Deployment via store
    await page.evaluate(() => {
      const store = (globalThis as any).useFlowStore.getState();
      const deployNode = store.nodes.find((n: any) => n.type === 'Deployment');
      if (deployNode) {
        store.updateNodeData(deployNode.id, {
          configMaps: [
            {
              id: 'cm-1',
              name: 'web-config',
              configData: [
                { id: 'k1', key: 'PORT', value: '8080' },
                { id: 'k2', key: 'ENV', value: 'production' }
              ]
            }
          ]
        });
        store.setConfiguringNodeId(deployNode.id);
        store.setRightSidebarVisible(true);
      }
    });

    // Check attached ConfigMap badge in right sidebar
    const cmBadge = page.getByTitle('Attached ConfigMaps (1)');
    await expect(cmBadge).toBeVisible();

    // Click badge to open ConfigMapListModal
    await cmBadge.click();

    // Verify ConfigMapListModal opens and lists web-config
    await expect(page.getByText('Attached ConfigMaps')).toBeVisible();
    await expect(page.getByText('web-config')).toBeVisible();
    await expect(page.getByText('2 key-value pairs (PORT, ENV)')).toBeVisible();

    // Click Edit button in list modal to open ConfigMapModal
    await page.getByTitle('Edit ConfigMap').click();
    await expect(page.getByText('Edit ConfigMap')).toBeVisible();
    await expect(page.locator('#configmap-name-input')).toHaveValue('web-config');
  });

  test('can add and configure Secret', async ({ page }) => {
    await page.getByRole('button', { name: 'Configuration' }).click();
    await page.getByRole('button', { name: 'Secret' }).click();

    const secretNode = page.locator('.react-flow__node-Secret');
    await expect(secretNode).toBeVisible();

    await secretNode.click();

    // Verify RightSidebar has the config
    await expect(page.locator('h3').filter({ hasText: /SECRET CONFIG/i })).toBeVisible();

    await page.locator('button:has-text("Add Item")').click();
    await page.getByPlaceholder('KEY').first().fill('SECRET_KEY');
    await page.getByPlaceholder('Secret Value').first().fill('SECRET_VALUE');

    // Toggle visibility to show on card (it's hidden by default now)
    await page.getByTitle('Show/Hide on Card').click();

    await expect(secretNode).toContainText('SECRET_KEY');
    await expect(secretNode).toContainText('SECRET_VALUE');
  });

  test('generates correct YAML with attached ConfigMaps and Secrets', async ({ page }) => {
    // Add Deployment, attached ConfigMap, and connected Secret
    await page.evaluate(() => {
      const store = (globalThis as any).useFlowStore.getState();
      store.addNode('Deployment');
      store.addNode('Secret');
    });

    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const store = (globalThis as any).useFlowStore.getState();
      const nodes = store.nodes;
      const deploy = nodes.find((n: any) => n.type === 'Deployment');
      const sec = nodes.find((n: any) => n.type === 'Secret');

      if (deploy) {
        store.updateNodeData(deploy.id, {
          configMaps: [
            {
              id: 'cm-app',
              name: 'app-config',
              configData: [{ id: 'k1', key: 'API_URL', value: 'https://api.example.com' }]
            }
          ]
        });
      }

      if (sec && deploy) {
        store.onConnect({
          source: sec.id,
          target: deploy.id,
          sourceHandle: 'right-s',
          targetHandle: 'left-t'
        });
      }
    });

    await page.waitForTimeout(500);

    // Mock GenerateYaml if it's not present
    await page.evaluate(() => {
      if (!(globalThis as any).go?.main?.App?.GenerateYaml) {
        (globalThis as any).go = {
          main: {
            App: {
              GenerateYaml: async () => JSON.stringify([
                { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'app-config' }, data: { API_URL: 'https://api.example.com' } },
                { apiVersion: 'v1', kind: 'Secret', metadata: { name: 'app-secret' } },
                {
                  apiVersion: 'apps/v1',
                  kind: 'Deployment',
                  metadata: { name: 'app-deploy' },
                  spec: {
                    template: {
                      spec: {
                        containers: [
                          {
                            name: 'main',
                            env: [
                              { name: 'API_URL', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'API_URL' } } }
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
              ])
            }
          }
        };
      }
    });

    // Open Canvas dropdown
    await page.getByTestId('canvas-dropdown-toggle').click();
    await page.getByTestId('open-yaml-inspector').click();

    const pre = page.locator('pre');
    await expect(pre).toContainText('kind: ConfigMap');
    await expect(pre).toContainText('kind: Secret');
    await expect(pre).toContainText('kind: Deployment');

    const content = await pre.innerText();
    expect(content).toContain('name: API_URL');
    expect(content).toContain('configMapKeyRef:');
    expect(content).toContain('name: app-config');
  });
});
