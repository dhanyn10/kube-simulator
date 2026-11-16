// Test setup for Vitest / JSDOM environment
import { vi } from 'vitest';

// Mock @wailsio/runtime in test environments to prevent side-effects from drag.js polling timers
vi.mock('@wailsio/runtime', () => ({
  Window: {
    Minimise: vi.fn().mockResolvedValue(undefined),
    ToggleMaximise: vi.fn().mockResolvedValue(undefined),
    Close: vi.fn().mockResolvedValue(undefined),
  },
  Application: {},
  Browser: {},
  Call: {
    ByID: vi.fn().mockResolvedValue(undefined),
  },
  Clipboard: {},
  Dialogs: {},
  Events: {
    On: vi.fn(),
    Emit: vi.fn(),
  },
  Flags: {},
  Screens: {},
  System: {},
  WML: {},
}));

// Suppress Wails v3 browser environment warning in test runner logs
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Browser Environment Detected')) {
    return;
  }
  originalWarn(...args);
};

if (typeof window !== 'undefined') {
  if (typeof window.clearInterval !== 'function') {
    window.clearInterval = ((id: any) => globalThis.clearInterval(id)) as any;
  }
  if (typeof window.clearTimeout !== 'function') {
    window.clearTimeout = ((id: any) => globalThis.clearTimeout(id)) as any;
  }
  const ensureDataTransferTypes = (event: Event) => {
    const dt = (event as any).dataTransfer;
    if (dt && !Array.isArray(dt.types)) {
      dt.types = [];
    }
  };

  window.addEventListener('dragenter', ensureDataTransferTypes, true);
  window.addEventListener('dragover', ensureDataTransferTypes, true);
  window.addEventListener('dragleave', ensureDataTransferTypes, true);
  window.addEventListener('drop', ensureDataTransferTypes, true);
}
