import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@bindings/build-wails/app', () => ({
  MinimizeWindow: undefined,
  MaximizeWindow: undefined,
  CloseWindow: undefined,
}));

vi.mock('@wailsjs/go/main/App.js', () => ({
  MockedWailsFallback: vi.fn(),
  SaveProject: undefined,
  SaveSetting: undefined,
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

  it('returns mock wails module fallbacks through the app proxy', () => {
    const gw = new WailsBackendGateway();
    const fallback = (gw as any).app.MockedWailsFallback;
    expect(typeof fallback).toBe('function');
    expect(fallback._isMockFunction).toBe(true);
  });

  it('project and setting fallbacks tolerate undefined globalThis', async () => {
    const gw = new WailsBackendGateway();
    const origDescriptor = Object.getOwnPropertyDescriptor(global, 'globalThis');
    try {
      Object.defineProperty(global, 'globalThis', {
        configurable: true,
        get() {
          const stack = new Error().stack || '';
          if (stack.includes('WailsBackendGateway.ts')) return undefined;
          return origDescriptor?.value ?? global;
        },
      });
      expect(typeof (await gw.saveProject('name', 'content'))).toBe('number');
      expect(await gw.saveSetting('key', 'value')).toBe(true);
    } finally {
      if (origDescriptor) {
        Object.defineProperty(global, 'globalThis', origDescriptor);
      } else {
        delete (global as any).globalThis;
      }
    }
  });

  it('uses local simulation fallbacks when app bindings lack simulation methods', async () => {
    const gw = new WailsBackendGateway();

    await expect(gw.startSimulation(2)).resolves.toBe(true);
    await expect(gw.pauseSimulation()).resolves.toBe(true);
    await expect(gw.resumeSimulation()).resolves.toBe(true);
    await expect(gw.stopSimulation()).resolves.toBe(true);
    await expect(gw.setSimulationSpeed(3)).resolves.toBe(true);
    await expect(gw.getSimulationSnapshot()).resolves.toBe('{}');
  });
});
