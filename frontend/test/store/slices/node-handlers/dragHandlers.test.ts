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

    // 2. Detaching from a Deployment
    const nodeDetaching = { id: 'n1', type: 'Pod', parentId: 'd1', position: { x: 10, y: 10 }, data: {} } as any;
    onNodeDrag({} as any, nodeDetaching);
  });

  it('onNodeDragStop prevents detaching Role outside of a Namespace', () => {
    const addLogSpy = vi.fn();
    useFlowStore.setState({
      addLog: addLogSpy,
      nodes: [
        { id: 'role1', type: 'Role', parentId: 'ns1', position: { x: 10, y: 10 }, data: {} },
        { id: 'ns1', type: 'Namespace', position: { x: 500, y: 500 }, width: 400, height: 400, data: {} }
      ] as any,
      detachingDeploymentId: 'ns1',
    });

    const { onNodeDragStop } = useFlowStore.getState();
    const roleNode = { id: 'role1', type: 'Role', parentId: 'ns1', position: { x: -100, y: -100 }, data: {} } as any;

    onNodeDragStop({} as any, roleNode);

    expect(addLogSpy).toHaveBeenCalledWith('warn', expect.stringContaining('Cannot detach Role outside of a Namespace'), 'UI');
  });

  it('onNodeDragStop handles detachment from Deployment', () => {
    const { onNodeDragStop } = useFlowStore.getState();
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
  });

  it('onNodeDragStop handles re-parenting to Namespace and Deployment', () => {
    const { onNodeDragStop } = useFlowStore.getState();

    // Re-parent to Namespace
    useFlowStore.setState({ hoveredDeploymentId: 'ns1' });
    const node = { id: 'n1', type: 'Pod', position: { x: 550, y: 550 }, data: {} } as any;
    onNodeDragStop({} as any, node);

    let state = useFlowStore.getState();
    let updatedPod = state.nodes.find(n => n.id === 'n1');
    expect(updatedPod?.parentId).toBe('ns1');

    // Re-parent Pod to Deployment
    useFlowStore.setState({ hoveredDeploymentId: 'd1' });
    onNodeDragStop({} as any, node);

    state = useFlowStore.getState();
    updatedPod = state.nodes.find(n => n.id === 'n1');
    expect(updatedPod?.parentId).toBe('d1');
  });

  it('onNodeDragStop handles internal move inside Deployment', () => {
    const { onNodeDragStop } = useFlowStore.getState();
    useFlowStore.setState({
      nodes: [
        { id: 'n1', type: 'Pod', parentId: 'd1', position: { x: 10, y: 10 }, data: { replicas: 1 } },
        { id: 'd1', type: 'Deployment', position: { x: 100, y: 100 }, width: 320, height: 160, data: { replicas: 1 } }
      ] as any
    });

    const node = { id: 'n1', type: 'Pod', parentId: 'd1', position: { x: 20, y: 20 }, data: { replicas: 1 } } as any;
    onNodeDragStop({} as any, node);

    const state = useFlowStore.getState();
    const updatedPod = state.nodes.find(n => n.id === 'n1');
    expect(updatedPod?.parentId).toBe('d1');
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

  it('onNodeDragStop logs move activity when standalone node is moved', () => {
    const addLogSpy = vi.fn();
    useFlowStore.setState({ addLog: addLogSpy });

    const { onNodeDragStop } = useFlowStore.getState();
    const node = { id: 'n1', type: 'Pod', position: { x: 200, y: 200 }, data: { label: 'pod-1' } } as any;
    onNodeDragStop({} as any, node);

    expect(addLogSpy).toHaveBeenCalledWith('info', expect.stringContaining('[Canvas Action] Moved card'), 'UI');
  });
});
