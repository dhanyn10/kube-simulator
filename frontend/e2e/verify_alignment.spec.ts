import { test, expect } from '@playwright/test';

test('verify alignment and snap guides rendering', async ({ page }) => {
  await page.goto('http://localhost:3001');

  // Wait for the app to load
  await page.waitForSelector('.react-flow__renderer');

  // Use the correct data-testid from the code
  const podComponent = page.getByTestId('node-pod');
  const canvas = page.locator('.react-flow__pane');

  // Drag 'Pod' from sidebar to canvas at fixed positions
  await podComponent.dragTo(canvas, { targetPosition: { x: 300, y: 300 } });

  // Wait for the first node to be rendered
  await page.waitForSelector('.react-flow__node-Pod');

  // Drag another Pod to align with the first one
  await podComponent.dragTo(canvas, { targetPosition: { x: 500, y: 300 } });

  const pods = page.locator('.react-flow__node-Pod');
  await expect(pods).toHaveCount(2);

  const pod2 = pods.last();
  const box2 = await pod2.boundingBox();
  if (!box2) throw new Error('Pod 2 not found');

  // Move pod2 to trigger guides
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await page.mouse.down();

  // Drag vertically to trigger center line and SNAP
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2 + 4);

  // Wait for guide to appear
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'frontend/verification/alignment_check_final.png' });

  await page.mouse.up();
});
