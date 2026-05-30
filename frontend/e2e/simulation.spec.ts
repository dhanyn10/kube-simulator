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
      const state = (globalThis as any).useFlowStore.getState();
      const internet = state.nodes.find((n: any) => n.type === 'Internet');
      const deployment = state.nodes.find((n: any) => n.type === 'Deployment');
      if (internet && deployment) {
        state.onConnect({ source: internet.id, target: deployment.id, sourceHandle: 'right-s', targetHandle: 'left-t' });
      }
    });

    // 3. Configure Deployment via Store
    await page.evaluate(() => {
      const state = (globalThis as any).useFlowStore.getState();
      const deployment = state.nodes.find((n: any) => n.type === 'Deployment');
      if (deployment) {
        state.updateNodeData(deployment.id, { webserver: 'nginx' });
      }
    });

    // 4. Start Simulation
    await page.getByRole('button', { name: 'Play' }).click();

    // 5. Check Dashboard
    await page.getByText('View', { exact: true }).click();
    await page.getByText('Simulation', { exact: true }).click();
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
      const state = (globalThis as any).useFlowStore.getState();
      const internet = state.nodes.find((n: any) => n.type === 'Internet');
      const deployment = state.nodes.find((n: any) => n.type === 'Deployment');
      const hpa = state.nodes.find((n: any) => n.type === 'HPA');

      if (internet && deployment && hpa) {
        // Set low CPU limit and target to trigger scaling reliably
        state.updateNodeData(deployment.id, { webserver: 'nginx', cpuLimit: '100m', memoryLimit: '128Mi' });
        state.updateNodeData(hpa.id, { targetCPU: 5, minReplicas: 1, maxReplicas: 5 });

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
