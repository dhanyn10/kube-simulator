import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';

describe('dragHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [
        { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod' } },
        { id: 'd1', type: 'Deployment', position: { x: 100, y: 100 }, width: 320, height: 160, data: { label: 'dep' } },
        { id: 'd2', type: 'Deployment', position: { x: 120, y: 120 }, width: 300, height: 150, data: { label: 'dep2' } },
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

    // Test non-Deployment start without parentId
    const podNode = { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: {} } as any;
    onNodeDragStart({} as any, podNode);
    expect(useFlowStore.getState().activeDeploymentId).toBeNull();
  });

  it('onNodeDrag updates hover and detachment state across multiple overlapping containers', () => {
    const { onNodeDrag } = useFlowStore.getState();

    // 1. Hovering over two overlapping Deployments (d1 and d2)
    const nodeOverDep = { id: 'n1', type: 'Pod', position: { x: 125, y: 125 }, data: {} } as any;
    onNodeDrag({} as any, nodeOverDep);
    expect(useFlowStore.getState().hoveredDeploymentId).toBeDefined();

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

  it('onNodeDragStop handles detachment from Deployment and generic detachment', () => {
    const { onNodeDragStop } = useFlowStore.getState();
    useFlowStore.setState({
      nodes: [
        { id: 'n1', type: 'Pod', parentId: 'd1', position: { x: 10, y: 10 }, data: { replicas: 1 } },
        { id: 'd1', type: 'Deployment', position: { x: 100, y: 100 }, data: { replicas: 1 } },
        { id: 'svc1', type: 'Service', parentId: 'ns1', position: { x: 10, y: 10 }, data: {} },
        { id: 'ns1', type: 'Namespace', position: { x: 500, y: 500 }, data: {} }
      ] as any,
      detachingDeploymentId: 'd1'
    });

    const node = { id: 'n1', type: 'Pod', parentId: 'd1', position: { x: -50, y: -50 }, data: { replicas: 1 } } as any;
    onNodeDragStop({} as any, node);

    let state = useFlowStore.getState();
    let updatedPod = state.nodes.find(n => n.id === 'n1');
    expect(updatedPod?.parentId).toBeUndefined();

    // Test generic detachment (Service detaching from Namespace)
    useFlowStore.setState({ detachingDeploymentId: 'ns1' });
    const svcNode = { id: 'svc1', type: 'Service', parentId: 'ns1', position: { x: -100, y: -100 }, data: {} } as any;
    onNodeDragStop({} as any, svcNode);

    state = useFlowStore.getState();
    const updatedSvc = state.nodes.find(n => n.id === 'svc1');
    expect(updatedSvc?.parentId).toBeUndefined();
  });

  it('onNodeDragStop handles re-parenting to Namespace and Deployment, and disallowed target fallback', () => {
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

    // Attempt invalid re-parenting (e.g. Namespace into Pod)
    useFlowStore.setState({
      nodes: [
        { id: 'ns2', type: 'Namespace', position: { x: 0, y: 0 }, data: {} },
        { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: {} }
      ] as any,
      hoveredDeploymentId: 'n1'
    });
    const nsNode = { id: 'ns2', type: 'Namespace', position: { x: 0, y: 0 }, data: {} } as any;
    onNodeDragStop({} as any, nsNode);

    state = useFlowStore.getState();
    const updatedNs = state.nodes.find(n => n.id === 'ns2');
    expect(updatedNs?.parentId).toBeUndefined();
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

  it('onNodeDragStop handles move within container and fallback sizing/labels', () => {
    const addLogSpy = vi.fn();
    useFlowStore.setState({
      addLog: addLogSpy,
      nodes: [
        { id: 'n1', type: 'Pod', parentId: 'ns1', position: { x: 10, y: 10 }, data: {} },
        { id: 'ns1', type: 'Namespace', position: { x: 500, y: 500 }, width: 400, height: 400, data: {} }
      ] as any
    });

    const { onNodeDragStop } = useFlowStore.getState();
    const node = { id: 'n1', type: 'Pod', parentId: 'ns1', position: { x: 20, y: 20 }, data: {} } as any;
    onNodeDragStop({} as any, node);

    const state = useFlowStore.getState();
    const updatedPod = state.nodes.find(n => n.id === 'n1');
    expect(updatedPod?.position).toEqual({ x: 20, y: 20 });
    expect(updatedPod?.parentId).toBe('ns1');
    expect(addLogSpy).toHaveBeenCalledWith('info', expect.stringContaining("Moved card 'n1'"), 'UI');
  });
});
