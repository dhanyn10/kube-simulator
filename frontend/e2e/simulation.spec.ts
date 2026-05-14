import { test, expect } from '@playwright/test';

test.describe('Traffic Simulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
  });

  test('Play/Stop simulation controls', async ({ page }) => {
    const playButton = page.getByRole('button', { name: 'Play' });
    await expect(playButton).toBeDisabled();

    await page.getByRole('button', { name: 'Others' }).click();
    await page.getByRole('button', { name: 'Internet External Component' }).click();
    await expect(playButton).toBeEnabled();

    await playButton.click();
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();

    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });

  test('Simulation metrics and dashboard', async ({ page }) => {
    // 1. Setup Architecture: Internet -> Deployment
    await page.getByRole('button', { name: 'Others' }).click();
    await page.getByRole('button', { name: 'Internet External Component' }).click();

    await page.getByRole('button', { name: 'Workloads' }).click();
    await page.getByRole('button', { name: 'Deployment Pod controller' }).click();

    // 2. Connect via store (Robust and clean)
    await page.evaluate(() => {
      const state = (window as any).useFlowStore.getState();
      const internet = state.nodes.find((n: any) => n.type === 'Internet');
      const deployment = state.nodes.find((n: any) => n.type === 'Deployment');
      if (internet && deployment) {
        state.onConnect({ source: internet.id, target: deployment.id, sourceHandle: 'right-s', targetHandle: 'left-t' });
      }
    });

    // 3. Configure Deployment
    const deployment = page.locator('.react-flow__node-Deployment').first();
    await deployment.locator('button:has(svg.lucide-settings)').click({ force: true });
    await page.getByRole('button', { name: 'nginx' }).click();
    await page.locator('.fixed.right-4 button:has(svg.lucide-x)').click();

    // 4. Start Simulation
    await page.getByRole('button', { name: 'Play' }).click();

    // 5. Check Dashboard
    await page.getByRole('button', { name: 'Monitoring' }).click();
    await page.getByText('Open Dashboard').click();
    await expect(page.getByText('System Monitoring')).toBeVisible();
    await expect(page.getByText('deployment', { exact: false }).last()).toBeVisible({ timeout: 10000 });
  });

  test('HPA scaling logic', async ({ page }) => {
    await page.getByRole('button', { name: 'Others' }).click();
    await page.getByRole('button', { name: 'Internet External Component' }).click();
    await page.getByRole('button', { name: 'Workloads' }).click();
    await page.getByRole('button', { name: 'Deployment Pod controller' }).click();
    await page.getByRole('button', { name: 'Scaling' }).click();
    await page.getByRole('button', { name: 'HPA Auto-scaling' }).click();

    const deployment = page.locator('.react-flow__node-Deployment').first();

    // Configure nodes via store for reliability
    await page.evaluate(() => {
      const state = (window as any).useFlowStore.getState();
      const internet = state.nodes.find((n: any) => n.type === 'Internet');
      const deployment = state.nodes.find((n: any) => n.type === 'Deployment');
      const hpa = state.nodes.find((n: any) => n.type === 'HPA');

      if (internet && deployment && hpa) {
        // Set low CPU limit and target
        state.updateNodeData(deployment.id, { webserver: 'nginx', cpuLimit: '100m', memoryLimit: '128Mi' });
        state.updateNodeData(hpa.id, { targetCPU: 10, minReplicas: 1, maxReplicas: 5 });

        // Connect
        state.onConnect({ source: internet.id, target: deployment.id, sourceHandle: 'right-s', targetHandle: 'left-t' });
        state.onConnect({ source: hpa.id, target: deployment.id, sourceHandle: 'right-s', targetHandle: 'top-t' });
      }
    });

    await page.getByRole('button', { name: 'Play' }).click();

    // Observe scaling
    await expect(async () => {
      const text = await deployment.innerText();
      expect(text).toMatch(/replicas: [2-9]/);
    }).toPass({ timeout: 30000 });
  });
});
