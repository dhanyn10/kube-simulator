import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOutsideContextMenu } from '@/hooks/useOutsideContextMenu';

describe('useOutsideContextMenu', () => {
  it('triggers onOutsideClick when right clicking outside the target ref element', () => {
    const onOutsideClick = vi.fn();
    const targetEl = document.createElement('div');
    document.body.appendChild(targetEl);
    const ref = { current: targetEl };

    renderHook(() => useOutsideContextMenu(ref, true, onOutsideClick));

    const outsideEl = document.createElement('span');
    document.body.appendChild(outsideEl);

    act(() => {
      outsideEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    });

    expect(onOutsideClick).toHaveBeenCalledTimes(1);

    document.body.removeChild(targetEl);
    document.body.removeChild(outsideEl);
  });
});
