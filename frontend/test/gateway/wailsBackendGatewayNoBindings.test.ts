import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@bindings/build-wails/app', () => ({
  MinimizeWindow: undefined,
  MaximizeWindow: undefined,
  CloseWindow: undefined,
}));

import { WailsBackendGateway } from '@/gateway/WailsBackendGateway';

describe('WailsBackendGateway without generated bindings', () => {
  beforeEach(() => {
    delete (globalThis as any).go;
    delete (globalThis as any).window;
    delete (globalThis as any).chrome;
    delete (globalThis as any).wails;
  });

  it('window ops fall through when bindings lack the methods', async () => {
    const gw = new WailsBackendGateway();
    await expect(gw.minimizeWindow()).resolves.toBeUndefined();
    await expect(gw.maximizeWindow()).resolves.toBeUndefined();
    await expect(gw.closeWindow()).resolves.toBeUndefined();
  });

  it('window ops reach the appBindings checks in desktop mode without runtime window methods', async () => {
    (globalThis as any).chrome = { webview: { postMessage: () => {} } };
    (globalThis as any).wails = { Window: {} };
    const gw = new WailsBackendGateway();
    await expect(gw.minimizeWindow()).resolves.toBeUndefined();
    await expect(gw.maximizeWindow()).resolves.toBeUndefined();
    await expect(gw.closeWindow()).resolves.toBeUndefined();
    delete (globalThis as any).chrome;
    delete (globalThis as any).wails;
  });
});
