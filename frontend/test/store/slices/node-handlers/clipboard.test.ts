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

  it('tryIncrementPodReplicas handles label matching and ReplicaSet/Namespace/standalone targets', () => {
    const updateSpy = vi.fn();

    // 1. Matching by label when IDs differ
    const clipboardPod: Node = { id: 'clip-pod', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'my-app' } };
    const selPodLabelMatch: Node = { id: 'sel-pod', type: 'Pod', selected: true, position: { x: 0, y: 0 }, data: { label: 'my-app' } };

    useFlowStore.setState({
      nodes: [selPodLabelMatch] as any,
      clipboard: { nodes: [clipboardPod], edges: [] },
      updateNodeData: updateSpy,
    });
    useFlowStore.getState().pasteNodes();
    expect(updateSpy).toHaveBeenCalledWith('sel-pod', { replicas: 2 });

    // 2. Mismatched label and ID returns false and pastes new node
    updateSpy.mockClear();
    const selPodMismatch: Node = { id: 'other-pod', type: 'Pod', selected: true, position: { x: 0, y: 0 }, data: { label: 'different' } };

    useFlowStore.setState({
      nodes: [selPodMismatch] as any,
      clipboard: { nodes: [clipboardPod], edges: [] },
      updateNodeData: updateSpy,
    });
    useFlowStore.getState().pasteNodes();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(useFlowStore.getState().nodes).toHaveLength(2);

    // 3. Parent is a ReplicaSet
    updateSpy.mockClear();
    const rsNode: Node = { id: 'rs1', type: 'ReplicaSet', position: { x: 0, y: 0 }, data: { replicas: 5 } };
    const childPodRS: Node = { id: 'clip-pod', type: 'Pod', parentId: 'rs1', selected: true, position: { x: 0, y: 0 }, data: { label: 'my-app' } };

    useFlowStore.setState({
      nodes: [rsNode, childPodRS] as any,
      clipboard: { nodes: [clipboardPod], edges: [] },
      updateNodeData: updateSpy,
    });
    useFlowStore.getState().pasteNodes();
    expect(updateSpy).toHaveBeenCalledWith('rs1', { replicas: 6 });

    // 4. Parent is a Namespace (non-controller) -> target is pod itself
    updateSpy.mockClear();
    const nsNode: Node = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
    const childPodNS: Node = { id: 'clip-pod', type: 'Pod', parentId: 'ns1', selected: true, position: { x: 0, y: 0 }, data: { label: 'my-app' } };

    useFlowStore.setState({
      nodes: [nsNode, childPodNS] as any,
      clipboard: { nodes: [clipboardPod], edges: [] },
      updateNodeData: updateSpy,
    });
    useFlowStore.getState().pasteNodes();
    expect(updateSpy).toHaveBeenCalledWith('clip-pod', { replicas: 2 });

    // 5. Parent Deployment with no replicas set -> fallback 0
    updateSpy.mockClear();
    const depNoReplicas: Node = { id: 'dep-no-rep', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
    const childPodDepNoRep: Node = { id: 'clip-pod', type: 'Pod', parentId: 'dep-no-rep', selected: true, position: { x: 0, y: 0 }, data: { label: 'my-app' } };

    useFlowStore.setState({
      nodes: [depNoReplicas, childPodDepNoRep] as any,
      clipboard: { nodes: [clipboardPod], edges: [] },
      updateNodeData: updateSpy,
    });
    useFlowStore.getState().pasteNodes();
    expect(updateSpy).toHaveBeenCalledWith('dep-no-rep', { replicas: 1 });

  });

  it('pasteNodes handles edge cases with unmapped edges, empty clipboard, and missing positions/data', () => {
    // 1. Clipboard with empty nodes array returns early
    useFlowStore.setState({ clipboard: { nodes: [], edges: [] }, nodes: [] });
    useFlowStore.getState().pasteNodes();
    expect(useFlowStore.getState().nodes).toEqual([]);

    // 2. Node in clipboard with no position or data, and pre-existing edges on canvas
    const plainNode: Node = { id: 'plain1', type: 'Service' } as any;
    const podNoData: Node = { id: 'pod-no-data', type: 'Pod' } as any;
    const unmappedEdge = { id: 'e-unmapped', source: 'plain1', target: 'missing-target' };
    const existingEdge = { id: 'e-existing', source: 'a', target: 'b', selected: true };

    useFlowStore.setState({
      nodes: [],
      edges: [existingEdge],
      clipboard: { nodes: [plainNode, podNoData], edges: [unmappedEdge] },
    });

    useFlowStore.getState().pasteNodes();

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(2);
    expect(state.edges).toHaveLength(2);
    expect(state.edges[0].selected).toBe(false);
    expect(state.edges[1].target).toBe('missing-target');
  });

  it('copyNodes handles non-Deployment nodes and uncopied edge targets', () => {
    const svcNode: Node = { id: 'svc1', type: 'Service', selected: true, position: { x: 0, y: 0 }, data: {} };
    const unselectedPod: Node = { id: 'pod1', type: 'Pod', selected: false, position: { x: 0, y: 0 }, data: {} };
    const edge = { id: 'e1', source: 'svc1', target: 'pod1' };

    useFlowStore.setState({ nodes: [svcNode, unselectedPod] as any, edges: [edge] as any });

    useFlowStore.getState().copyNodes();

    const clipboard = useFlowStore.getState().clipboard;
    expect(clipboard?.nodes).toHaveLength(1);
    expect(clipboard?.edges).toHaveLength(0);
  });
});
