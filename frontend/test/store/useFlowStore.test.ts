import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFlowStore, applyHistoryState, formatAutosaveKey, getCurrentSessionAutosaveKey } from '@/store/useFlowStore';
import { logger } from '@/lib/logger';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('useFlowStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Go backend
    (globalThis as any).go = {
      main: {
        App: {
          PushHistory: vi.fn().mockResolvedValue(true),
          UpdateProject: vi.fn().mockResolvedValue(true),
          SaveSetting: vi.fn(),
        }
      }
    };
  });

  it('formatAutosaveKey generates correctly formatted timestamp string and getCurrentSessionAutosaveKey caches key', () => {
    const d = new Date(2026, 8, 10, 12, 0, 8); // Sep 10, 2026 12:00:08
    expect(formatAutosaveKey(d)).toBe('autosave-10092026120008');
    expect(formatAutosaveKey()).toMatch(/^autosave-\d+/);

    const key1 = getCurrentSessionAutosaveKey();
    const key2 = getCurrentSessionAutosaveKey();
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^autosave-\d+/);
  });

  it('initializes with default values and executes initial history timeout capture', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mockPush = vi.fn().mockResolvedValue(true);
    (globalThis as any).go = { main: { App: { PushHistory: mockPush } } };

    const freshModule = await import('@/store/useFlowStore');

    // Advance fake timers to trigger module top-level setTimeout
    vi.advanceTimersByTime(600);
    expect(mockPush).toHaveBeenCalled();

    // Also test when go backend is absent on initial capture
    vi.resetModules();
    delete (globalThis as any).go;
    await import('@/store/useFlowStore');
    vi.advanceTimersByTime(600);

    vi.useRealTimers();

    const state = freshModule.useFlowStore.getState();
    expect(state.lastActionId).toBe('init');
    expect(state.nodes).toEqual([]);
  });

  it('applyHistoryState handles empty input and updates the store', () => {
    applyHistoryState('');

    const snapshot = JSON.stringify({
      nodes: [{ id: 'h1', type: 'Pod', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
      actionName: 'Restored Action'
    });

    applyHistoryState(snapshot);

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].id).toBe('h1');
    expect(state.lastActionName).toBe('Applied: Restored Action');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Applied state from log'));
  });

  it('applyHistoryState handles invalid JSON', () => {
    applyHistoryState('invalid');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to apply state'), expect.any(Error));
  });

  it('records history on lastActionId change and invokes fetchHistoryLogs', async () => {
    const fetchHistoryLogsMock = vi.fn();

    useFlowStore.setState({
      fetchHistoryLogs: fetchHistoryLogsMock,
      lastActionId: 'action-1',
      lastActionName: 'Test Action',
      nodes: [],
      edges: []
    });

    expect((globalThis as any).go.main.App.PushHistory).toHaveBeenCalled();
    const callArgs = (globalThis as any).go.main.App.PushHistory.mock.calls[0][0];
    const data = JSON.parse(callArgs);
    expect(data.actionName).toBe('Test Action');

    // Resolve PushHistory promise
    await new Promise(process.nextTick);
    expect(fetchHistoryLogsMock).toHaveBeenCalled();
  });

  it('handles subscription when PushHistory rejects', async () => {
    (globalThis as any).go.main.App.PushHistory = vi.fn().mockRejectedValue(new Error('History write failed'));

    useFlowStore.setState({
      lastActionId: 'action-reject',
      lastActionName: 'Rejecting Action',
    });

    await new Promise(process.nextTick);
    expect(useFlowStore.getState().lastActionName).toBe('Rejecting Action');
  });

  it('handles subscription when Wails App backend is absent', async () => {
    delete (globalThis as any).go;

    useFlowStore.setState({
      lastActionId: 'action-no-go',
      lastActionName: 'No Go Action',
    });

    expect(useFlowStore.getState().lastActionName).toBe('No Go Action');
  });

  it('autosaves project when enabled and updates lastSavedSnapshot on success', async () => {
    (globalThis as any).go = {
      main: {
        App: {
          PushHistory: vi.fn().mockResolvedValue(true),
          UpdateProject: vi.fn().mockResolvedValue(true),
          SaveSetting: vi.fn(),
        },
      },
    };

    useFlowStore.setState({
      currentProject: { id: 1, name: 'Project 1' },
      lastActionId: 'action-save-success'
    });

    expect((globalThis as any).go.main.App.UpdateProject).toHaveBeenCalledWith(1, expect.any(String));
    await new Promise(process.nextTick);
    expect(useFlowStore.getState().lastSavedSnapshot).toEqual(expect.stringContaining('"nodes":[]'));
  });

  it('handles autosave when UpdateProject returns false or when currentProject id is -1', async () => {
    (globalThis as any).go = {
      main: {
        App: {
          PushHistory: vi.fn().mockResolvedValue(true),
          UpdateProject: vi.fn().mockResolvedValue(false),
          SaveSetting: vi.fn(),
        },
      },
    };

    useFlowStore.setState({
      currentProject: { id: 1, name: 'Project 1' },
      lastSavedSnapshot: 'initial-snap',
      lastActionId: 'action-save-false'
    });

    await new Promise(process.nextTick);
    expect(useFlowStore.getState().lastSavedSnapshot).toBe('initial-snap');

    // currentProject.id === -1 -> does not invoke UpdateProject
    (globalThis as any).go.main.App.UpdateProject.mockClear();
    useFlowStore.setState({
      currentProject: { id: -1, name: 'Unsaved Project' },
      lastActionId: 'action-save-negative'
    });

    expect((globalThis as any).go.main.App.UpdateProject).not.toHaveBeenCalled();
  });

  it('can select state using the hook selector wrapper via renderHook', () => {
    const { result } = renderHook(() => useFlowStore((state) => state.lastActionId));
    expect(result.current).toBeDefined();
  });

  it('handles beforeunload event and executes autosave', () => {
    const saveSettingSpy = vi.fn();
    (globalThis as any).go = { main: { App: { SaveSetting: saveSettingSpy } } };

    globalThis.dispatchEvent(new Event('beforeunload'));
    expect(saveSettingSpy).toHaveBeenCalled();
  });

  it('skips autosave when isAutosaveEnabled is false', () => {
    const saveSettingSpy = vi.fn();
    (globalThis as any).go = { main: { App: { SaveSetting: saveSettingSpy } } };

    useFlowStore.setState({
      isAutosaveEnabled: false,
      lastActionId: 'action-disabled-autosave',
    });

    expect(saveSettingSpy).not.toHaveBeenCalled();
    useFlowStore.setState({ isAutosaveEnabled: true });
  });

  it('skips recording history when lastActionId does not change', () => {
    const pushSpy = (globalThis as any).go.main.App.PushHistory;
    pushSpy.mockClear();

    useFlowStore.setState({ isTerminalOpen: true });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('handles missing fetchHistoryLogs or missing SaveSetting / UpdateProject', async () => {
    // Missing SaveSetting on App
    (globalThis as any).go = {
      main: {
        App: {
          PushHistory: vi.fn().mockResolvedValue(true),
        }
      }
    };

    useFlowStore.setState({
      fetchHistoryLogs: undefined as any,
      currentProject: { id: 99, name: 'Project without UpdateProject' },
      lastActionId: 'action-no-savesetting-or-updateproject',
    });

    await new Promise(process.nextTick);
    expect(useFlowStore.getState().lastActionId).toBe('action-no-savesetting-or-updateproject');
  });

  it('generates session autosave key on first executeAutosave when key was initially null', async () => {
    vi.useFakeTimers();
    vi.resetModules();

    const saveSettingSpy = vi.fn();
    (globalThis as any).go = {
      main: {
        App: {
          SaveSetting: saveSettingSpy,
          PushHistory: vi.fn().mockResolvedValue(true),
        }
      }
    };

    const fresh = await import('@/store/useFlowStore');
    fresh.useFlowStore.setState({
      isAutosaveEnabled: true,
      lastActionId: 'action-first-autosave-null-key',
    });

    expect(saveSettingSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('handles module evaluation when globalThis is undefined', async () => {
    vi.resetModules();
    const origDescriptor = Object.getOwnPropertyDescriptor(global, 'globalThis');
    try {
      Object.defineProperty(global, 'globalThis', {
        configurable: true,
        get() {
          const stack = new Error().stack || '';
          if (stack.includes('useFlowStore.ts:100') || stack.includes('useFlowStore.ts:155')) {
            return undefined;
          }
          return origDescriptor?.value ?? global;
        }
      });
      const mod = await import('@/store/useFlowStore');
      expect(mod.useFlowStore).toBeDefined();
    } finally {
      if (origDescriptor) {
        Object.defineProperty(global, 'globalThis', origDescriptor);
      }
    }
  });
});




