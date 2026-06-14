import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory } from '@/hooks/useHistory';
import { applyHistoryState } from '@/store';

vi.mock('@/store', () => ({
  applyHistoryState: vi.fn()
}));

describe('useHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    globalThis.go = {
      main: {
        App: {
          Undo: vi.fn(),
          Redo: vi.fn(),
          GetHistoryLogs: vi.fn(),
          JumpToHistory: vi.fn()
        }
      }
    };
  });

  it('handleUndo calls backend and applies state', async () => {
    const mockState = { nodes: [] };
    // @ts-ignore
    globalThis.go.main.App.Undo.mockResolvedValue(mockState);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.handleUndo();
    });

    // @ts-ignore
    expect(globalThis.go.main.App.Undo).toHaveBeenCalled();
    expect(applyHistoryState).toHaveBeenCalledWith(mockState);
  });

  it('handleRedo calls backend and applies state', async () => {
    const mockState = { nodes: [] };
    // @ts-ignore
    globalThis.go.main.App.Redo.mockResolvedValue(mockState);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.handleRedo();
    });

    // @ts-ignore
    expect(globalThis.go.main.App.Redo).toHaveBeenCalled();
    expect(applyHistoryState).toHaveBeenCalledWith(mockState);
  });

  it('fetchHistoryLogs updates historyLogs state', async () => {
    const mockLogs = ['log1', 'log2'];
    // @ts-ignore
    globalThis.go.main.App.GetHistoryLogs.mockResolvedValue(mockLogs);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.fetchHistoryLogs();
    });

    // Reversed order
    expect(result.current.historyLogs).toEqual(['log2', 'log1']);
  });

  it('handleJumpToHistory calls backend and applies state', async () => {
    const mockState = { nodes: [] };
    // @ts-ignore
    globalThis.go.main.App.JumpToHistory.mockResolvedValue(mockState);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.handleJumpToHistory(1);
    });

    // @ts-ignore
    expect(globalThis.go.main.App.JumpToHistory).toHaveBeenCalledWith(1);
    expect(applyHistoryState).toHaveBeenCalledWith(mockState);
  });
});
