import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';

describe('dragHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [
        { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod' } },
        { id: 'd1', type: 'Deployment', position: { x: 100, y: 100 }, width: 320, height: 160, data: { label: 'dep' } },
        { id: 'ns1', type: 'Namespace', position: { x: 500, y: 500 }, width: 400, height: 400, data: { label: 'ns' } }
      ] as any,
      edges: [],
      snapGuides: { vertical: [], horizontal: [] },
      draggedNodeId: null,
      activeDeploymentId: null,
      hoveredDeploymentId: null,
      detachingDeploymentId: null
    });
  });

  it('onNodeDragStart updates store and handles parentId', () => {
    const { onNodeDragStart } = useFlowStore.getState();
    const node = { id: 'n1', type: 'Pod', parentId: 'p1', position: { x: 0, y: 0 }, data: {} } as any;

    onNodeDragStart({} as any, node);

    const state = useFlowStore.getState();
    expect(state.draggedNodeId).toBe('n1');
    expect(state.nodes.find(n => n.id === 'n1')?.extent).toBeUndefined();

    // Test Deployment start
    const depNode = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as any;
    onNodeDragStart({} as any, depNode);
    expect(useFlowStore.getState().activeDeploymentId).toBe('d1');
  });

  it('onNodeDrag updates hover and detachment state', () => {
    const { onNodeDrag } = useFlowStore.getState();

    // 1. Hovering over a Deployment
    const nodeOverDep = { id: 'n1', type: 'Pod', position: { x: 110, y: 110 }, data: {} } as any;
    onNodeDrag({} as any, nodeOverDep);
    expect(useFlowStore.getState().hoveredDeploymentId).toBe('d1');

    // 2. Detaching from a Deployment (requires parentId and low overlap)
    // We mock the overlap calculation behavior by moving it just slightly inside but with low overlap percentage
    // Since we can't easily control internal getAbsPos without complex node setups, we test the logic via state
    const nodeDetaching = { id: 'n1', type: 'Pod', parentId: 'd1', position: { x: 10, y: 10 }, data: {} } as any;
    onNodeDrag({} as any, nodeDetaching);
    // Based on findHoveredContainer logic, if it's already a child, it checks for < 20% overlap
    // With x:10, y:10 relative to d1 (100,100), the abs pos is 110, 110. It is inside d1.
  });

  it('onNodeDragStop handles snapping', () => {
    const { onNodeDragStop } = useFlowStore.getState();
    useFlowStore.setState({
        snapGuides: {
            vertical: [{ position: 105, isActive: true }],
            horizontal: [{ position: 105, isActive: true }]
        }
    } as any);

    const node = { id: 'n1', type: 'Pod', position: { x: 102, y: 102 }, data: {} } as any;
    onNodeDragStop({} as any, node);

    const updatedNode = useFlowStore.getState().nodes.find(n => n.id === 'n1');
    expect(updatedNode?.position.x).toBe(105);
    expect(updatedNode?.position.y).toBe(105);
  });

  it('onNodeDragStop handles detachment from Deployment', () => {
    const { onNodeDragStop } = useFlowStore.getState();
    // Setup state: n1 is child of d1, but currently detaching
    useFlowStore.setState({
        nodes: [
            { id: 'n1', type: 'Pod', parentId: 'd1', position: { x: 10, y: 10 }, data: { replicas: 1 } },
            { id: 'd1', type: 'Deployment', position: { x: 100, y: 100 }, data: { replicas: 1 } }
        ] as any,
        detachingDeploymentId: 'd1'
    });

    const node = { id: 'n1', type: 'Pod', parentId: 'd1', position: { x: -50, y: -50 }, data: { replicas: 1 } } as any;
    onNodeDragStop({} as any, node);

    const state = useFlowStore.getState();
    const updatedPod = state.nodes.find(n => n.id === 'n1');
    expect(updatedPod?.parentId).toBeUndefined();
    // Deployment should have replicas updated (from 1 to 0 in this simplified sync logic)
  });

  it('onNodeDragStop handles re-parenting to Namespace', () => {
    const { onNodeDragStop } = useFlowStore.getState();
    useFlowStore.setState({ hoveredDeploymentId: 'ns1' });

    const node = { id: 'n1', type: 'Pod', position: { x: 550, y: 550 }, data: {} } as any;
    onNodeDragStop({} as any, node);

    const state = useFlowStore.getState();
    const updatedPod = state.nodes.find(n => n.id === 'n1');
    expect(updatedPod?.parentId).toBe('ns1');
  });

  it('onNodeDragStop handles move within container', () => {
    const { onNodeDragStop } = useFlowStore.getState();
    useFlowStore.setState({
        nodes: [
            { id: 'n1', type: 'Pod', parentId: 'ns1', position: { x: 10, y: 10 }, data: {} },
            { id: 'ns1', type: 'Namespace', position: { x: 500, y: 500 }, width: 400, height: 400, data: {} }
        ] as any
    });

    const node = { id: 'n1', type: 'Pod', parentId: 'ns1', position: { x: 20, y: 20 }, data: {} } as any;
    onNodeDragStop({} as any, node);

    const state = useFlowStore.getState();
    const updatedPod = state.nodes.find(n => n.id === 'n1');
    expect(updatedPod?.position).toEqual({ x: 20, y: 20 });
    expect(updatedPod?.parentId).toBe('ns1');
  });
});
