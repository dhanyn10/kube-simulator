import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';
import { clipboardHandlers } from '@/store/handlers/nodeClipboardHandlers';
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

  it('tryIncrementPodReplicas handles zero initial replicas on controller target and standalone pod target', () => {
    const clipboardPod: Node = { id: 'clip-pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'worker-pod' } };

    // Controller parent exists but targetNode data.replicas is undefined/0 (non-Pod target fallback to 0)
    const parentDep: Node = {
      id: 'dep-1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { label: 'dep' }, // no replicas field -> defaults to 0
    };

    const childPod: Node = {
      id: 'clip-pod-1',
      parentId: 'dep-1',
      type: 'Pod',
      selected: true,
      position: { x: 0, y: 0 },
      data: { label: 'worker-pod' },
    };

    const updateNodeData = vi.fn();
    useFlowStore.setState({
      clipboard: { nodes: [clipboardPod], edges: [] },
      nodes: [parentDep, childPod],
      updateNodeData,
    });

    useFlowStore.getState().pasteNodes();
    expect(updateNodeData).toHaveBeenCalledWith('dep-1', { replicas: 1 });
  });

  it('tryIncrementPodReplicas handles non-Pod target node with no replicas in data fallback', () => {
    const clipboardPod: Node = { id: 'clip-pod-nonpod', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'app-pod' } };
    const selectedPod: Node = { id: 'clip-pod-nonpod', parentId: 'parent-svc', selected: true, type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'app-pod' } };

    const updateNodeData = vi.fn();
    useFlowStore.setState({
      clipboard: { nodes: [clipboardPod], edges: [] },
      nodes: [selectedPod],
      updateNodeData,
    });

    useFlowStore.getState().pasteNodes();
    expect(updateNodeData).toHaveBeenCalledWith('clip-pod-nonpod', { replicas: 2 });
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

    // 3b. Parent ReplicaSet with no replicas set -> fallback 0
    updateSpy.mockClear();
    const rsNoReplicas: Node = { id: 'rs-no-rep', type: 'ReplicaSet', position: { x: 0, y: 0 }, data: {} };
    const childPodRSNoRep: Node = { id: 'clip-pod', type: 'Pod', parentId: 'rs-no-rep', selected: true, position: { x: 0, y: 0 }, data: { label: 'my-app' } };

    useFlowStore.setState({
      nodes: [rsNoReplicas, childPodRSNoRep] as any,
      clipboard: { nodes: [clipboardPod], edges: [] },
      updateNodeData: updateSpy,
    });
    useFlowStore.getState().pasteNodes();
    expect(updateSpy).toHaveBeenCalledWith('rs-no-rep', { replicas: 1 });

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

    // 5b. Standalone Pod with no replicas property -> fallback 1
    updateSpy.mockClear();
    const standalonePodNoReplicas: Node = { id: 'pod-no-rep', type: 'Pod', selected: true, position: { x: 0, y: 0 }, data: { label: 'no-rep-pod' } };
    const clipPodNoRep: Node = { id: 'clip-no-rep', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'no-rep-pod' } };

    useFlowStore.setState({
      nodes: [standalonePodNoReplicas] as any,
      clipboard: { nodes: [clipPodNoRep], edges: [] },
      updateNodeData: updateSpy,
    });
    useFlowStore.getState().pasteNodes();
    expect(updateSpy).toHaveBeenCalledWith('pod-no-rep', { replicas: 2 });

    // 6. Selected pod points to non-existent targetId or targetNode is missing
    updateSpy.mockClear();
    const orphanPod: Node = { id: 'orphan-pod', type: 'Pod', parentId: 'missing-dep', selected: true, position: { x: 0, y: 0 }, data: { label: 'my-app' } };
    useFlowStore.setState({
      nodes: [orphanPod] as any, // missing-dep is missing
      clipboard: { nodes: [clipboardPod], edges: [] },
      updateNodeData: updateSpy,
    });
    useFlowStore.getState().pasteNodes();
    expect(updateSpy).toHaveBeenCalledWith('orphan-pod', { replicas: 2 });

    // 7. targetNode is undefined when parent is found on first find but targetId is missing on second find
    updateSpy.mockClear();
    const customPod: Node = { id: 'c-pod', parentId: 'c-dep', selected: true, type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'my-app' } };
    const customDep: Node = { id: 'c-dep', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
    let findCount = 0;
    const customNodesList = [customPod, customDep];
    const proxyNodes = new Proxy(customNodesList, {
      get(target, prop) {
        if (prop === 'find') {
          return (predicate: any) => {
            findCount++;
            if (findCount === 3) return undefined; // third find call returns undefined for targetNode
            return target.find(predicate);
          };
        }
        return (target as any)[prop];
      }
    });

    useFlowStore.setState({
      nodes: proxyNodes as any,
      clipboard: { nodes: [clipboardPod], edges: [] },
      updateNodeData: updateSpy,
    });
    useFlowStore.getState().pasteNodes();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('pasteNodes handles pasting Pod without data object', () => {
    const podWithoutData: Node = { id: 'pod-no-data', type: 'Pod', position: { x: 0, y: 0 } } as any;

    useFlowStore.setState({
      nodes: [],
      edges: [],
      clipboard: { nodes: [podWithoutData], edges: [] },
    });

    useFlowStore.getState().pasteNodes();

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].type).toBe('Pod');
  });

  it('pasteNodes handles edge cases with unmapped edges, empty clipboard, and missing positions/data', () => {
    // 1. Clipboard with empty nodes array returns early
    useFlowStore.setState({ clipboard: { nodes: [], edges: [] }, nodes: [] });
    useFlowStore.getState().pasteNodes();
    expect(useFlowStore.getState().nodes).toEqual([]);

    // 2. Node in clipboard with no position or data, and pre-existing edges on canvas
    const plainNode: Node = { id: 'plain1', type: 'Service' } as any;
    const podNoData: Node = { id: 'pod-no-data', type: 'Pod' } as any;
    const unmappedEdge = { id: 'e-unmapped', source: 'missing-source', target: 'missing-target' };
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
    expect(state.edges[1].source).toBe('missing-source');
    expect(state.edges[1].target).toBe('missing-target');
  });

  it('pasteNodes handles partially mapped edge where source is in idMap but target is unmapped', () => {
    const nodeA: Node = { id: 'nodeA', type: 'Service', position: { x: 0, y: 0 }, data: {} };
    // Edge source 'nodeA' will be mapped to new random ID in idMap, but target 'unmappedTarget' will fall back via || e.target
    const partialEdge = { id: 'e-partial', source: 'nodeA', target: 'unmappedTarget' };

    useFlowStore.setState({
      nodes: [],
      edges: [],
      clipboard: { nodes: [nodeA], edges: [partialEdge] },
    });

    useFlowStore.getState().pasteNodes();

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.edges).toHaveLength(1);
    expect(state.edges[0].source).not.toBe('nodeA'); // mapped to new ID
    expect(state.edges[0].target).toBe('unmappedTarget'); // fallback to original e.target
  });

  it('tryIncrementPodReplicas increments replicas for standalone matching pod', () => {
    const updateSpy = vi.fn();
    const clipPod: Node = { id: 'p-clip', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'app' } };
    const selPod: Node = { id: 'p-sel', type: 'Pod', selected: true, position: { x: 0, y: 0 }, data: { label: 'app' } };

    useFlowStore.setState({
      nodes: [selPod],
      clipboard: { nodes: [clipPod], edges: [] },
      updateNodeData: updateSpy,
    });

    useFlowStore.getState().pasteNodes();
    expect(updateSpy).toHaveBeenCalledWith('p-sel', { replicas: 2 });
  });

  it('tryIncrementPodReplicas matches pods when both have undefined labels and different IDs', () => {
    const updateSpy = vi.fn();
    const clipPodNoLabel: Node = { id: 'clip-nolabel-1', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
    const selPodNoLabel: Node = { id: 'sel-nolabel-2', type: 'Pod', selected: true, position: { x: 0, y: 0 }, data: {} };

    useFlowStore.setState({
      nodes: [selPodNoLabel],
      clipboard: { nodes: [clipPodNoLabel], edges: [] },
      updateNodeData: updateSpy,
    });

    useFlowStore.getState().pasteNodes();
    expect(updateSpy).toHaveBeenCalledWith('sel-nolabel-2', { replicas: 2 });
  });

  it('tryIncrementPodReplicas returns false when clipboard has no pod or selected node is not a pod', () => {
    const updateSpy = vi.fn();
    const clipSvc: Node = { id: 'clip-svc', type: 'Service', position: { x: 0, y: 0 }, data: {} };
    const selPod: Node = { id: 'sel-pod', type: 'Pod', selected: true, position: { x: 0, y: 0 }, data: {} };

    useFlowStore.setState({
      nodes: [selPod] as any,
      clipboard: { nodes: [clipSvc], edges: [] },
      updateNodeData: updateSpy,
    });
    useFlowStore.getState().pasteNodes();
    expect(updateSpy).not.toHaveBeenCalled();

    const clipPod: Node = { id: 'clip-pod', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
    const selSvc: Node = { id: 'sel-svc', type: 'Service', selected: true, position: { x: 0, y: 0 }, data: {} };

    useFlowStore.setState({
      nodes: [selSvc] as any,
      clipboard: { nodes: [clipPod], edges: [] },
      updateNodeData: updateSpy,
    });
    useFlowStore.getState().pasteNodes();
    expect(updateSpy).not.toHaveBeenCalled();
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

  it('copies and pastes Deployment without duplicating replicas or creating orphan free-floating pods', () => {
    const depNode: Node = {
      id: 'dep-orig',
      type: 'Deployment',
      selected: true,
      position: { x: 100, y: 100 },
      data: { label: 'web-api', baseName: 'web-api', replicas: 2 },
    };
    const pod1: Node = {
      id: 'pod-orig-1',
      type: 'Pod',
      parentId: 'dep-orig',
      selected: false,
      position: { x: 20, y: 40 },
      data: { label: 'web-api-pod-1', parentId: 'dep-orig' },
    };
    const pod2: Node = {
      id: 'pod-orig-2',
      type: 'Pod',
      parentId: 'dep-orig',
      selected: false,
      position: { x: 20, y: 100 },
      data: { label: 'web-api-pod-2', parentId: 'dep-orig' },
    };

    useFlowStore.setState({
      nodes: [depNode, pod1, pod2] as any,
      edges: [],
    });

    // 1. Copy the selected Deployment (which automatically copies its child pods)
    useFlowStore.getState().copyNodes();
    const clipboard = useFlowStore.getState().clipboard;
    expect(clipboard?.nodes).toHaveLength(3);

    // Deselect original nodes so tryIncrementPodReplicas doesn't trigger
    useFlowStore.setState({
      nodes: [
        { ...depNode, selected: false },
        { ...pod1, selected: false },
        { ...pod2, selected: false },
      ] as any,
    });

    // 2. Paste the Deployment
    useFlowStore.getState().pasteNodes();
    const nodesAfterPaste = useFlowStore.getState().nodes;

    // Total nodes should be exactly 6: 1 old dep + 2 old pods + 1 new dep + 2 new pods inside it
    expect(nodesAfterPaste).toHaveLength(6);

    const deployments = nodesAfterPaste.filter((n) => n.type === 'Deployment');
    expect(deployments).toHaveLength(2);

    const newDep = deployments.find((n) => n.id !== 'dep-orig');
    expect(newDep).toBeDefined();
    expect(newDep!.data?.label).toBe('web-api-1'); // Unique label assigned
    expect(newDep!.position.x).toBe(140); // 100 + offset 40
    expect(newDep!.position.y).toBe(140);

    // Check all pods in the canvas
    const allPods = nodesAfterPaste.filter((n) => n.type === 'Pod');
    expect(allPods).toHaveLength(4);

    // Original deployment has exactly 2 child pods
    const origChildPods = allPods.filter((n) => n.parentId === 'dep-orig');
    expect(origChildPods).toHaveLength(2);

    // New deployment has exactly 2 child pods
    const newChildPods = allPods.filter((n) => n.parentId === newDep!.id);
    expect(newChildPods).toHaveLength(2);

    // Crucially: NO orphan/free-floating pods!
    const orphanPods = allPods.filter((n) => !n.parentId);
    expect(orphanPods).toHaveLength(0);
  });

  it('remaps groupId when copying grouped nodes to avoid moving original nodes on drag', () => {
    const nodeA: Node = {
      id: 'grp-a',
      type: 'Service',
      selected: true,
      position: { x: 0, y: 0 },
      data: { label: 'svc-grp', groupId: 'group-orig' },
    };
    const nodeB: Node = {
      id: 'grp-b',
      type: 'Service',
      selected: true,
      position: { x: 100, y: 0 },
      data: { label: 'svc-grp-2', groupId: 'group-orig' },
    };

    useFlowStore.setState({
      nodes: [nodeA, nodeB] as any,
      edges: [],
    });

    useFlowStore.getState().copyNodes();

    useFlowStore.setState({
      nodes: [
        { ...nodeA, selected: false },
        { ...nodeB, selected: false },
      ] as any,
    });

    useFlowStore.getState().pasteNodes();

    const pastedServices = useFlowStore.getState().nodes.filter((n) => n.id !== 'grp-a' && n.id !== 'grp-b');
    expect(pastedServices).toHaveLength(2);

    const newGroupIdA = pastedServices[0].data?.groupId;
    const newGroupIdB = pastedServices[1].data?.groupId;

    expect(newGroupIdA).toBeDefined();
    expect(newGroupIdA).not.toBe('group-orig'); // Unique new group
    expect(newGroupIdA).toBe(newGroupIdB); // Still grouped together
  });

  it('pastes child pod standalone with absolute canvas position when its parent is not copied', () => {
    const dep: Node = {
      id: 'dep-parent',
      type: 'Deployment',
      position: { x: 200, y: 300 },
      data: { label: 'dep' },
    };
    const childPod: Node = {
      id: 'pod-to-copy',
      type: 'Pod',
      parentId: 'dep-parent',
      selected: true,
      position: { x: 50, y: 60 },
      data: { label: 'child', parentId: 'dep-parent' },
    };

    useFlowStore.setState({
      nodes: [dep, childPod] as any,
      edges: [],
    });

    // Only child pod is selected and copied
    useFlowStore.getState().copyNodes();

    useFlowStore.setState({
      nodes: [dep, { ...childPod, selected: false }] as any,
    });

    useFlowStore.getState().pasteNodes();

    const nodes = useFlowStore.getState().nodes;
    const pastedStandalone = nodes.find((n) => n.id !== 'pod-to-copy' && n.type === 'Pod');

    expect(pastedStandalone).toBeDefined();
    expect(pastedStandalone!.parentId).toBeUndefined();
    expect(pastedStandalone!.extent).toBeUndefined();
    // Absolute position should be (dep.x + child.x + offset, dep.y + child.y + offset) = (200 + 50 + 40, 300 + 60 + 40) = (290, 400)
    expect(pastedStandalone!.position.x).toBe(290);
    expect(pastedStandalone!.position.y).toBe(400);
  });
});
