import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOutsideMouseDown } from '@/hooks/useOutsideMouseDown';

describe('useOutsideMouseDown', () => {
  it('does not listen or trigger callback when active is false', () => {
    const onOutsideClick = vi.fn();
    const el = document.createElement('div');
    document.body.appendChild(el);
    const ref = { current: el };

    renderHook(() => useOutsideMouseDown(ref, false, onOutsideClick));

    const outsideEl = document.createElement('span');
    document.body.appendChild(outsideEl);

    outsideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onOutsideClick).not.toHaveBeenCalled();

    document.body.removeChild(el);
    document.body.removeChild(outsideEl);
  });

  it('triggers callback when mousedown occurs outside element and active is true', () => {
    const onOutsideClick = vi.fn();
    const insideEl = document.createElement('div');
    const outsideEl = document.createElement('button');
    document.body.appendChild(insideEl);
    document.body.appendChild(outsideEl);
    const ref = { current: insideEl };

    renderHook(() => useOutsideMouseDown(ref, true, onOutsideClick));

    // Click inside
    insideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onOutsideClick).not.toHaveBeenCalled();

    // Click outside
    outsideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onOutsideClick).toHaveBeenCalledTimes(1);

    document.body.removeChild(insideEl);
    document.body.removeChild(outsideEl);
  });

  it('cleans up event listener upon unmount', () => {
    const onOutsideClick = vi.fn();
    const insideEl = document.createElement('div');
    const outsideEl = document.createElement('div');
    document.body.appendChild(insideEl);
    document.body.appendChild(outsideEl);
    const ref = { current: insideEl };

    const { unmount } = renderHook(() => useOutsideMouseDown(ref, true, onOutsideClick));

    unmount();

    outsideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onOutsideClick).not.toHaveBeenCalled();

    document.body.removeChild(insideEl);
    document.body.removeChild(outsideEl);
  });
});
