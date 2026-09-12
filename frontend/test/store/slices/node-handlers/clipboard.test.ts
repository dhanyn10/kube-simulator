import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';
import { clipboardHandlers } from '@/store/slices/node-handlers/clipboardHandlers';
import { Node } from '@xyflow/react';

describe('clipboardHandlers', () => {
  beforeEach(() => {
    useFlowStore.setState({
      nodes: [],
      edges: [],
      clipboard: null,
    });
  });

  it('copyNodes returns early when no nodes are selected', () => {
    useFlowStore.setState({ nodes: [{ id: 'n1', selected: false }] as any });

    useFlowStore.getState().copyNodes();
    expect(useFlowStore.getState().clipboard).toBeNull();
  });

  it('copyNodes copies selected nodes and connected child nodes inside Deployment', () => {
    const depNode: Node = { id: 'dep1', type: 'Deployment', selected: true, position: { x: 0, y: 0 }, data: {} };
    const childPod: Node = { id: 'pod1', type: 'Pod', parentId: 'dep1', selected: false, position: { x: 0, y: 0 }, data: {} };
    const edge = { id: 'e1', source: 'dep1', target: 'pod1' };

    useFlowStore.setState({ nodes: [depNode, childPod] as any, edges: [edge] as any });

    useFlowStore.getState().copyNodes();

    const clipboard = useFlowStore.getState().clipboard;
    expect(clipboard?.nodes).toHaveLength(2);
    expect(clipboard?.edges).toHaveLength(1);
  });

  it('pasteNodes returns early when clipboard is empty', () => {
    useFlowStore.setState({ clipboard: null, nodes: [] });

    useFlowStore.getState().pasteNodes();
    expect(useFlowStore.getState().nodes).toEqual([]);
  });

  it('pasteNodes increments pod replicas when pasting matching selected pod', () => {
    const updateSpy = vi.fn();
    const podNode: Node = { id: 'pod1', type: 'Pod', selected: true, position: { x: 0, y: 0 }, data: { label: 'pod1', replicas: 1 } };
    useFlowStore.setState({
      nodes: [podNode] as any,
      clipboard: { nodes: [{ ...podNode }], edges: [] },
      updateNodeData: updateSpy,
    });

    useFlowStore.getState().pasteNodes();

    expect(updateSpy).toHaveBeenCalledWith('pod1', { replicas: 2 });
  });

  it('pasteNodes increments controller replicas when selected pod belongs to Deployment parent', () => {
    const updateSpy = vi.fn();
    const depNode: Node = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 3 } };
    const podNode: Node = { id: 'pod1', type: 'Pod', parentId: 'dep1', selected: true, position: { x: 0, y: 0 }, data: { label: 'pod1' } };
    useFlowStore.setState({
      nodes: [depNode, podNode] as any,
      clipboard: { nodes: [{ ...podNode }], edges: [] },
      updateNodeData: updateSpy,
    });

    useFlowStore.getState().pasteNodes();

    expect(updateSpy).toHaveBeenCalledWith('dep1', { replicas: 4 });
  });

  it('pasteNodes duplicates nodes and edges with new IDs and position offsets', () => {
    const svcNode: Node = { id: 'svc1', type: 'Service', position: { x: 10, y: 20 }, data: {} };
    const podNode: Node = { id: 'pod1', type: 'Pod', position: { x: 50, y: 60 }, data: {} };
    const edge = { id: 'e1', source: 'svc1', target: 'pod1' };

    useFlowStore.setState({
      nodes: [],
      edges: [],
      clipboard: { nodes: [svcNode, podNode], edges: [edge] },
    });

    useFlowStore.getState().pasteNodes();

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(2);
    expect(state.edges).toHaveLength(1);
    expect(state.lastActionName).toBe('Paste Elements');
  });

  it('direct clipboardHandlers caller handles standalone set/get state', () => {
    let dummyState: any = {
      nodes: [],
      edges: [],
      clipboard: null,
      updateNodeData: vi.fn(),
    };
    const set = (fn: any) => {
      if (typeof fn === 'function') dummyState = { ...dummyState, ...fn(dummyState) };
      else dummyState = { ...dummyState, ...fn };
    };
    const get = () => dummyState;

    const handlers = clipboardHandlers(set, get);
    handlers.copyNodes();
    expect(dummyState.clipboard).toBeNull();
  });
});
