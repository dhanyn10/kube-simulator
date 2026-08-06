import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';

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

  it('onQuickConnect finds node in direction', () => {
      const source = { id: 's1', position: { x: 0, y: 0 }, width: 100, height: 100, data: {} };
      const target = { id: 't1', position: { x: 200, y: 0 }, width: 100, height: 100, data: {} };
      useFlowStore.setState({ nodes: [source, target] as any });

      const { onQuickConnect } = useFlowStore.getState();
      onQuickConnect('s1', 'right');

      const state = useFlowStore.getState();
      expect(state.edges).toHaveLength(1);
      expect(state.edges[0].target).toBe('t1');
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
      // Verify nodes still exist
      expect(state.nodes).toHaveLength(2);
  });
});
