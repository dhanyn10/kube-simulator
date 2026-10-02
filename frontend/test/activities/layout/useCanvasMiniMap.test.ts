import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasMiniMap } from '@/activities/layout/useCanvasMiniMap';
import { useFlowStore } from '@/store';

describe('useCanvasMiniMap hook', () => {
  beforeEach(() => {
    useFlowStore.setState({
      minimapPosition: 'bottom-right',
      colorMode: 'dark',
    });
  });

  it('returns current minimapPosition and colorMode', () => {
    const { result } = renderHook(() => useCanvasMiniMap());

    expect(result.current.minimapPosition).toBe('bottom-right');
    expect(result.current.colorMode).toBe('dark');
  });

  it('updates minimapPosition when moveToPosition is called and calls SaveSetting', () => {
    const mockSaveSetting = vi.fn().mockResolvedValue(true);
    (globalThis as any).go = {
      main: {
        App: {
          SaveSetting: mockSaveSetting,
        },
      },
    };

    const { result } = renderHook(() => useCanvasMiniMap());

    act(() => {
      result.current.moveToPosition('bottom-left');
    });

    expect(useFlowStore.getState().minimapPosition).toBe('bottom-left');
    expect(mockSaveSetting).toHaveBeenCalledWith('minimap_position', 'bottom-left');
  });
});
