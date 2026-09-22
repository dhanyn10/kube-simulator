import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { adjustContextMenuPosition, useContextMenuPosition } from '@/lib/contextMenuUtils';

describe('adjustContextMenuPosition', () => {
  const viewport = { innerWidth: 1024, innerHeight: 768 };
  const dim = { width: 180, height: 200 };

  it('keeps normal coordinates when cursor is comfortably inside viewport bounds', () => {
    const pos = { x: 100, y: 100 };
    const result = adjustContextMenuPosition(pos, dim, viewport);

    expect(result.left).toBe(100);
    expect(result.top).toBe(100);
  });

  it('shifts menu to the left of the cursor when overflowing right screen edge', () => {
    const pos = { x: 1000, y: 100 }; // 1000 + 180 = 1180 > 1024 - 8
    const result = adjustContextMenuPosition(pos, dim, viewport);

    expect(result.left).toBe(1000 - 180); // 820
    expect(result.top).toBe(100);
  });

  it('shifts menu above the cursor when overflowing bottom screen edge', () => {
    const pos = { x: 100, y: 700 }; // 700 + 200 = 900 > 768 - 8
    const result = adjustContextMenuPosition(pos, dim, viewport);

    expect(result.left).toBe(100);
    expect(result.top).toBe(700 - 200); // 500
  });

  it('shifts menu both left and upwards when right at bottom-right corner', () => {
    const pos = { x: 1000, y: 700 };
    const result = adjustContextMenuPosition(pos, dim, viewport);

    expect(result.left).toBe(820);
    expect(result.top).toBe(500);
  });

  it('clamps coordinates to safety padding when cursor is beyond viewport edge', () => {
    const pos = { x: 1500, y: 1500 };

    const result = adjustContextMenuPosition(pos, dim, viewport, 8);

    expect(result.left).toBe(1024 - 180 - 8); // 836
    expect(result.top).toBe(768 - 200 - 8); // 560
  });

  it('clamps coordinates to minimum left/top padding when cursor is negative', () => {
    const pos = { x: -50, y: -50 };

    const result = adjustContextMenuPosition(pos, dim, viewport, 8);

    expect(result.left).toBe(8);
    expect(result.top).toBe(8);
  });
});

describe('useContextMenuPosition hook', () => {
  it('returns initial cursor position if ref is null', () => {
    const ref = { current: null };
    const { result } = renderHook(() => useContextMenuPosition(150, 250, ref));

    expect(result.current.left).toBe(150);
    expect(result.current.top).toBe(250);
  });

  it('adjusts position using measured element rect when ref is attached', () => {
    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({
      width: 200,
      height: 150,
      top: 0,
      left: 0,
      bottom: 150,
      right: 200,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const ref = { current: element };

    // Simulate right-click near right edge (window width ~1024)
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    const { result } = renderHook(() => useContextMenuPosition(1000, 100, ref));

    expect(result.current.left).toBe(1000 - 200); // 800
    expect(result.current.top).toBe(100);
  });
});
