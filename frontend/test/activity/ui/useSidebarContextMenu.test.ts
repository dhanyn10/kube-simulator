import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarContextMenu } from '../../../src/activity/ui/useSidebarContextMenu';

describe('useSidebarContextMenu', () => {
  it('opens and closes context menu correctly', () => {
    const { result } = renderHook(() => useSidebarContextMenu());

    expect(result.current.contextMenu).toBeNull();

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 100,
      clientY: 200,
    } as any;

    act(() => {
      result.current.handleContextMenu(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({ x: 100, y: 200 });

    act(() => {
      result.current.closeContextMenu();
    });

    expect(result.current.contextMenu).toBeNull();
  });
});
