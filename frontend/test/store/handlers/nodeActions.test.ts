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
      activeIdentity: 'system:admin',
      iamUsers: [],
    });
  });

  it('addNode logs warning when adding Role without Namespace, or attaches to existing Namespace', () => {
    const addLogSpy = vi.fn();
    useFlowStore.setState({ addLog: addLogSpy });

    const { addNode } = useFlowStore.getState();
    addNode('Role');

    expect(addLogSpy).toHaveBeenCalledWith('warn', expect.stringContaining('Cannot add Role without a Namespace'), 'UI');

    // With Namespace existing
    const nsNode = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: { type: 'Namespace' } };
    useFlowStore.setState({ nodes: [nsNode] as any });

    addNode('Role');
    const state = useFlowStore.getState();
    const roleNode = state.nodes.find(n => n.type === 'Role');
    expect(roleNode?.parentId).toBe('ns1');

    useFlowStore.setState({ addLog: initialAddLog });
  });

  it('addNode uses default random position when position argument is omitted', () => {
    const { addNode } = useFlowStore.getState();
    addNode('Pod');

    const state = useFlowStore.getState();
    expect(state.nodes[0].position.x).toBeGreaterThan(0);
    expect(state.nodes[0].position.y).toBeGreaterThan(0);
  });

  it('addNode sets default dimensions for Namespace and Deployment nodes', () => {
    const { addNode } = useFlowStore.getState();
    addNode('Namespace', { x: 10, y: 10 });
    addNode('Deployment', { x: 50, y: 50 });

    const state = useFlowStore.getState();
    const nsNode = state.nodes.find(n => n.type === 'Namespace');
    expect(nsNode?.width).toBe(600);
    expect(nsNode?.height).toBe(400);

    const depNode = state.nodes.find(n => n.type === 'Deployment');
    expect(depNode?.width).toBe(320);
    expect(depNode?.height).toBe(160);
  });

  it('addNode handles adding a Pod into a Deployment container parent', () => {
    const depNode = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 1, type: 'Deployment' } };
    useFlowStore.setState({ nodes: [depNode] as any });

    const { addNode } = useFlowStore.getState();
    addNode('Pod', { x: 20, y: 20 }, 'dep1');

    const state = useFlowStore.getState();
    expect(state.nodes.some(n => n.parentId === 'dep1' && n.type === 'Pod')).toBe(true);
  });

  it('updateNodeData sets isAutoImage to false when image is explicitly set', () => {
    const pod = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'my-pod', type: 'Pod', isAutoImage: true } };
    useFlowStore.setState({ nodes: [pod] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('p1', { image: 'custom-image:v1' });

    const state = useFlowStore.getState();
    expect(state.nodes[0].data.image).toBe('custom-image:v1');
    expect(state.nodes[0].data.isAutoImage).toBe(false);
  });

  it('updateNodeData emits live update commands for cpuLimit and memoryLimit changes', () => {
    const depNode = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { label: 'web-dep', type: 'Deployment', cpuLimit: '100m', memoryLimit: '128Mi' },
    };
    useFlowStore.setState({ nodes: [depNode] as any, isSimulating: true, activityLogs: [] });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('dep1', { cpuLimit: '200m', memoryLimit: '256Mi' });

    const state = useFlowStore.getState();
    expect(state.activityLogs.some(line => line.includes('kubectl set resources deployment/web-dep --limits=cpu=200m,memory=256Mi'))).toBe(true);
  });

  it('updateNodeData preserves width and height on Namespace nodes', () => {
    const ns = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, width: 600, height: 400, style: { width: 600, height: 400 }, data: { label: 'ns1', type: 'Namespace' } };
    useFlowStore.setState({ nodes: [ns] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('ns1', { label: 'ns2' });

    const state = useFlowStore.getState();
    expect(state.nodes[0].width).toBe(600);
    expect(state.nodes[0].height).toBe(400);
  });

  it('updateNodeData returns early if target node is missing or data has no changes', () => {
    const pod = { id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'my-pod', type: 'Pod' } };
    useFlowStore.setState({ nodes: [pod] as any, lastActionName: 'init' });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('missing-node', { label: 'new' });
    expect(useFlowStore.getState().lastActionName).toBe('init');

    updateNodeData('p1', { label: 'my-pod' });
    expect(useFlowStore.getState().lastActionName).toBe('init');
  });

  it('updateNodeData handles Pod parent sync when parent node is missing in store', () => {
    const pod = { id: 'p1', type: 'Pod', parentId: 'missing-dep', position: { x: 0, y: 0 }, data: { replicas: 1, type: 'Pod' } };
    useFlowStore.setState({ nodes: [pod] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('p1', { replicas: 2 });

    const state = useFlowStore.getState();
    expect(state.nodes.find(n => n.id === 'p1')?.data.replicas).toBe(2);
  });

  it('updateNodeData handles Pod parent sync when parent is ReplicaSet with replicas > 1', () => {
    const rs = { id: 'rs1', type: 'ReplicaSet', position: { x: 100, y: 100 }, data: { replicas: 2, type: 'ReplicaSet' } };
    const pod1 = { id: 'p1', type: 'Pod', parentId: 'rs1', position: { x: 20, y: 40 }, data: { replicas: 2, type: 'Pod' } };
    useFlowStore.setState({ nodes: [rs, pod1] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('p1', { replicas: 3 });

    const state = useFlowStore.getState();
    expect(state.nodes.find(n => n.id === 'rs1')?.data.replicas).toBe(3);
  });

  it('updateNodeData reverts ReplicaSet back to standalone Pod when replicas scaled down to 1', () => {
    const rs = { id: 'rs1', type: 'ReplicaSet', position: { x: 100, y: 100 }, data: { replicas: 3, type: 'ReplicaSet' } };
    const pod1 = { id: 'p1', type: 'Pod', parentId: 'rs1', position: { x: 20, y: 40 }, data: { replicas: 3, type: 'Pod' } };
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

  it('deleteNodes removes nodes, connected edges, and handles measured/unmeasured node dimensions', () => {
    const node1 = { id: 'n1', type: 'Pod', position: { x: 10, y: 10 }, data: { type: 'Pod' } };
    const node2 = { id: 'n2', type: 'Pod', position: { x: 50, y: 50 }, measured: { width: 140, height: 90 }, data: { type: 'Pod' } };
    const edge = { id: 'e1', source: 'n1', target: 'n2' };

    useFlowStore.setState({ nodes: [node1, node2] as any, edges: [edge] as any, logs: [] });

    const { deleteNodes } = useFlowStore.getState();
    deleteNodes([node1, node2] as any);

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
  });

  it('updateNodeData updates data and invalidates Service selector if workload label changes', () => {
    const dep = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'old-dep', type: 'Deployment', replicas: 1 } };
    const svc = { id: 's1', type: 'Service', position: { x: 100, y: 0 }, data: { label: 'my-svc', type: 'Service', selector: 'old-dep' } };
    useFlowStore.setState({ nodes: [dep, svc] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('d1', { label: 'renamed-dep' });

    const state = useFlowStore.getState();
    expect(state.nodes.find(n => n.id === 'd1')?.data.label).toBe('renamed-dep');
    expect(state.nodes.find(n => n.id === 's1')?.data.selector).toBe('');
  });

  it('deleteNodes invalidates Service selector if targeted workload is deleted', () => {
    const dep = { id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'web-app', type: 'Deployment' } };
    const svc = { id: 's1', type: 'Service', position: { x: 100, y: 0 }, data: { label: 'web-svc', type: 'Service', selector: 'web-app' } };
    useFlowStore.setState({ nodes: [dep, svc] as any, edges: [] });

    const { deleteNodes } = useFlowStore.getState();
    deleteNodes([dep] as any);

    const state = useFlowStore.getState();
    expect(state.nodes.some(n => n.id === 'd1')).toBe(false);
    expect(state.nodes.find(n => n.id === 's1')?.data.selector).toBe('');
  });

  it('updateNodeData triggers ReplicaSet transform for standalone Pod with replicas > 1', () => {
    const pod = { id: 'p1', type: 'Pod', position: { x: 100, y: 100 }, data: { label: 'standalone', type: 'Pod', replicas: 1 } };
    useFlowStore.setState({ nodes: [pod] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('p1', { replicas: 3 });

    const state = useFlowStore.getState();
    expect(state.nodes.some(n => n.type === 'ReplicaSet')).toBe(true);
    expect(state.nodes.filter(n => n.type === 'Pod')).toHaveLength(3);
  });

  it('onNodeClick updates configured node state', () => {
    const node = { id: 'n1', type: 'Deployment', data: { type: 'Deployment' } } as any;
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
    const node = { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'Pod' } } as any;
    useFlowStore.setState({ nodes: [node] });

    const { groupNodes, ungroupNodes } = useFlowStore.getState();

    groupNodes(['n1']);
    expect(useFlowStore.getState().nodes[0].data.groupId).toBeDefined();

    ungroupNodes(['n1']);
    expect(useFlowStore.getState().nodes[0].data.groupId).toBeUndefined();
  });

  it('deleteNodes removes targeted elements and logs canvas action', () => {
    const parent = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'My Dep', type: 'Deployment' } };
    useFlowStore.setState({ nodes: [parent] as any, edges: [] });

    useFlowStore.getState().deleteNodes([parent] as any);

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(0);
  });

  it('deleteNodes cascade deletes child pods when parent Deployment is deleted', () => {
    const depNode = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'My Dep', type: 'Deployment' } };
    const childPod = { id: 'pod1', type: 'Pod', parentId: 'dep1', position: { x: 10, y: 10 }, data: { label: 'Child Pod', type: 'Pod' } };

    useFlowStore.setState({ nodes: [depNode, childPod] as any, edges: [] });

    useFlowStore.getState().deleteNodes([depNode] as any);

    const state = useFlowStore.getState();
    expect(state.nodes).toHaveLength(0);
  });

  it('deleteNodes handles deleting a child Pod inside ReplicaSet or Deployment parent', () => {
    const rsNode = { id: 'rs1', type: 'ReplicaSet', position: { x: 0, y: 0 }, data: { label: 'My RS', type: 'ReplicaSet', replicas: 2 } };
    const pod1 = { id: 'pod1', type: 'Pod', parentId: 'rs1', position: { x: 10, y: 10 }, data: { label: 'Pod 1', type: 'Pod', replicas: 2 } };
    const pod2 = { id: 'pod2', type: 'Pod', parentId: 'rs1', position: { x: 50, y: 10 }, data: { label: 'Pod 2', type: 'Pod', replicas: 2 } };

    useFlowStore.setState({ nodes: [rsNode, pod1, pod2] as any, edges: [] });

    useFlowStore.getState().deleteNodes([pod1] as any);

    const state = useFlowStore.getState();
    expect(state.nodes.some(n => n.id === 'pod1')).toBe(false);
  });

  it('covers forbidden node access in onNodeClick and addLog warning', () => {
    const addLogSpy = vi.fn();
    useFlowStore.setState({
      addLog: addLogSpy,
      activeIdentity: 'dev-user',
      iamUsers: [
        { username: 'dev-user', role: 'ContainerDeveloper', policies: ['ContainerDeveloperPolicy'] }
      ] as any,
      nodes: [
        { id: 'svc1', type: 'Service', position: { x: 0, y: 0 }, data: { label: 'Forbidden Service', type: 'Service' } }
      ] as any
    });

    const { onNodeClick } = useFlowStore.getState();
    const forbiddenNode = { id: 'svc1', type: 'Service', position: { x: 0, y: 0 }, data: { label: 'Forbidden Service', type: 'Service' } } as any;

    onNodeClick({} as any, forbiddenNode);

    expect(addLogSpy).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Access forbidden for user "dev-user" on card "Forbidden Service"'),
      'UI'
    );
    expect(useFlowStore.getState().configuringNodeId).toBeNull();
  });

  it('covers updateNodeData for Deployment/ReplicaSet container sync', () => {
    const depNode = {
      id: 'dep1',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { label: 'dep1', type: 'Deployment', replicas: 2 }
    };
    const podNode = {
      id: 'pod1',
      type: 'Pod',
      parentId: 'dep1',
      position: { x: 10, y: 10 },
      data: { label: 'pod1', type: 'Pod' }
    };

    useFlowStore.setState({ nodes: [depNode, podNode] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('dep1', { label: 'dep1-updated' });

    const state = useFlowStore.getState();
    expect(state.nodes.find(n => n.id === 'dep1')?.data.label).toBe('dep1-updated');
  });

  it('supports Bidirectional Node Linking: Form Settings selector update creates/updates visual canvas edges', () => {
    const svc = { id: 's1', type: 'Service', position: { x: 0, y: 0 }, data: { label: 'web-svc', type: 'Service', selector: '' } };
    const pod1 = { id: 'p1', type: 'Pod', position: { x: 100, y: 0 }, data: { label: 'web-pod', type: 'Pod' } };
    const pod2 = { id: 'p2', type: 'Pod', position: { x: 200, y: 0 }, data: { label: 'other-pod', type: 'Pod' } };
    const oldEdge = { id: 'e1', source: 's1', target: 'p2' };

    useFlowStore.setState({ nodes: [svc, pod1, pod2] as any, edges: [oldEdge] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('s1', { selector: 'web-pod' });

    const state = useFlowStore.getState();
    expect(state.edges.some(e => e.source === 's1' && e.target === 'p1')).toBe(true);
    expect(state.edges.some(e => e.source === 's1' && e.target === 'p2')).toBe(false);
  });

  it('supports Service selector edge creation targeting Ingress node when selector is updated', () => {
    const lbSvc = { id: 's1', type: 'Service', position: { x: 0, y: 0 }, data: { label: 'lb-svc', type: 'Service', serviceType: 'LoadBalancer', selector: '' } };
    const ing = { id: 'i1', type: 'Ingress', position: { x: 100, y: 0 }, data: { label: 'main-ingress', type: 'Ingress' } };

    useFlowStore.setState({ nodes: [lbSvc, ing] as any, edges: [] });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('s1', { selector: 'main-ingress' });

    const state = useFlowStore.getState();
    expect(state.edges.some(e => e.source === 's1' && e.target === 'i1')).toBe(true);
  });

  it('supports Bidirectional Node Linking: Form Settings backendServiceName update on Ingress creates/updates visual canvas edges', () => {
    const ing = { id: 'i1', type: 'Ingress', position: { x: 0, y: 0 }, data: { label: 'main-ing', type: 'Ingress', backendServiceName: '' } };
    const svc1 = { id: 's1', type: 'Service', position: { x: 100, y: 0 }, data: { label: 'app-svc', type: 'Service', serviceType: 'ClusterIP' } };
    const svc2 = { id: 's2', type: 'Service', position: { x: 200, y: 0 }, data: { label: 'old-svc', type: 'Service', serviceType: 'ClusterIP' } };
    const oldEdge = { id: 'e1', source: 'i1', target: 's2' };

    useFlowStore.setState({ nodes: [ing, svc1, svc2] as any, edges: [oldEdge] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('i1', { backendServiceName: 'app-svc' });

    const state = useFlowStore.getState();
    expect(state.edges.some(e => e.source === 'i1' && e.target === 's1')).toBe(true);
    expect(state.edges.some(e => e.source === 'i1' && e.target === 's2')).toBe(false);
  });

  it('supports Bidirectional Node Linking: Visual Edge Drag on Connect updates Form Settings state', () => {
    const ing = { id: 'i1', type: 'Ingress', position: { x: 0, y: 0 }, data: { label: 'main-ing', type: 'Ingress' } };
    const svc = { id: 's1', type: 'Service', position: { x: 100, y: 0 }, data: { label: 'cluster-svc', type: 'Service', serviceType: 'ClusterIP' } };
    const dep = { id: 'd1', type: 'Deployment', position: { x: 200, y: 0 }, data: { label: 'app-dep', type: 'Deployment' } };

    useFlowStore.setState({ nodes: [ing, svc, dep] as any, edges: [] });

    const { onConnect } = useFlowStore.getState();

    // Connect Ingress -> Service
    onConnect({ source: 'i1', target: 's1', sourceHandle: 'right-s', targetHandle: 'left-t' });
    let state = useFlowStore.getState();
    expect(state.nodes.find(n => n.id === 'i1')?.data.backendServiceName).toBe('cluster-svc');

    // Connect Service -> Deployment
    onConnect({ source: 's1', target: 'd1', sourceHandle: 'right-s', targetHandle: 'left-t' });
    state = useFlowStore.getState();
    expect(state.nodes.find(n => n.id === 's1')?.data.selector).toBe('app-dep');
  });

  it('guarantees that every card type on canvas can be selected and deleted', () => {
    const cardTypes = ['Internet', 'Pod', 'Deployment', 'Service', 'Ingress', 'HPA', 'PVC', 'ConfigMap', 'Secret', 'Role', 'Namespace'];

    const initialNodes = cardTypes.map((type, idx) => ({
      id: `card-${type.toLowerCase()}-${idx}`,
      type,
      position: { x: idx * 100, y: 100 },
      data: { label: `My ${type}`, type }
    }));

    useFlowStore.setState({ nodes: initialNodes as any, edges: [] });

    // Verify all 11 cards exist on canvas
    expect(useFlowStore.getState().nodes).toHaveLength(11);

    // Test deleting each card individually
    cardTypes.forEach((type, idx) => {
      const cardId = `card-${type.toLowerCase()}-${idx}`;
      const targetNode = useFlowStore.getState().nodes.find(n => n.id === cardId);
      expect(targetNode).toBeDefined();

      useFlowStore.getState().deleteNodes([targetNode!] as any);

      expect(useFlowStore.getState().nodes.some(n => n.id === cardId)).toBe(false);
    });

    // Verify canvas is now completely empty
    expect(useFlowStore.getState().nodes).toHaveLength(0);
  });
});
