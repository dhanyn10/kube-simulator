import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCanvasNavigation,
  isEditableElement,
  isDirectionalKey,
  normalizeNavigationKey,
  calculateTargetVelocity,
  updatePhysicsVelocity,
} from '@/hooks/useCanvasNavigation';

const mockSetViewport = vi.fn();
let mockViewport = { x: 100, y: 200, zoom: 1.5 };

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getViewport: () => mockViewport,
    setViewport: mockSetViewport,
  }),
}));

describe('useCanvasNavigation (Cities: Skylines physics style)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockViewport = { x: 100, y: 200, zoom: 1.5 };
    (document.activeElement as HTMLElement | null)?.blur?.();
  });

  describe('isEditableElement helper', () => {
    it('returns false for null or non-editable element', () => {
      expect(isEditableElement(null)).toBe(false);
      const div = document.createElement('div');
      expect(isEditableElement(div)).toBe(false);
    });

    it('returns true for form inputs and editable elements', () => {
      expect(isEditableElement(document.createElement('input'))).toBe(true);
      expect(isEditableElement(document.createElement('textarea'))).toBe(true);
      expect(isEditableElement(document.createElement('select'))).toBe(true);

      const editableDiv = document.createElement('div');
      editableDiv.contentEditable = 'true';
      expect(isEditableElement(editableDiv)).toBe(true);

      const menuItem = document.createElement('button');
      menuItem.setAttribute('role', 'menuitem');
      expect(isEditableElement(menuItem)).toBe(true);
    });

    it('returns true when child is inside an editable or nokey container', () => {
      const container = document.createElement('div');
      container.className = 'nokey';
      const span = document.createElement('span');
      container.appendChild(span);
      document.body.appendChild(container);

      expect(isEditableElement(span)).toBe(true);
      document.body.removeChild(container);
    });
  });

  describe('isDirectionalKey & normalizeNavigationKey helpers', () => {
    it('recognizes WASD and arrow keys and maps Arrow keys identically to WASD', () => {
      expect(isDirectionalKey('w')).toBe(true);
      expect(isDirectionalKey('W')).toBe(true);
      expect(isDirectionalKey('a')).toBe(true);
      expect(isDirectionalKey('s')).toBe(true);
      expect(isDirectionalKey('d')).toBe(true);
      expect(isDirectionalKey('ArrowUp')).toBe(true);
      expect(isDirectionalKey('ArrowDown')).toBe(true);
      expect(isDirectionalKey('ArrowLeft')).toBe(true);
      expect(isDirectionalKey('ArrowRight')).toBe(true);
      expect(isDirectionalKey('x')).toBe(false);
      expect(isDirectionalKey('Escape')).toBe(false);

      expect(normalizeNavigationKey('ArrowUp')).toBe('w');
      expect(normalizeNavigationKey('ArrowDown')).toBe('s');
      expect(normalizeNavigationKey('ArrowLeft')).toBe('a');
      expect(normalizeNavigationKey('ArrowRight')).toBe('d');
      expect(normalizeNavigationKey('Escape')).toBeNull();
    });
  });

  describe('calculateTargetVelocity helper', () => {
    it('calculates cardinal velocities correctly', () => {
      expect(calculateTargetVelocity(new Set(['w']), 1000)).toEqual({ x: 0, y: 1000 });
      expect(calculateTargetVelocity(new Set(['s']), 1000)).toEqual({ x: 0, y: -1000 });
      expect(calculateTargetVelocity(new Set(['a']), 1000)).toEqual({ x: 1000, y: 0 });
      expect(calculateTargetVelocity(new Set(['d']), 1000)).toEqual({ x: -1000, y: 0 });
    });

    it('normalizes diagonal velocity vector so diagonal speed matches max speed', () => {
      const diag = calculateTargetVelocity(new Set(['w', 'd']), 1000);
      const expected = 1000 / Math.SQRT2;
      expect(diag.x).toBeCloseTo(-expected, 2);
      expect(diag.y).toBeCloseTo(expected, 2);
      expect(Math.hypot(diag.x, diag.y)).toBeCloseTo(1000, 2);
    });

    it('returns zero vector when no keys are pressed', () => {
      expect(calculateTargetVelocity(new Set(), 1000)).toEqual({ x: 0, y: 0 });
    });
  });

  describe('updatePhysicsVelocity helper', () => {
    it('smoothly accelerates towards target velocity', () => {
      const current = { x: 0, y: 0 };
      const target = { x: 0, y: 1000 };
      const next = updatePhysicsVelocity(current, target, 0.016, 14, 7);

      expect(next.y).toBeGreaterThan(0);
      expect(next.y).toBeLessThan(1000);
    });

    it('smoothly decelerates towards zero with inertia when target stops', () => {
      const current = { x: 0, y: 800 };
      const target = { x: 0, y: 0 };
      const next = updatePhysicsVelocity(current, target, 0.016, 14, 7);

      expect(next.y).toBeGreaterThan(0);
      expect(next.y).toBeLessThan(800);
    });

    it('snaps velocity to zero when speed drops below threshold', () => {
      const current = { x: 0.2, y: 0.3 };
      const target = { x: 0, y: 0 };
      const next = updatePhysicsVelocity(current, target, 0.05, 14, 7);

      expect(next).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Hook keyboard interaction & smooth navigation', () => {
    it('initiates smooth pan on W, A, S, D and Arrow keys identically', () => {
      renderHook(() => useCanvasNavigation());

      // Press 'ArrowUp' -> Up (same as 'w')
      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
      });
      expect(mockSetViewport).toHaveBeenCalled();
      let lastCall = mockSetViewport.mock.calls[mockSetViewport.mock.calls.length - 1][0];
      expect(lastCall.y).toBeGreaterThan(200);
      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', cancelable: true }));
      });

      // Press 'ArrowDown' -> Down (same as 's')
      mockSetViewport.mockClear();
      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
      });
      expect(mockSetViewport).toHaveBeenCalled();
      lastCall = mockSetViewport.mock.calls[mockSetViewport.mock.calls.length - 1][0];
      expect(lastCall.y).toBeLessThan(200);
      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', cancelable: true }));
      });

      // Press 'ArrowLeft' -> Left (same as 'a')
      mockSetViewport.mockClear();
      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
      });
      expect(mockSetViewport).toHaveBeenCalled();
      lastCall = mockSetViewport.mock.calls[mockSetViewport.mock.calls.length - 1][0];
      expect(lastCall.x).toBeGreaterThan(100);
      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', cancelable: true }));
      });

      // Press 'ArrowRight' -> Right (same as 'd')
      mockSetViewport.mockClear();
      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }));
      });
      expect(mockSetViewport).toHaveBeenCalled();
      lastCall = mockSetViewport.mock.calls[mockSetViewport.mock.calls.length - 1][0];
      expect(lastCall.x).toBeLessThan(100);
      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', cancelable: true }));
      });
    });

    it('handles keyup and blur events gracefully', () => {
      renderHook(() => useCanvasNavigation());

      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', cancelable: true }));
      });
      expect(mockSetViewport).toHaveBeenCalled();

      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', cancelable: true }));
        globalThis.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', cancelable: true }));
        globalThis.dispatchEvent(new Event('blur'));
      });
    });

    it('accelerates faster when Shift is held (sprint / fast pan)', () => {
      renderHook(() => useCanvasNavigation({ baseSpeed: 500, fastSpeed: 2000 }));

      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', shiftKey: true, cancelable: true }));
      });
      expect(mockSetViewport).toHaveBeenCalled();
    });

    it('ignores navigation when Ctrl, Meta, or Alt is held', () => {
      renderHook(() => useCanvasNavigation());

      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true }));
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true }));
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 's', altKey: true }));
      });

      expect(mockSetViewport).not.toHaveBeenCalled();
    });

    it('ignores navigation when active element is an input or editable', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      renderHook(() => useCanvasNavigation());

      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      });

      expect(mockSetViewport).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('ignores navigation when disabled or unmounted', () => {
      const { unmount } = renderHook(() => useCanvasNavigation({ disabled: true }));

      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      });
      expect(mockSetViewport).not.toHaveBeenCalled();

      unmount();
      act(() => {
        globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      });
      expect(mockSetViewport).not.toHaveBeenCalled();
    });

    it('provides programmatic panUp, panDown, panLeft, panRight, and stop methods', () => {
      const { result } = renderHook(() => useCanvasNavigation());

      act(() => {
        result.current.panUp(500);
      });
      expect(mockSetViewport).toHaveBeenCalled();

      act(() => {
        result.current.panDown(500);
      });
      expect(mockSetViewport).toHaveBeenCalled();

      act(() => {
        result.current.panLeft(500);
      });
      expect(mockSetViewport).toHaveBeenCalled();

      act(() => {
        result.current.panRight(500);
      });
      expect(mockSetViewport).toHaveBeenCalled();

      act(() => {
        result.current.stop();
      });
    });
  });
});
