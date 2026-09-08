import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore, applyHistoryState } from '@/store/useFlowStore';
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
          UpdateProject: vi.fn().mockResolvedValue(true)
        }
      }
    };
  });

  it('initializes with default values and executes initial history timeout capture', async () => {
    vi.useFakeTimers();
    const mockPush = vi.fn();
    (globalThis as any).go = { main: { App: { PushHistory: mockPush } } };

    // Advance fake timers to trigger module top-level setTimeout
    vi.advanceTimersByTime(600);
    vi.useRealTimers();

    const state = useFlowStore.getState();
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
  });

  it('handles subscription when Wails App backend is absent or rejects', async () => {
    delete (globalThis as any).go;

    useFlowStore.setState({
      lastActionId: 'action-no-go',
      lastActionName: 'No Go Action',
    });

    expect(useFlowStore.getState().lastActionName).toBe('No Go Action');
  });

  it('autosaves project when enabled and updates lastSavedSnapshot on success', async () => {
    (globalThis as any).go.main.App.UpdateProject = vi.fn().mockResolvedValue(true);

    useFlowStore.setState({
      isAutosaveEnabled: true,
      currentProject: { id: 1, name: 'Project 1' },
      lastActionId: 'action-save-success'
    });

    expect((globalThis as any).go.main.App.UpdateProject).toHaveBeenCalledWith(1, expect.any(String));
    await new Promise(process.nextTick);
    expect(useFlowStore.getState().lastSavedSnapshot).toBe(JSON.stringify({ nodes: [], edges: [] }));
  });

  it('handles autosave when UpdateProject returns false or when currentProject id is -1', async () => {
    (globalThis as any).go.main.App.UpdateProject = vi.fn().mockResolvedValue(false);

    useFlowStore.setState({
      isAutosaveEnabled: true,
      currentProject: { id: 1, name: 'Project 1' },
      lastSavedSnapshot: 'initial-snap',
      lastActionId: 'action-save-false'
    });

    await new Promise(process.nextTick);
    expect(useFlowStore.getState().lastSavedSnapshot).toBe('initial-snap');

    // currentProject.id === -1 -> does not invoke UpdateProject
    (globalThis as any).go.main.App.UpdateProject.mockClear();
    useFlowStore.setState({
      isAutosaveEnabled: true,
      currentProject: { id: -1, name: 'Unsaved Project' },
      lastActionId: 'action-save-negative'
    });

    expect((globalThis as any).go.main.App.UpdateProject).not.toHaveBeenCalled();
  });
});
