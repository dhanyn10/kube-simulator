import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';
import { Node, Edge } from '@xyflow/react';

describe('createFlowSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      lastActionId: 'init'
    });
  });

  it('onNodesChange updates positions of grouped nodes', () => {
    const node1 = { id: 'n1', position: { x: 0, y: 0 }, data: { groupId: 'g1' } };
    const node2 = { id: 'n2', position: { x: 50, y: 50 }, data: { groupId: 'g1' } };
    useFlowStore.setState({ nodes: [node1, node2] as any });

    const { onNodesChange } = useFlowStore.getState();
    onNodesChange([{ id: 'n1', type: 'position', position: { x: 10, y: 10 } }]);

    const state = useFlowStore.getState();
    const n1 = state.nodes.find(n => n.id === 'n1');
    const n2 = state.nodes.find(n => n.id === 'n2');

    expect(n1?.position).toEqual({ x: 10, y: 10 });
    expect(n2?.position).toEqual({ x: 60, y: 60 });
  });

  it('syncRoleRulesFromConnections syncs rules when Role is connected to ReplicaSet and other workloads', () => {
    const roleNode: Node = { id: 'role1', type: 'Role', position: { x: 0, y: 0 }, data: { rules: [{ apiGroups: [''], resources: [], verbs: ['get'] }] } };
    const rsNode: Node = { id: 'rs1', type: 'ReplicaSet', position: { x: 100, y: 0 }, data: { label: 'my-rs' } };
    const edge: Edge = { id: 'e1', source: 'role1', target: 'rs1' };

    useFlowStore.setState({ nodes: [roleNode, rsNode], edges: [] });

    const { setEdges } = useFlowStore.getState();
    setEdges([edge]);

    const state = useFlowStore.getState();
    const updatedRole = state.nodes.find(n => n.id === 'role1');
    expect(updatedRole?.data.rules[0].resources).toContain('replicasets');
  });

  it('onConnect validates edges and handles HPA auto-config', () => {
    const hpa = { id: 'h1', type: 'HPA', data: {} };
    const dep = { id: 'd1', type: 'Deployment', data: { label: 'dep' } };
    useFlowStore.setState({ nodes: [hpa, dep] as any });

    const { onConnect } = useFlowStore.getState();
    onConnect({ source: 'h1', target: 'd1' });

    const state = useFlowStore.getState();
    expect(state.edges).toHaveLength(1);

    const updatedDep = state.nodes.find(n => n.id === 'd1');
    expect(updatedDep?.data.cpuRequest).toBe('100m');
    expect(updatedDep?.data.memoryRequest).toBe('128Mi');
  });

  it('validateEdge flags invalid connections', () => {
    const internet = { id: 'i1', type: 'Internet', data: {} };
    const pvc = { id: 'p1', type: 'PVC', data: {} };
    useFlowStore.setState({ nodes: [internet, pvc] as any });

    const { validateEdge } = useFlowStore.getState();
    const edge = { id: 'e1', source: 'i1', target: 'p1' };
    const validated = validateEdge(edge as any);

    expect(validated.data.validationError).toBeDefined();
  });

  it('onReconnect re-routes an existing edge', () => {
    const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' };
    useFlowStore.setState({ edges: [edge] });

    useFlowStore.getState().onReconnect(edge, {
      source: 'n1',
      target: 'n3',
      sourceHandle: 'right',
      targetHandle: 'left',
    });

    const edges = useFlowStore.getState().edges;
    expect(edges[0].target).toBe('n3');
  });

  it('onQuickConnect connects nodes in orthogonal directions (right, left, top, bottom)', () => {
    const centerNode: Node = {
      id: 'center',
      type: 'Service',
      position: { x: 100, y: 100 },
      data: { label: 'center' },
    };
    const rightNode: Node = {
      id: 'rightN',
      type: 'Pod',
      position: { x: 300, y: 100 },
      data: { label: 'right' },
    };
    const leftNode: Node = {
      id: 'leftN',
      type: 'Pod',
      position: { x: -100, y: 100 },
      data: { label: 'left' },
    };
    const topNode: Node = {
      id: 'topN',
      type: 'Pod',
      position: { x: 100, y: -100 },
      data: { label: 'top' },
    };
    const bottomNode: Node = {
      id: 'bottomN',
      type: 'Pod',
      position: { x: 100, y: 300 },
      data: { label: 'bottom' },
    };

    useFlowStore.setState({
      nodes: [centerNode, rightNode, leftNode, topNode, bottomNode],
    });

    useFlowStore.getState().onQuickConnect('center', 'right');
    expect(useFlowStore.getState().edges.some((e) => e.target === 'rightN')).toBe(true);

    useFlowStore.getState().onQuickConnect('center', 'left');
    expect(useFlowStore.getState().edges.some((e) => e.target === 'leftN')).toBe(true);

    useFlowStore.getState().onQuickConnect('center', 'top');
    expect(useFlowStore.getState().edges.some((e) => e.target === 'topN')).toBe(true);

    useFlowStore.getState().onQuickConnect('center', 'bottom');
    expect(useFlowStore.getState().edges.some((e) => e.target === 'bottomN')).toBe(true);
  });

  it('autoLayout triggers dagre layout', () => {
    const node1 = { id: 'n1', position: { x: 0, y: 0 }, width: 100, height: 100, data: {} };
    const node2 = { id: 'n2', position: { x: 0, y: 0 }, width: 100, height: 100, data: {} };
    const edge = { id: 'e1', source: 'n1', target: 'n2' };
    useFlowStore.setState({ nodes: [node1, node2] as any, edges: [edge] as any });

    const { autoLayout } = useFlowStore.getState();
    autoLayout();

    const state = useFlowStore.getState();
    expect(state.lastActionName).toBe('Auto Layout');
    expect(state.lastActionId).toContain('layout-');
    expect(state.nodes).toHaveLength(2);
  });
});
