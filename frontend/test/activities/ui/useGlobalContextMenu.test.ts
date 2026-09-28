import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalContextMenu } from '@/activities/ui/useGlobalContextMenu';

describe('useGlobalContextMenu hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets context menu position on global right-click outside canvas-main', () => {
    const { result } = renderHook(() => useGlobalContextMenu());

    expect(result.current.defaultContextMenu).toBeNull();

    const outsideElem = document.createElement('div');
    document.body.appendChild(outsideElem);

    act(() => {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 150,
        clientY: 250,
      });
      outsideElem.dispatchEvent(event);
    });

    expect(result.current.defaultContextMenu).toEqual({ x: 150, y: 250 });

    document.body.removeChild(outsideElem);
  });

  it('ignores right-click inside #canvas-main element', () => {
    const { result } = renderHook(() => useGlobalContextMenu());

    const canvasElem = document.createElement('div');
    canvasElem.id = 'canvas-main';
    const childElem = document.createElement('span');
    canvasElem.appendChild(childElem);
    document.body.appendChild(canvasElem);

    act(() => {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 200,
      });
      childElem.dispatchEvent(event);
    });

    expect(result.current.defaultContextMenu).toBeNull();

    document.body.removeChild(canvasElem);
  });

  it('closes context menu on click or contextmenu close event', () => {
    const { result } = renderHook(() => useGlobalContextMenu());

    act(() => {
      result.current.setDefaultContextMenu({ x: 100, y: 100 });
    });
    expect(result.current.defaultContextMenu).toEqual({ x: 100, y: 100 });

    act(() => {
      window.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(result.current.defaultContextMenu).toBeNull();
  });
});
