import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';

describe('nodeActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      lastActionId: 'init'
    });
  });

  it('addNode adds a new node and resolves collisions', () => {
    const { addNode } = useFlowStore.getState();

    addNode('Pod', { x: 100, y: 100 });

    const state = useFlowStore.getState();
    expect(state.nodes.length).toBe(1);
    expect(state.nodes[0].type).toBe('Pod');
    expect(state.lastActionName).toBe('Add Pod');
  });

  it('deleteNodes removes nodes and connected edges', () => {
    const node1 = { id: 'n1', position: { x: 0, y: 0 }, data: {} };
    const node2 = { id: 'n2', position: { x: 0, y: 0 }, data: {} };
    const edge = { id: 'e1', source: 'n1', target: 'n2' };

    useFlowStore.setState({ nodes: [node1, node2] as any, edges: [edge] as any });

    const { deleteNodes } = useFlowStore.getState();
    deleteNodes([node1] as any);

    const state = useFlowStore.getState();
    expect(state.nodes.length).toBe(1);
    expect(state.nodes[0].id).toBe('n2');
    expect(state.edges.length).toBe(0);
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
      // Should find a ReplicaSet and Pods
      expect(state.nodes.some(n => n.type === 'ReplicaSet')).toBe(true);
      expect(state.nodes.filter(n => n.type === 'Pod').length).toBe(3);
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
});
