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

    // 2. Detaching from a Deployment (< 20% overlap sets detachingId on line 55)
    const nodeDetaching = { id: 'n1', type: 'Pod', parentId: 'd1', position: { x: 500, y: 500 }, data: {} } as any;
    onNodeDrag({} as any, nodeDetaching);
    expect(useFlowStore.getState().detachingDeploymentId).toBe('d1');
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

  it('onNodeDragStop handles re-parenting to Namespace, Deployment, and StatefulSet, non-existent target fallback, and disallowed target fallback', () => {
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

    // Re-parent Pod to StatefulSet
    useFlowStore.setState({
      nodes: [
        { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod' } },
        { id: 'ss1', type: 'StatefulSet', position: { x: 100, y: 100 }, width: 320, height: 160, data: { label: 'stateful-db', replicas: 1 } }
      ] as any,
      hoveredDeploymentId: 'ss1'
    });
    onNodeDragStop({} as any, node);

    state = useFlowStore.getState();
    updatedPod = state.nodes.find(n => n.id === 'n1');
    expect(updatedPod?.parentId).toBe('ss1');
    expect(updatedPod?.data?.workloadType).toBe('StatefulSet');

    // Attempt re-parenting with non-existent target ID
    useFlowStore.setState({ hoveredDeploymentId: 'non-existent-target' });
    onNodeDragStop({} as any, node);

    state = useFlowStore.getState();
    updatedPod = state.nodes.find(n => n.id === 'n1');
    expect(updatedPod?.parentId).toBeUndefined();

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

  it('covers remaining branches in dragHandlers: ReplicaSet pod detachment/internal move, hovering over self container, and collision resolution', () => {
    const { onNodeDragStop, onNodeDrag } = useFlowStore.getState();

    // 1. ReplicaSet pod detachment
    useFlowStore.setState({
      nodes: [
        { id: 'pod1', type: 'Pod', parentId: 'rs1', position: { x: 10, y: 10 }, data: { replicas: 1 } },
        { id: 'rs1', type: 'ReplicaSet', position: { x: 100, y: 100 }, width: 300, height: 150, data: { replicas: 1 } }
      ] as any,
      detachingDeploymentId: 'rs1'
    });

    const rsPodNode = { id: 'pod1', type: 'Pod', parentId: 'rs1', position: { x: -100, y: -100 }, data: { replicas: 1 } } as any;
    onNodeDragStop({} as any, rsPodNode);

    let state = useFlowStore.getState();
    let detachedPod = state.nodes.find(n => n.id === 'pod1');
    expect(detachedPod?.parentId).toBeUndefined();

    // 2. ReplicaSet internal pod move
    useFlowStore.setState({
      nodes: [
        { id: 'pod1', type: 'Pod', parentId: 'rs1', position: { x: 10, y: 10 }, data: { replicas: 1 } },
        { id: 'rs1', type: 'ReplicaSet', position: { x: 100, y: 100 }, width: 300, height: 150, data: { replicas: 1 } }
      ] as any,
      detachingDeploymentId: null,
      hoveredDeploymentId: null
    });
    onNodeDragStop({} as any, { id: 'pod1', type: 'Pod', parentId: 'rs1', position: { x: 15, y: 15 }, data: { replicas: 1 } } as any);
    state = useFlowStore.getState();
    expect(state.nodes.find(n => n.id === 'pod1')?.parentId).toBe('rs1');

    // 3. Dragging a Deployment over itself (container.id === node.id in findHoveredContainer)
    useFlowStore.setState({
      nodes: [
        { id: 'd1', type: 'Deployment', position: { x: 100, y: 100 }, width: 320, height: 160, data: { label: 'dep' } }
      ] as any
    });
    onNodeDrag({} as any, { id: 'd1', type: 'Deployment', position: { x: 105, y: 105 }, width: 320, height: 160, data: {} } as any);
    expect(useFlowStore.getState().hoveredDeploymentId).toBeNull();

    // 4. Standalone node drag stop without parent, hover, or detachment (global collision resolution & fallback dimensions)
    const standaloneNode = { id: 'svc2', type: 'Service', position: { x: 0, y: 0 }, measured: { width: 120, height: 60 }, data: {} } as any;
    useFlowStore.setState({ nodes: [standaloneNode] as any });
    onNodeDragStop({} as any, standaloneNode);
    expect(useFlowStore.getState().draggedNodeId).toBeNull();
  });

  it('covers forbidden node access in onNodeDragStart, onNodeDrag, and onNodeDragStop', () => {
    const { onNodeDragStart, onNodeDrag, onNodeDragStop } = useFlowStore.getState();

    useFlowStore.setState({
      activeIdentity: 'dev-user',
      iamUsers: [
        { username: 'dev-user', role: 'ContainerDeveloper', policies: ['ContainerDeveloperPolicy'] }
      ] as any,
      nodes: [
        { id: 'svc1', type: 'Service', position: { x: 0, y: 0 }, data: {} }
      ] as any
    });

    const forbiddenNode = { id: 'svc1', type: 'Service', position: { x: 0, y: 0 }, data: {} } as any;

    onNodeDragStart({} as any, forbiddenNode);
    expect(useFlowStore.getState().draggedNodeId).toBeNull();

    onNodeDrag({} as any, forbiddenNode);
    expect(useFlowStore.getState().hoveredDeploymentId).toBeNull();

    onNodeDragStop({} as any, forbiddenNode);
    expect(useFlowStore.getState().draggedNodeId).toBeNull();
  });

  it('covers applyNewParent when target container node does not exist or relationship is disallowed', () => {
    const { onNodeDragStop } = useFlowStore.getState();

    // Hovered target node does not exist in nextNodes
    useFlowStore.setState({
      nodes: [{ id: 'pod1', type: 'Pod', position: { x: 10, y: 10 }, data: {} }] as any,
      hoveredDeploymentId: 'ghost-container'
    });

    const podNode = { id: 'pod1', type: 'Pod', position: { x: 10, y: 10 }, data: {} } as any;
    onNodeDragStop({} as any, podNode);

    let state = useFlowStore.getState();
    expect(state.nodes.find(n => n.id === 'pod1')?.parentId).toBeUndefined();

    // Hovered target container is not allowed (e.g. dragging Namespace onto Pod)
    useFlowStore.setState({
      nodes: [
        { id: 'pod1', type: 'Pod', position: { x: 10, y: 10 }, data: {} },
        { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} }
      ] as any,
      hoveredDeploymentId: 'pod1'
    });

    const nsNode = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} } as any;
    onNodeDragStop({} as any, nsNode);

    state = useFlowStore.getState();
    expect(state.nodes.find(n => n.id === 'ns1')?.parentId).toBeUndefined();
  });

  it('covers fallback branches across drag handlers', () => {
    const { onNodeDragStart, onNodeDrag, onNodeDragStop } = useFlowStore.getState();

    // 1. iamUsers is undefined in store (Branches 42, 48, 52)
    useFlowStore.setState({
      iamUsers: undefined as any,
      activeIdentity: null,
      nodes: [
        { id: 'c1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} }, // no width/height (Branches 7, 8)
        { id: 'c2', type: 'Deployment', position: { x: 200, y: 200 }, data: {} }, // no width/height (Branches 9, 10)
        { id: 'other-node', type: 'Service', position: { x: 900, y: 900 }, data: {} },
        { id: 'child-pod', type: 'Pod', parentId: 'c1', position: { x: 50, y: 50 }, data: {} }, // no replicas (Branch 24)
        { id: 'typeless-node', position: { x: 50, y: 50 }, data: {} } as any, // no type (Branches 4, 5, 17, 18)
      ],
      hoveredDeploymentId: null,
      detachingDeploymentId: null,
    });

    const childPod = useFlowStore.getState().nodes.find(n => n.id === 'child-pod')!;

    // 2. onNodeDragStart with iamUsers undefined
    onNodeDragStart({} as any, childPod);
    expect(useFlowStore.getState().draggedNodeId).toBe('child-pod');

    // 3. onNodeDrag with node overlapping its parent > 20% (Branch 1 returns 'hovering') and containers without dimensions
    onNodeDrag({} as any, childPod);

    // 4. onNodeDrag with typeless node (Branches 4, 5)
    const typelessNode = useFlowStore.getState().nodes.find(n => n.id === 'typeless-node')!;
    onNodeDrag({} as any, typelessNode);

    // 5. onNodeDragStop with internal move having other-node in canvas (Branch 34)
    onNodeDragStop({} as any, childPod);

    // 6. onNodeDragStop detaching pod with missing replicas (Branch 24: fallback to 1)
    useFlowStore.setState({ detachingDeploymentId: 'c1' });
    onNodeDragStop({} as any, { ...childPod, position: { x: -200, y: -200 } });

    // 7. onNodeDragStop with hovered target container lacking type (Branches 17, 18)
    useFlowStore.setState({
      nodes: [
        { id: 'typeless-target', position: { x: 0, y: 0 }, data: {} },
        { id: 'typeless-dragged', position: { x: 10, y: 10 }, data: {} },
      ] as any,
      hoveredDeploymentId: 'typeless-target',
    });
    onNodeDragStop({} as any, { id: 'typeless-dragged', position: { x: 10, y: 10 }, data: {} } as any);

    // 8. container whose type returns undefined after filter (Branch 4)
    let accessed = false;
    const dynamicContainer = {
      id: 'dynamic-dep',
      get type() {
        if (!accessed) {
          accessed = true;
          return 'Deployment';
        }
        return undefined;
      },
      position: { x: 0, y: 0 },
      width: 320,
      height: 160,
      data: {},
    };
    useFlowStore.setState({
      nodes: [
        dynamicContainer as any,
        { id: 'p-dyn', type: 'Pod', position: { x: 10, y: 10 }, data: {} },
      ],
      hoveredDeploymentId: null,
      detachingDeploymentId: null,
    });
    onNodeDrag({} as any, { id: 'p-dyn', type: 'Pod', position: { x: 10, y: 10 }, data: {} } as any);
  });
});
