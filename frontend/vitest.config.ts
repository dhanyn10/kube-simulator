import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';

const bindingsApp = path.resolve(__dirname, './bindings/build-wails/app.ts');
const bindingsFallback = path.resolve(__dirname, './src/gateway/bindings-fallback.ts');
const appBindingsTarget = fs.existsSync(bindingsApp) ? bindingsApp : bindingsFallback;

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 15000,
    setupFiles: ['./test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/e2e-wails/**'],
    coverage: {
      provider: 'v8',
      exclude: [
        '**/bindings/**',
        '**/node_modules/**',
        '**/e2e/**',
        '**/test/**',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@wailsjs': path.resolve(__dirname, './src/wailsjs'),
      '@bindings/build-wails/app': appBindingsTarget,
    },
  },
});
