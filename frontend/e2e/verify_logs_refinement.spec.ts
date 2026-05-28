import { test, expect } from '@playwright/test';

test('verify log modal UI refinements', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Inject mock backend logs
    await page.evaluate(() => {
        const store = (window as any).useFlowStore.getState();
        store.addLog('info', '[History] Initial state recorded to Go database');
        store.addLog('error', 'Another error');
        store.addLog('warn', 'A minor warning');
        store.addLog('error', 'Critical backend error: ' + 'A'.repeat(100));
        store.setLogModalOpen(true);
    });

    await page.waitForSelector('text=Console Logs');

    // Take screenshot of collapsed state
    await page.screenshot({ path: '/home/jules/verification/log_refinement_collapsed.png' });

    // Click the long error to expand it
    await page.click('text=Critical backend error');
    await page.waitForTimeout(200);

    // Take screenshot of expanded state
    await page.screenshot({ path: '/home/jules/verification/log_refinement_expanded.png' });
});
