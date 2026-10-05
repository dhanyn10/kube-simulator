import { describe, it, expect } from 'vitest';
import { EventsOn, WindowSetTitle } from '@/wailsjs/runtime';

describe('wailsjs/runtime.js', () => {
  it('calls EventsOn and invokes the returned cleanup function', () => {
    const unoff = EventsOn();
    expect(typeof unoff).toBe('function');
    expect(() => unoff()).not.toThrow();
  });

  it('calls WindowSetTitle safely', () => {
    expect(() => WindowSetTitle()).not.toThrow();
    expect(WindowSetTitle()).toBeUndefined();
  });
});
