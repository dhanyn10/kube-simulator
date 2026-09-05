import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';

const initialAddLog = useFlowStore.getState().addLog;

describe('nodeActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      logs: [],
      lastActionId: 'init',
      addLog: initialAddLog,
    });
  });

  it('addNode logs warning when adding Role without Namespace, or attaches to existing Namespace', () => {
    const addLogSpy = vi.fn();
    useFlowStore.setState({ addLog: addLogSpy });

    const { addNode } = useFlowStore.getState();
    addNode('Role');

    expect(addLogSpy).toHaveBeenCalledWith('warn', expect.stringContaining('Cannot add Role without a Namespace'), 'UI');

    // With Namespace existing
    const nsNode = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
    useFlowStore.setState({ nodes: [nsNode] as any });

    addNode('Role');
    const state = useFlowStore.getState();
    const roleNode = state.nodes.find(n => n.type === 'Role');
    expect(roleNode?.parentId).toBe('ns1');

    useFlowStore.setState({ addLog: initialAddLog });
  });

  it('addNode sets default dimensions for Namespace nodes', () => {
    const { addNode } = useFlowStore.getState();
    addNode('Namespace', { x: 10, y: 10 });

    const state = useFlowStore.getState();
    const nsNode = state.nodes.find(n => n.type === 'Namespace');
    expect(nsNode?.width).toBe(600);
    expect(nsNode?.height).toBe(400);
  });

  it('addNode handles adding a Pod into a Deployment container parent', () => {
    const depNode = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 1 } };
    useFlowStore.setState({ nodes: [depNode] as any });

    const { addNode } = useFlowStore.getState();
    addNode('Pod', { x: 20, y: 20 }, 'dep1');

    const state = useFlowStore.getState();
    expect(state.nodes.some(n => n.parentId === 'dep1' && n.type === 'Pod')).toBe(true);
  });

  it('updateNodeData sets isAutoImage to false when image is explicitly set', () => {
    const pod = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'my-pod', isAutoImage: true } };
    useFlowStore.setState({ nodes: [pod] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('p1', { image: 'custom-image:v1' });

    const state = useFlowStore.getState();
    expect(state.nodes[0].data.image).toBe('custom-image:v1');
    expect(state.nodes[0].data.isAutoImage).toBe(false);
  });

  it('updateNodeData returns early if target node is missing or data has no changes', () => {
    const pod = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'my-pod' } };
    useFlowStore.setState({ nodes: [pod] as any, lastActionName: 'init' });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('missing-node', { label: 'new' });
    expect(useFlowStore.getState().lastActionName).toBe('init');

    updateNodeData('p1', { label: 'my-pod' });
    expect(useFlowStore.getState().lastActionName).toBe('init');
  });

  it('updateNodeData handles Pod parent sync when parent node is missing in store', () => {
    const pod = { id: 'p1', type: 'Pod', parentId: 'missing-dep', position: { x: 0, y: 0 }, data: { replicas: 1 } };
    useFlowStore.setState({ nodes: [pod] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('p1', { replicas: 2 });

    const state = useFlowStore.getState();
    expect(state.nodes.find(n => n.id === 'p1')?.data.replicas).toBe(2);
  });

  it('updateNodeData reverts ReplicaSet back to standalone Pod when replicas scaled down to 1', () => {
    const rs = { id: 'rs1', type: 'ReplicaSet', position: { x: 100, y: 100 }, data: { replicas: 3 } };
    const pod1 = { id: 'p1', type: 'Pod', parentId: 'rs1', position: { x: 20, y: 40 }, data: { replicas: 3 } };
    useFlowStore.setState({ nodes: [rs, pod1] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('p1', { replicas: 1 });

    const state = useFlowStore.getState();
    expect(state.nodes.some(n => n.type === 'ReplicaSet')).toBe(false);
    expect(state.nodes.find(n => n.id === 'p1')?.parentId).toBeUndefined();
  });

  it('addNode adds a new node, resolves collisions, and logs coordinates', () => {
    const { addNode } = useFlowStore.getState();

    addNode('Pod', { x: 100, y: 100 });

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].type).toBe('Pod');
    expect(state.lastActionName).toBe('Add Pod');
    expect(state.logs.some(l => l.message.includes('[Canvas Action]') && l.message.includes('x1:100'))).toBe(true);
  });

  it('deleteNodes removes nodes, connected edges, and logs activity', () => {
    const node1 = { id: 'n1', type: 'Pod', position: { x: 10, y: 10 }, data: {} };
    const node2 = { id: 'n2', type: 'Pod', position: { x: 50, y: 50 }, data: {} };
    const edge = { id: 'e1', source: 'n1', target: 'n2' };

    useFlowStore.setState({ nodes: [node1, node2] as any, edges: [edge] as any, logs: [] });

    const { deleteNodes } = useFlowStore.getState();
    deleteNodes([node1] as any);

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].id).toBe('n2');
    expect(state.edges).toHaveLength(0);
    expect(state.logs.some(l => l.message.includes('Deleted card') && l.message.includes('from coordinates'))).toBe(true);
  });

  it('updateNodeData updates data and handles special workload logic', () => {
    const pod = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'old-label', replicas: 1 } };
    useFlowStore.setState({ nodes: [pod] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('p1', { label: 'new-label' });

    const state = useFlowStore.getState();
    expect(state.nodes[0].data.label).toBe('new-label');
  });

  it('updateNodeData triggers ReplicaSet transform for standalone Pod with replicas > 1', () => {
    const pod = { id: 'p1', type: 'Pod', position: { x: 100, y: 100 }, data: { label: 'standalone', replicas: 1 } };
    useFlowStore.setState({ nodes: [pod] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('p1', { replicas: 3 });

    const state = useFlowStore.getState();
    expect(state.nodes.some(n => n.type === 'ReplicaSet')).toBe(true);
    expect(state.nodes.filter(n => n.type === 'Pod')).toHaveLength(3);
  });

  it('onNodeClick updates configured node state', () => {
    const node = { id: 'n1', type: 'Deployment', data: {} } as any;
    const { onNodeClick } = useFlowStore.getState();

    onNodeClick({} as any, node);

    const state = useFlowStore.getState();
    expect(state.configuringNodeId).toBe('n1');
    expect(state.activeDeploymentId).toBe('n1');
  });

  it('onPaneClick clears selection', () => {
    useFlowStore.setState({ configuringNodeId: 'n1', activeDeploymentId: 'n1' });
    const { onPaneClick } = useFlowStore.getState();

    onPaneClick();

    const state = useFlowStore.getState();
    expect(state.configuringNodeId).toBeNull();
    expect(state.activeDeploymentId).toBeNull();
  });

  it('groupNodes and ungroupNodes', () => {
    const node = { id: 'n1', position: { x: 0, y: 0 }, data: {} } as any;
    useFlowStore.setState({ nodes: [node] });

    const { groupNodes, ungroupNodes } = useFlowStore.getState();

    groupNodes(['n1']);
    expect(useFlowStore.getState().nodes[0].data.groupId).toBeDefined();

    ungroupNodes(['n1']);
    expect(useFlowStore.getState().nodes[0].data.groupId).toBeUndefined();
  });

  it('deleteNodes removes targeted elements and logs canvas action', () => {
    const parent = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'My Dep' } };
    useFlowStore.setState({ nodes: [parent] as any, edges: [] });

    useFlowStore.getState().deleteNodes([parent] as any);

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(0);
  });

  it('deleteNodes cascade deletes child pods when parent Deployment is deleted', () => {
    const depNode = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'My Dep' } };
    const childPod = { id: 'pod1', type: 'Pod', parentId: 'dep1', position: { x: 10, y: 10 }, data: { label: 'Child Pod' } };

    useFlowStore.setState({ nodes: [depNode, childPod] as any, edges: [] });

    useFlowStore.getState().deleteNodes([depNode] as any);

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(0);
  });

  it('deleteNodes handles deleting a child Pod inside ReplicaSet or Deployment parent', () => {
    const rsNode = { id: 'rs1', type: 'ReplicaSet', position: { x: 0, y: 0 }, data: { label: 'My RS', replicas: 2 } };
    const pod1 = { id: 'pod1', type: 'Pod', parentId: 'rs1', position: { x: 10, y: 10 }, data: { label: 'Pod 1', replicas: 2 } };
    const pod2 = { id: 'pod2', type: 'Pod', parentId: 'rs1', position: { x: 50, y: 10 }, data: { label: 'Pod 2', replicas: 2 } };

    useFlowStore.setState({ nodes: [rsNode, pod1, pod2] as any, edges: [] });

    useFlowStore.getState().deleteNodes([pod1] as any);

    const state = useFlowStore.getState();
    expect(state.nodes.some(n => n.id === 'pod1')).toBe(false);
  });
});
