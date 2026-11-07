import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWindowControls } from '@/activities/layout/useWindowControls';
import { setBackendGateway, resetBackendGateway, MockBackendGateway } from '@/gateway';

describe('useWindowControls', () => {
  beforeEach(() => {
    resetBackendGateway();
    delete (globalThis as any).go;
  });

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

  it('delegates to IBackendGateway mock adapter', () => {
    const mockGateway = new MockBackendGateway();
    const spyMin = vi.spyOn(mockGateway, 'minimizeWindow');
    const spyMax = vi.spyOn(mockGateway, 'maximizeWindow');
    const spyClose = vi.spyOn(mockGateway, 'closeWindow');
    setBackendGateway(mockGateway);

    const { result } = renderHook(() => useWindowControls());

    act(() => {
      result.current.handleMinimize();
      result.current.handleMaximize();
      result.current.handleClose();
    });

    expect(spyMin).toHaveBeenCalledTimes(1);
    expect(spyMax).toHaveBeenCalledTimes(1);
    expect(spyClose).toHaveBeenCalledTimes(1);
  });
});
