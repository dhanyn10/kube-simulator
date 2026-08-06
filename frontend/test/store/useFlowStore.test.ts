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
          PushHistory: vi.fn(),
          UpdateProject: vi.fn().mockResolvedValue(true)
        }
      }
    };
  });

  it('initializes with default values', () => {
    const state = useFlowStore.getState();
    expect(state.lastActionId).toBe('init');
    expect(state.nodes).toEqual([]);
  });

  it('applyHistoryState updates the store and suppresses history recording', () => {
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

  it('records history on lastActionId change', async () => {
    useFlowStore.setState({
        lastActionId: 'action-1',
        lastActionName: 'Test Action',
        nodes: [],
        edges: []
    });

    // Subscriptions are synchronous in Zustand, but the effect might be delayed if we use setTimeout
    // In our case it's a direct subscription.

    expect((globalThis as any).go.main.App.PushHistory).toHaveBeenCalled();
    const callArgs = (globalThis as any).go.main.App.PushHistory.mock.calls[0][0];
    const data = JSON.parse(callArgs);
    expect(data.actionName).toBe('Test Action');
  });

  it('autosaves project when enabled', async () => {
    useFlowStore.setState({
        isAutosaveEnabled: true,
        currentProject: { id: 1, name: 'Project 1' },
        lastActionId: 'action-save'
    });

    expect((globalThis as any).go.main.App.UpdateProject).toHaveBeenCalledWith(1, expect.any(String));
  });
});
