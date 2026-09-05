import { describe, it, expect } from 'vitest';
import { originalLog, originalWarn, originalError } from '@/init-console';

describe('init-console', () => {
  it('exports original console methods and attaches them to globalThis', () => {
    expect(originalLog).toBeDefined();
    expect(originalWarn).toBeDefined();
    expect(originalError).toBeDefined();

    expect((globalThis as any)._originalConsoleLog).toBeDefined();
    expect((globalThis as any)._originalConsoleWarn).toBeDefined();
    expect((globalThis as any)._originalConsoleError).toBeDefined();
  });
});
