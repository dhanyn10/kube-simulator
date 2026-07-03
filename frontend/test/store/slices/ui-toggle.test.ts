import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFlowStore } from '../../../src/store';

describe('UI Toggle Handlers (Gear Settings)', () => {
  beforeEach(() => {
    // Reset state
    useFlowStore.setState({
      nodes: [],
      edges: [],
      configuringNodeId: null,
      configuringEdgeId: null,
      isRightSidebarVisible: false
    });

    // Mock SaveSetting to avoid actual backend calls during tests
    window.go = {
      main: {
        App: {
          SaveSetting: vi.fn().mockResolvedValue(true)
        }
      }
    } as any;
  });

  it('opens sidebar when toggleNodeSettings is called on a node', () => {
    const store = useFlowStore.getState();
    const nodeId = 'node-1';

    store.toggleNodeSettings(nodeId);

    const updatedState = useFlowStore.getState();
    expect(updatedState.isRightSidebarVisible).toBe(true);
    expect(updatedState.configuringNodeId).toBe(nodeId);
  });

  it('closes sidebar when toggleNodeSettings is called on the same node while visible', () => {
    const nodeId = 'node-1';
    useFlowStore.setState({
      configuringNodeId: nodeId,
      isRightSidebarVisible: true
    });

    useFlowStore.getState().toggleNodeSettings(nodeId);

    const updatedState = useFlowStore.getState();
    expect(updatedState.isRightSidebarVisible).toBe(false);
    expect(updatedState.configuringNodeId).toBe(null);
  });

  it('keeps sidebar open and switches node when toggleNodeSettings is called on a different node', () => {
    const node1 = 'node-1';
    const node2 = 'node-2';
    useFlowStore.setState({
      configuringNodeId: node1,
      isRightSidebarVisible: true
    });

    useFlowStore.getState().toggleNodeSettings(node2);

    const updatedState = useFlowStore.getState();
    expect(updatedState.isRightSidebarVisible).toBe(true);
    expect(updatedState.configuringNodeId).toBe(node2);
  });

  it('opens sidebar when toggleEdgeSettings is called on an edge', () => {
    const edgeId = 'edge-1';

    useFlowStore.getState().toggleEdgeSettings(edgeId);

    const updatedState = useFlowStore.getState();
    expect(updatedState.isRightSidebarVisible).toBe(true);
    expect(updatedState.configuringEdgeId).toBe(edgeId);
  });

  it('closes sidebar when toggleEdgeSettings is called on the same edge while visible', () => {
    const edgeId = 'edge-1';
    useFlowStore.setState({
      configuringEdgeId: edgeId,
      isRightSidebarVisible: true
    });

    useFlowStore.getState().toggleEdgeSettings(edgeId);

    const updatedState = useFlowStore.getState();
    expect(updatedState.isRightSidebarVisible).toBe(false);
    expect(updatedState.configuringEdgeId).toBe(null);
  });
});
