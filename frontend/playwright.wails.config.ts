import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-wails',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  timeout: 60 * 1000,
  use: {
    trace: 'on-first-retry',
  },
});
