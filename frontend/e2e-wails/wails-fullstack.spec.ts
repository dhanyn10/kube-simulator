import { test, expect, chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const CDP_PORT = process.env.WAILS_CDP_PORT || '9222';
const CDP_URL = process.env.WAILS_CDP_URL || `http://127.0.0.1:${CDP_PORT}`;
const BINARY_PATH =
  process.env.WAILS_BINARY_PATH ||
  path.resolve(process.cwd(), '../bin/kube-simulator.exe');

test.describe('Wails Full-Stack E2E (Go Backend + WebView2)', () => {
  let appProcess: ChildProcess | undefined;

  test.beforeAll(async () => {
    if (process.env.WAILS_CDP_URL) {
      return;
    }
    if (!fs.existsSync(BINARY_PATH)) {
      throw new Error(
        `Wails binary not found at ${BINARY_PATH}. Build it first (e.g. 'go build -o bin/kube-simulator.exe .') or set WAILS_CDP_URL.`
      );
    }

    appProcess = spawn(BINARY_PATH, [], {
      env: {
        ...process.env,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}`,
      },
      stdio: 'ignore',
    });

    // Wait briefly for WebView2 CDP endpoint to become ready
    await new Promise((r) => setTimeout(r, 3000));
  });

  test.afterAll(async () => {
    if (appProcess && !appProcess.killed) {
      appProcess.kill();
    }
  });

  test('connects to Wails WebView2 and verifies app + Go backend bridge', async () => {
    const browser = await chromium.connectOverCDP(CDP_URL);
    try {
      const context = browser.contexts()[0];
      const page = context.pages()[0];
      expect(page).toBeDefined();

      await expect(page.getByTestId('app-title')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#canvas-main')).toBeVisible();

      // Verify Wails v3 runtime is injected in the desktop window
      const hasWailsRuntime = await page.evaluate(() => {
        return typeof (globalThis as Record<string, unknown>)._wails !== 'undefined' ||
          typeof (globalThis as Record<string, unknown>).wails !== 'undefined';
      });
      expect(hasWailsRuntime).toBe(true);
    } finally {
      await browser.close();
    }
  });
});
