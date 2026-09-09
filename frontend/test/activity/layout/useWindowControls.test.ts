import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWindowControls } from '@/activity/layout/useWindowControls';

describe('useWindowControls', () => {
  it('calls window App wails functions when available', () => {
    const mockMinimize = vi.fn();
    const mockMaximize = vi.fn();
    const mockClose = vi.fn();

    (globalThis as any).go = {
      main: {
        App: {
          MinimizeWindow: mockMinimize,
          MaximizeWindow: mockMaximize,
          CloseWindow: mockClose,
        },
      },
    };

    const { result } = renderHook(() => useWindowControls());

    act(() => {
      result.current.handleMinimize();
    });
    expect(mockMinimize).toHaveBeenCalled();

    act(() => {
      result.current.handleMaximize();
    });
    expect(mockMaximize).toHaveBeenCalled();

    act(() => {
      result.current.handleClose();
    });
    expect(mockClose).toHaveBeenCalled();
  });
});
