import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';

const initialAddLog = useFlowStore.getState().addLog;
const initialAddActivityLog = useFlowStore.getState().addActivityLog;

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

  it('adding ConfigMap on Pod inside ReplicaSet moves ConfigMap to ReplicaSet and removes it from individual child Pods', () => {
    const cm = { id: 'cm-1', name: 'my-config', data: { env: 'prod' } };
    const rs = { id: 'rs1', type: 'ReplicaSet', position: { x: 100, y: 100 }, data: { label: 'my-rs', replicas: 3, type: 'ReplicaSet' } };
    const pod1 = { id: 'p1', type: 'Pod', parentId: 'rs1', position: { x: 20, y: 40 }, data: { label: 'my-rs-pod1', replicas: 3, type: 'Pod' } };
    const pod2 = { id: 'p2', type: 'Pod', parentId: 'rs1', position: { x: 20, y: 100 }, data: { label: 'my-rs-pod2', replicas: 3, type: 'Pod' } };

    useFlowStore.setState({ nodes: [rs, pod1, pod2] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('p1', { configMaps: [cm] });

    const state = useFlowStore.getState();
    const rsNode = state.nodes.find(n => n.id === 'rs1');
    expect(rsNode?.data.replicas).toBe(3);
    expect(rsNode?.data.configMaps).toEqual([cm]);

    const childPods = state.nodes.filter(n => n.parentId === 'rs1' && n.type === 'Pod');
    expect(childPods.length).toBeGreaterThanOrEqual(2);
    childPods.forEach((podNode) => {
      expect(podNode.data.configMaps).toBeUndefined();
    });
  });

  it('scaling standalone Pod from 1 to 2 auto-promotes to ReplicaSet, moves ConfigMap to ReplicaSet, and removes it from child Pods', () => {
    const cm = { id: 'cm-1', name: 'my-config', data: { env: 'prod' } };
    const standalonePod = {
      id: 'p1',
      type: 'Pod',
      position: { x: 100, y: 100 },
      data: { label: 'app-pod', replicas: 1, type: 'Pod', configMaps: [cm] },
    };

    useFlowStore.setState({ nodes: [standalonePod] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('p1', { replicas: 2 });

    const state = useFlowStore.getState();
    const rsNode = state.nodes.find(n => n.type === 'ReplicaSet');
    expect(rsNode).toBeDefined();
    expect(rsNode?.data.replicas).toBe(2);
    expect(rsNode?.data.configMaps).toEqual([cm]);

    const childPods = state.nodes.filter(n => n.parentId === rsNode?.id && n.type === 'Pod');
    expect(childPods).toHaveLength(2);
    childPods.forEach((podNode) => {
      expect(podNode.data.configMaps).toBeUndefined();
    });
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

    let state = useFlowStore.getState();
    expect(state.edges.some(e => e.source === 's1' && e.target === 'p1')).toBe(true);
    expect(state.edges.some(e => e.source === 's1' && e.target === 'p2')).toBe(false);

    // Test clearing selector to empty string disconnects outgoing edges
    updateNodeData('s1', { selector: '' });
    state = useFlowStore.getState();
    expect(state.edges.some(e => e.source === 's1')).toBe(false);
  });

  it('supports Service selector edge creation targeting Ingress node when selector is updated', () => {
    const lbSvc = { id: 's1', type: 'Service', position: { x: 0, y: 0 }, data: { label: 'lb-svc', type: 'Service', serviceType: 'LoadBalancer', selector: '' } };
    const ing = { id: 'i1', type: 'Ingress', position: { x: 100, y: 0 }, data: { label: 'main-ingress', type: 'Ingress' } };

    useFlowStore.setState({ nodes: [lbSvc, ing] as any, edges: [] });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('s1', { selector: 'main-ingress' });

    let state = useFlowStore.getState();
    expect(state.edges.some(e => e.source === 's1' && e.target === 'i1')).toBe(true);

    // Changing serviceType to ClusterIP clears selector pointing to Ingress and removes edge
    updateNodeData('s1', { serviceType: 'ClusterIP' });
    state = useFlowStore.getState();
    expect(state.nodes.find(n => n.id === 's1')?.data.selector).toBe('');
    expect(state.edges.some(e => e.source === 's1' && e.target === 'i1')).toBe(false);
  });

  it('preserves incoming Internet edge when Service type changes from LoadBalancer to ClusterIP while removing Ingress selector edge', () => {
    const internet = { id: 'inet1', type: 'Internet', position: { x: 0, y: 0 }, data: { label: 'Internet', type: 'Internet' } };
    const lbSvc = { id: 's1', type: 'Service', position: { x: 100, y: 0 }, data: { label: 'lb-svc', type: 'Service', serviceType: 'LoadBalancer', selector: 'main-ingress' } };
    const ing = { id: 'i1', type: 'Ingress', position: { x: 200, y: 0 }, data: { label: 'main-ingress', type: 'Ingress' } };
    const edgeIn = { id: 'e-inet-s1', source: 'inet1', target: 's1' };
    const edgeOut = { id: 'e-s1-ing', source: 's1', target: 'i1' };

    useFlowStore.setState({ nodes: [internet, lbSvc, ing] as any, edges: [edgeIn, edgeOut] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData('s1', { serviceType: 'ClusterIP' });

    const state = useFlowStore.getState();
    expect(state.edges.some(e => e.source === 'inet1' && e.target === 's1')).toBe(true);
    expect(state.edges.some(e => e.source === 's1' && e.target === 'i1')).toBe(false);
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

  it('correctly updates parent controller replicas when updateNodeData is called on a child pod', () => {
    const { addNode, updateNodeData } = useFlowStore.getState();
    addNode('Deployment', { x: 0, y: 0 });
    const depNode = useFlowStore.getState().nodes.find(n => n.type === 'Deployment')!;

    // Scale to 3 replicas
    updateNodeData(depNode.id, { replicas: 3 });
    const dep3 = useFlowStore.getState().nodes.find(n => n.id === depNode.id)!;
    expect(dep3.data.replicas).toBe(3);

    const childPods = useFlowStore.getState().nodes.filter(n => n.parentId === depNode.id && n.type === 'Pod');
    expect(childPods).toHaveLength(3);
    const child1 = childPods[0];

    // Decrement from 3 to 2 on child pod
    updateNodeData(child1.id, { replicas: 2 });
    const dep2 = useFlowStore.getState().nodes.find(n => n.id === depNode.id)!;
    expect(dep2.data.replicas).toBe(2);

    // Increment from 2 to 4 on child pod
    const updatedChild = useFlowStore.getState().nodes.find(n => n.parentId === depNode.id && n.type === 'Pod')!;
    updateNodeData(updatedChild.id, { replicas: 4 });
    const dep4 = useFlowStore.getState().nodes.find(n => n.id === depNode.id)!;
    expect(dep4.data.replicas).toBe(4);
  });

  it('correctly updates StatefulSet parent controller replicas when updateNodeData is called on a child pod', () => {
    const { addNode, updateNodeData } = useFlowStore.getState();
    addNode('StatefulSet', { x: 0, y: 0 });
    const ssNode = useFlowStore.getState().nodes.find(n => n.type === 'StatefulSet')!;

    // Scale to 3 replicas
    updateNodeData(ssNode.id, { replicas: 3 });
    const ss3 = useFlowStore.getState().nodes.find(n => n.id === ssNode.id)!;
    expect(ss3.data.replicas).toBe(3);

    const childPods = useFlowStore.getState().nodes.filter(n => n.parentId === ssNode.id && n.type === 'Pod');
    expect(childPods).toHaveLength(3);
    const child1 = childPods[0];

    // Decrement from 3 to 2 on child pod
    updateNodeData(child1.id, { replicas: 2 });
    const ss2 = useFlowStore.getState().nodes.find(n => n.id === ssNode.id)!;
    expect(ss2.data.replicas).toBe(2);

    // Increment from 2 to 4 on child pod
    const updatedChild = useFlowStore.getState().nodes.find(n => n.parentId === ssNode.id && n.type === 'Pod')!;
    updateNodeData(updatedChild.id, { replicas: 4 });
    const ss4 = useFlowStore.getState().nodes.find(n => n.id === ssNode.id)!;
    expect(ss4.data.replicas).toBe(4);
  });

  it('correctly updates ReplicaSet parent controller replicas when updateNodeData is called on a child pod', () => {
    const { addNode, updateNodeData } = useFlowStore.getState();
    addNode('ReplicaSet', { x: 0, y: 0 });
    const rsNode = useFlowStore.getState().nodes.find(n => n.type === 'ReplicaSet')!;

    // Scale to 3 replicas
    updateNodeData(rsNode.id, { replicas: 3 });
    const rs3 = useFlowStore.getState().nodes.find(n => n.id === rsNode.id)!;
    expect(rs3.data.replicas).toBe(3);

    const childPods = useFlowStore.getState().nodes.filter(n => n.parentId === rsNode.id && n.type === 'Pod');
    expect(childPods).toHaveLength(3);
    const child1 = childPods[0];

    // Decrement from 3 to 2 on child pod
    updateNodeData(child1.id, { replicas: 2 });
    const rs2 = useFlowStore.getState().nodes.find(n => n.id === rsNode.id)!;
    expect(rs2.data.replicas).toBe(2);

    // Increment from 2 to 4 on child pod
    const updatedChild = useFlowStore.getState().nodes.find(n => n.parentId === rsNode.id && n.type === 'Pod')!;
    updateNodeData(updatedChild.id, { replicas: 4 });
    const rs4 = useFlowStore.getState().nodes.find(n => n.id === rsNode.id)!;
    expect(rs4.data.replicas).toBe(4);
  });

  it('handles child pod updates without replicas (newData.replicas === undefined)', () => {
    const { addNode, updateNodeData } = useFlowStore.getState();
    addNode('Deployment', { x: 0, y: 0 });
    const depNode = useFlowStore.getState().nodes.find(n => n.type === 'Deployment')!;
    updateNodeData(depNode.id, { replicas: 2 });

    const childPod = useFlowStore.getState().nodes.find(n => n.parentId === depNode.id && n.type === 'Pod')!;
    updateNodeData(childPod.id, { image: 'nginx:1.25' });

    const depAfter = useFlowStore.getState().nodes.find(n => n.id === depNode.id)!;
    expect(depAfter.data.replicas).toBe(2);
    const updatedChild = useFlowStore.getState().nodes.find(n => n.id === childPod.id)!;
    expect(updatedChild.data.image).toBe('nginx:1.25');
  });

  it('handles child pod updates when parent is non-controller (e.g. Namespace)', () => {
    const { addNode, updateNodeData } = useFlowStore.getState();
    addNode('Namespace', { x: 0, y: 0 });
    const nsNode = useFlowStore.getState().nodes.find(n => n.type === 'Namespace')!;

    addNode('Pod', { x: 50, y: 50 });
    const podNode = useFlowStore.getState().nodes.find(n => n.type === 'Pod' && !n.parentId)!;

    // Attach pod to namespace
    useFlowStore.setState({
      nodes: useFlowStore.getState().nodes.map(n => n.id === podNode.id ? { ...n, parentId: nsNode.id } : n)
    });

    updateNodeData(podNode.id, { label: 'ns-custom-pod' });
    const updatedPod = useFlowStore.getState().nodes.find(n => n.id === podNode.id)!;
    expect(updatedPod.data.label).toBe('ns-custom-pod');
  });

  it('handles StatefulSet node updates, attached resources synchronization, and deletion', () => {
    const { addNode, updateNodeData, deleteNodes } = useFlowStore.getState();
    addNode('StatefulSet', { x: 0, y: 0 });
    const ssNode = useFlowStore.getState().nodes.find(n => n.type === 'StatefulSet')!;

    // 1. Direct update on StatefulSet container
    updateNodeData(ssNode.id, { label: 'my-stateful-app', replicas: 2 });
    const updatedSs = useFlowStore.getState().nodes.find(n => n.id === ssNode.id)!;
    expect(updatedSs.data.label).toBe('my-stateful-app');
    expect(updatedSs.data.replicas).toBe(2);

    // 2. Attached resources sync on child pod inside StatefulSet
    const childPod = useFlowStore.getState().nodes.find(n => n.parentId === ssNode.id && n.type === 'Pod')!;
    updateNodeData(childPod.id, { roles: ['app-role'] });
    const ssWithRole = useFlowStore.getState().nodes.find(n => n.id === ssNode.id)!;
    expect(ssWithRole.data.roles).toEqual(['app-role']);

    // 3. Delete child pod inside StatefulSet
    deleteNodes([childPod]);
    const ssAfterPodDelete = useFlowStore.getState().nodes.find(n => n.id === ssNode.id)!;
    expect(ssAfterPodDelete.data.replicas).toBe(1);

    // 4. Delete StatefulSet container and clean up child pods
    deleteNodes([ssAfterPodDelete]);
    expect(useFlowStore.getState().nodes.some(n => n.id === ssNode.id)).toBe(false);
    expect(useFlowStore.getState().nodes.some(n => n.parentId === ssNode.id)).toBe(false);
  });

  it('extractParentAttachedResources extracts all attached resources during ReplicaSet downscale to 1', () => {
    const rsNode = {
      id: 'rs-attached',
      type: 'ReplicaSet',
      position: { x: 0, y: 0 },
      data: {
        replicas: 2,
        roles: [{ name: 'admin-role' }],
        configMaps: [{ name: 'app-cm' }],
        secrets: [{ name: 'app-sec' }],
        hpas: [{ name: 'app-hpa' }],
        resourceLimits: { cpu: '500m', memory: '512Mi' },
      },
    };
    const childPod = {
      id: 'pod-child-attached',
      type: 'Pod',
      parentId: 'rs-attached',
      position: { x: 10, y: 10 },
      data: {
        label: 'child-pod',
        replicas: 2,
      },
    };
    useFlowStore.setState({ nodes: [rsNode, childPod] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData(childPod.id, { replicas: 1 });

    const singlePod = useFlowStore.getState().nodes.find(n => n.id === childPod.id)!;
    expect(singlePod.data.roles).toEqual([{ name: 'admin-role' }]);
    expect(singlePod.data.configMaps).toEqual([{ name: 'app-cm' }]);
    expect(singlePod.data.secrets).toEqual([{ name: 'app-sec' }]);
    expect(singlePod.data.hpas).toEqual([{ name: 'app-hpa' }]);
    expect(singlePod.data.resourceLimits).toEqual({ cpu: '500m', memory: '512Mi' });
  });

  it('buildAttachedPatch synchronizes configMaps, secrets, hpas, resourceLimits on controller and child pods', () => {
    const depNode = {
      id: 'dep-patch',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 1, type: 'Deployment' },
    };
    const childPod = {
      id: 'pod-patch',
      type: 'Pod',
      parentId: 'dep-patch',
      position: { x: 10, y: 10 },
      data: { type: 'Pod' },
    };
    useFlowStore.setState({ nodes: [depNode, childPod] as any });

    const { updateNodeData } = useFlowStore.getState();

    updateNodeData(childPod.id, { configMaps: [{ name: 'cm-patch' }] });
    expect(useFlowStore.getState().nodes.find(n => n.id === depNode.id)?.data.configMaps).toEqual([{ name: 'cm-patch' }]);

    updateNodeData(childPod.id, { secrets: [{ name: 'sec-patch' }] });
    expect(useFlowStore.getState().nodes.find(n => n.id === depNode.id)?.data.secrets).toEqual([{ name: 'sec-patch' }]);

    updateNodeData(childPod.id, { hpas: [{ name: 'hpa-patch' }] });
    expect(useFlowStore.getState().nodes.find(n => n.id === depNode.id)?.data.hpas).toEqual([{ name: 'hpa-patch' }]);

    updateNodeData(childPod.id, { resourceLimits: { cpu: '100m' } });
    expect(useFlowStore.getState().nodes.find(n => n.id === depNode.id)?.data.resourceLimits).toEqual({ cpu: '100m' });
  });

  it('syncPodAttachedItemsGroup synchronizes standalone sibling pods sharing podHash and baseName', () => {
    const pod1 = {
      id: 'pod-standalone-1',
      type: 'Pod',
      position: { x: 0, y: 0 },
      data: { baseName: 'worker-group', podHash: 'hash123', label: 'worker-group-hash123-abc' },
    };
    const pod2 = {
      id: 'pod-standalone-2',
      type: 'Pod',
      position: { x: 50, y: 50 },
      data: { baseName: 'worker-group', podHash: 'hash123', label: 'worker-group-hash123-def' },
    };
    useFlowStore.setState({ nodes: [pod1, pod2] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData(pod1.id, { roles: [{ name: 'worker-role' }] });

    const updatedPod2 = useFlowStore.getState().nodes.find(n => n.id === pod2.id)!;
    expect(updatedPod2.data.roles).toEqual([{ name: 'worker-role' }]);
  });

  it('handlePodParentSync handles missing parent, fallback baseName, and label fallback during downscale', () => {
    // 1. Missing parent: child pod with non-existent parentId
    const orphanPod = {
      id: 'pod-orphan',
      type: 'Pod',
      parentId: 'missing-parent-id',
      position: { x: 0, y: 0 },
      data: { replicas: 1 },
    };
    useFlowStore.setState({ nodes: [orphanPod] as any });
    const { updateNodeData } = useFlowStore.getState();
    updateNodeData(orphanPod.id, { image: 'nginx:alpine' });
    expect(useFlowStore.getState().nodes.find(n => n.id === orphanPod.id)?.data.image).toBe('nginx:alpine');

    // 2. ReplicaSet downscale to 1 when child pod has no baseName (falls back to label)
    const rsNoRep = {
      id: 'rs-no-rep',
      type: 'ReplicaSet',
      position: { x: 0, y: 0 },
      data: {}, // no replicas specified in parent
    };
    const childNoBase = {
      id: 'pod-no-base',
      type: 'Pod',
      parentId: 'rs-no-rep',
      position: { x: 10, y: 10 },
      data: { label: 'custom-label' },
    };
    useFlowStore.setState({ nodes: [rsNoRep, childNoBase] as any });
    updateNodeData(childNoBase.id, { replicas: 1 });
    const cleanPod = useFlowStore.getState().nodes.find(n => n.id === childNoBase.id)!;
    expect(cleanPod.parentId).toBeUndefined();

    // 3. Child pod with neither baseName nor label (fallback 'pod')
    const rsNoRep2 = { id: 'rs-no-rep-2', type: 'ReplicaSet', position: { x: 0, y: 0 }, data: {} };
    const childEmpty = { id: 'pod-empty', type: 'Pod', parentId: 'rs-no-rep-2', position: { x: 0, y: 0 }, data: {} };
    useFlowStore.setState({ nodes: [rsNoRep2, childEmpty] as any });
    updateNodeData(childEmpty.id, { replicas: 1 });
    const cleanPod2 = useFlowStore.getState().nodes.find(n => n.id === childEmpty.id)!;
    expect(cleanPod2.data.label).toContain('pod');
  });

  it('syncEdgesFromFormSelection handles Service with LoadBalancer to Ingress, cleared selector, and duplicate edge check', () => {
    const svcNode = {
      id: 'svc-lb',
      type: 'Service',
      position: { x: 0, y: 0 },
      data: { label: 'my-lb-svc', serviceType: 'ClusterIP', selector: '' },
    };
    const ingressNode = {
      id: 'ingress-1',
      type: 'Ingress',
      position: { x: 100, y: 0 },
      data: { label: 'ingress-app' },
    };
    const depNode = {
      id: 'dep-target',
      type: 'Deployment',
      position: { x: 200, y: 0 },
      data: { label: 'web-workload' },
    };
    const existingEdge = {
      id: 'e-existing',
      source: 'svc-lb',
      target: 'ingress-1',
    };
    useFlowStore.setState({
      nodes: [svcNode, ingressNode, depNode] as any,
      edges: [existingEdge] as any,
    });

    const { updateNodeData } = useFlowStore.getState();

    // 1. Changing serviceType to LoadBalancer and selector to ingress-app
    updateNodeData(svcNode.id, { serviceType: 'LoadBalancer', selector: 'ingress-app' });
    let edges = useFlowStore.getState().edges;
    expect(edges.some(e => e.source === 'svc-lb' && e.target === 'ingress-1')).toBe(true);

    // 2. Duplicate edge check: update again with same selector
    updateNodeData(svcNode.id, { selector: 'ingress-app' });
    edges = useFlowStore.getState().edges;
    const ingressEdges = edges.filter(e => e.source === 'svc-lb' && e.target === 'ingress-1');
    expect(ingressEdges.length).toBe(1);

    // 3. Clear selector: should remove outgoing edges to workloads
    updateNodeData(svcNode.id, { selector: '' });
    edges = useFlowStore.getState().edges;
    expect(edges.some(e => e.source === 'svc-lb')).toBe(false);

    // 4. Update selector to non-matching target
    updateNodeData(svcNode.id, { selector: 'non-matching-selector' });
    edges = useFlowStore.getState().edges;
    expect(edges.some(e => e.source === 'svc-lb')).toBe(false);
  });

  it('syncEdgesFromFormSelection handles Ingress backendServiceName update and duplicate edge check', () => {
    const ingressNode = {
      id: 'ingress-main',
      type: 'Ingress',
      position: { x: 0, y: 0 },
      data: { label: 'main-ingress', backendServiceName: '' },
    };
    const svc1 = {
      id: 'svc-1',
      type: 'Service',
      position: { x: 100, y: 0 },
      data: { label: 'api-service' },
    };
    const svc2 = {
      id: 'svc-2',
      type: 'Service',
      position: { x: 200, y: 0 },
      data: { label: 'old-service' },
    };
    const oldEdge = {
      id: 'e-old',
      source: 'ingress-main',
      target: 'svc-2',
    };
    useFlowStore.setState({
      nodes: [ingressNode, svc1, svc2] as any,
      edges: [oldEdge] as any,
    });

    const { updateNodeData } = useFlowStore.getState();

    // 1. Point to api-service (removes old edge to svc-2 and creates edge to svc-1)
    updateNodeData(ingressNode.id, { backendServiceName: 'api-service' });
    let edges = useFlowStore.getState().edges;
    expect(edges.some(e => e.source === 'ingress-main' && e.target === 'svc-1')).toBe(true);
    expect(edges.some(e => e.source === 'ingress-main' && e.target === 'svc-2')).toBe(false);

    // 2. Duplicate edge check: call again with same backendServiceName
    updateNodeData(ingressNode.id, { backendServiceName: 'api-service' });
    edges = useFlowStore.getState().edges;
    const matching = edges.filter(e => e.source === 'ingress-main' && e.target === 'svc-1');
    expect(matching.length).toBe(1);

    // 3. Clear backendServiceName
    updateNodeData(ingressNode.id, { backendServiceName: '' });
    edges = useFlowStore.getState().edges;
    expect(edges.some(e => e.source === 'ingress-main')).toBe(false);
  });

  it('sanitizeAndUpdateServiceSelector resets selector when changing from LoadBalancer to ClusterIP targeting Ingress', () => {
    const ingressNode = {
      id: 'ingress-target',
      type: 'Ingress',
      position: { x: 0, y: 0 },
      data: { label: 'ingress-lbl' },
    };
    const svcNode = {
      id: 'svc-lb-switch',
      type: 'Service',
      position: { x: 50, y: 50 },
      data: { serviceType: 'LoadBalancer', selector: 'ingress-lbl' },
    };
    useFlowStore.setState({ nodes: [ingressNode, svcNode] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData(svcNode.id, { serviceType: 'ClusterIP' });

    const updatedSvc = useFlowStore.getState().nodes.find(n => n.id === svcNode.id)!;
    expect(updatedSvc.data.serviceType).toBe('ClusterIP');
    expect(updatedSvc.data.selector).toBe('');
  });

  it('syncPvcRealtimeStatuses updates PVC status when real-time evaluation status differs', () => {
    const pvcNode = {
      id: 'pvc-rt',
      type: 'PVC',
      position: { x: 0, y: 0 },
      data: { label: 'data-pvc', pvcStatus: 'Pending', accessMode: 'ReadWriteOnce' },
    };
    const depNode = {
      id: 'dep-rt',
      type: 'Deployment',
      position: { x: 100, y: 0 },
      data: { label: 'web-rt', replicas: 2 },
    };
    const edge = { id: 'e-rt', source: 'pvc-rt', target: 'dep-rt' };
    useFlowStore.setState({ nodes: [pvcNode, depNode] as any, edges: [edge] as any });

    const { updateNodeData } = useFlowStore.getState();
    // Updating dep replicas to 3 triggers syncPvcRealtimeStatuses which evaluates Multi-Attach Error
    updateNodeData(depNode.id, { replicas: 3 });

    const updatedPvc = useFlowStore.getState().nodes.find(n => n.id === pvcNode.id)!;
    expect(updatedPvc.data.pvcStatus).toBe('Multi-Attach Error');
  });

  it('updateNodeData handles workloadType transformation and baseName update', () => {
    const depNode = {
      id: 'dep-transform',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { label: 'app-workload', type: 'Deployment', replicas: 1 },
    };
    useFlowStore.setState({ nodes: [depNode] as any });

    const { updateNodeData } = useFlowStore.getState();
    // Transform Deployment to StatefulSet via workloadType
    updateNodeData(depNode.id, { workloadType: 'StatefulSet', baseName: 'custom-stateful' });

    const transformed = useFlowStore.getState().nodes.find(n => n.id === depNode.id)!;
    expect(transformed.type).toBe('StatefulSet');
    expect(transformed.data.baseName).toBe('custom-stateful');
  });

  it('onNodeClick handles forbidden access, StatefulSet selection, and pane/group actions', () => {
    const addLogSpy = vi.fn();
    useFlowStore.setState({
      activeIdentity: 'restricted-user',
      iamUsers: [{ username: 'restricted-user', policies: [] }],
      addLog: addLogSpy,
    });

    const restrictedPod = {
      id: 'pod-restricted',
      type: 'Pod',
      position: { x: 0, y: 0 },
      data: { label: 'secret-pod' },
    };
    useFlowStore.setState({ nodes: [restrictedPod] as any });

    const { onNodeClick, onPaneClick, groupNodes, ungroupNodes, alignAllNodesToGrid } = useFlowStore.getState();

    // 1. Forbidden access
    onNodeClick({} as any, restrictedPod as any);
    expect(addLogSpy).toHaveBeenCalledWith('warn', expect.stringContaining('Access forbidden'), 'UI');

    // 2. Allowed StatefulSet click
    useFlowStore.setState({ activeIdentity: 'system:admin' });
    const ssNode = { id: 'ss-click', type: 'StatefulSet', position: { x: 0, y: 0 }, data: {} };
    onNodeClick({} as any, ssNode as any);
    expect(useFlowStore.getState().activeDeploymentId).toBe('ss-click');
    expect(useFlowStore.getState().configuringNodeId).toBe('ss-click');

    // 3. onPaneClick
    onPaneClick();
    expect(useFlowStore.getState().activeDeploymentId).toBeNull();
    expect(useFlowStore.getState().configuringNodeId).toBeNull();

    // 4. groupNodes and ungroupNodes
    const n1 = { id: 'node-grp-1', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
    useFlowStore.setState({ nodes: [n1] as any });
    groupNodes(['node-grp-1']);
    expect(useFlowStore.getState().nodes[0].data.groupId).toBeDefined();

    ungroupNodes(['node-grp-1']);
    expect(useFlowStore.getState().nodes[0].data.groupId).toBeUndefined();

    // 5. alignAllNodesToGrid with default gridGap and activity log
    const addActivityLog = vi.fn();
    useFlowStore.setState({ addActivityLog });
    alignAllNodesToGrid();
    expect(addActivityLog).toHaveBeenCalledWith('Aligned all nodes to canvas grid (24px)');
  });


  it('covers attached resources fallback branches and unrelated nodes in syncPodAttachedItemsGroup', () => {
    // 1. Controller parent with child pod and an unrelated node on canvas
    const dep = {
      id: 'dep-controller',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { replicas: 1 },
    };
    const childPod = {
      id: 'pod-inside',
      type: 'Pod',
      parentId: 'dep-controller',
      position: { x: 10, y: 10 },
      data: {},
    };
    const unrelatedNode = {
      id: 'unrelated-pod',
      type: 'Pod',
      position: { x: 100, y: 100 },
      data: { label: 'other' },
    };
    useFlowStore.setState({ nodes: [dep, childPod, unrelatedNode] as any });

    const { updateNodeData } = useFlowStore.getState();
    // Exercise fallback chain: newData.hpas, newData.resourceLimits, etc.
    updateNodeData(childPod.id, { hpas: [{ name: 'hpa-chain' }] });
    updateNodeData(childPod.id, { resourceLimits: { cpu: '100m' } });

    expect(useFlowStore.getState().nodes.find(n => n.id === dep.id)?.data.hpas).toEqual([{ name: 'hpa-chain' }]);
    expect(useFlowStore.getState().nodes.find(n => n.id === unrelatedNode.id)?.data.hpas).toBeUndefined();

    // 2. Standalone pod group with sibling sharing non-controller parent (isSameParent) and unrelated node
    const nsParent = { id: 'ns-group-parent', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
    const podA = { id: 'pod-a', type: 'Pod', parentId: 'ns-group-parent', position: { x: 10, y: 10 }, data: {} };
    const podB = { id: 'pod-b', type: 'Pod', parentId: 'ns-group-parent', position: { x: 20, y: 20 }, data: {} };
    useFlowStore.setState({ nodes: [nsParent, podA, podB, unrelatedNode] as any });

    updateNodeData(podA.id, { configMaps: [{ name: 'cm-sibling' }] });
    expect(useFlowStore.getState().nodes.find(n => n.id === podB.id)?.data.configMaps).toEqual([{ name: 'cm-sibling' }]);
  });

  it('covers syncEdgesFromFormSelection with non-workload targets, Ingress filtering, and child pod exclusions', () => {
    const svc = {
      id: 'svc-filter-test',
      type: 'Service',
      position: { x: 0, y: 0 },
      data: { serviceType: 'ClusterIP', selector: 'initial-old' },
    };
    const pvcNode = { id: 'pvc-edge-test', type: 'PVC', position: { x: 50, y: 0 }, data: {} };
    const ingressNode = { id: 'ingress-by-id', type: 'Ingress', position: { x: 100, y: 0 }, data: { label: 'ing-lbl' } };
    const childPod = {
      id: 'child-pod-excluded',
      type: 'Pod',
      parentId: 'some-parent',
      position: { x: 150, y: 0 },
      data: { label: 'target-pod', parentId: 'some-parent' },
    };
    const standalonePod = {
      id: 'standalone-matched',
      type: 'Pod',
      position: { x: 200, y: 0 },
      data: { label: 'target-pod' },
    };
    // Edge from service to PVC (non-workload target) to test line 292
    const edgeToPvc = { id: 'e-to-pvc', source: 'svc-filter-test', target: 'pvc-edge-test' };
    const edgeToIngress = { id: 'e-to-ing', source: 'svc-filter-test', target: 'ingress-by-id' };

    useFlowStore.setState({
      nodes: [svc, pvcNode, ingressNode, childPod, standalonePod] as any,
      edges: [edgeToPvc, edgeToIngress] as any,
    });

    const { updateNodeData } = useFlowStore.getState();

    // 1. Service with ClusterIP pointing to target-pod:
    // edgeToPvc is preserved (non-workload target), edgeToIngress is removed (ClusterIP cannot target Ingress)
    // Child pod is excluded, standalone pod gets edge
    updateNodeData(svc.id, { selector: 'target-pod' });
    let edges = useFlowStore.getState().edges;
    expect(edges.some(e => e.source === 'svc-filter-test' && e.target === 'pvc-edge-test')).toBe(true);
    expect(edges.some(e => e.source === 'svc-filter-test' && e.target === 'ingress-by-id')).toBe(false);
    expect(edges.some(e => e.source === 'svc-filter-test' && e.target === 'standalone-matched')).toBe(true);
    expect(edges.some(e => e.source === 'svc-filter-test' && e.target === 'child-pod-excluded')).toBe(false);

    // 2. sanitizeAndUpdateServiceSelector when selector matches ingress by id
    updateNodeData(svc.id, { serviceType: 'LoadBalancer', selector: 'ingress-by-id' });
    expect(useFlowStore.getState().nodes.find(n => n.id === svc.id)?.data.selector).toBe('ingress-by-id');

    // Changing back to ClusterIP resets selector targeting ingress by id
    updateNodeData(svc.id, { serviceType: 'ClusterIP' });
    expect(useFlowStore.getState().nodes.find(n => n.id === svc.id)?.data.selector).toBe('');

    // 3. Changing to ClusterIP when selector is for regular workload preserves selector
    updateNodeData(svc.id, { serviceType: 'LoadBalancer', selector: 'target-pod' });
    updateNodeData(svc.id, { serviceType: 'ClusterIP' });
    expect(useFlowStore.getState().nodes.find(n => n.id === svc.id)?.data.selector).toBe('target-pod');
  });

  it('covers Ingress connected to non-Service targets and reference invalidation on Service rename/deletion', () => {
    const ingress = {
      id: 'ing-ref-test',
      type: 'Ingress',
      position: { x: 0, y: 0 },
      data: { label: 'my-ingress', backendServiceName: 'web-service' },
    };
    const svc = {
      id: 'svc-ref-test',
      type: 'Service',
      position: { x: 100, y: 0 },
      data: { label: 'web-service' },
    };
    const otherNode = { id: 'other-node', type: 'Pod', position: { x: 200, y: 0 }, data: {} };
    // Edge from Ingress to non-Service target
    const edgeToPod = { id: 'e-ing-pod', source: 'ing-ref-test', target: 'other-node' };
    const edgeToSvc = { id: 'e-ing-svc', source: 'ing-ref-test', target: 'svc-ref-test' };

    useFlowStore.setState({
      nodes: [ingress, svc, otherNode] as any,
      edges: [edgeToPod, edgeToSvc] as any,
    });

    const { updateNodeData, deleteNodes } = useFlowStore.getState();

    // 1. Ingress update preserving edge to non-Service target
    updateNodeData(ingress.id, { backendServiceName: 'web-service' });
    expect(useFlowStore.getState().edges.some(e => e.source === 'ing-ref-test' && e.target === 'other-node')).toBe(true);

    // 2. Renaming Service invalidates Ingress backendServiceName
    updateNodeData(svc.id, { label: 'web-service-v2' });
    expect(useFlowStore.getState().nodes.find(n => n.id === ingress.id)?.data.backendServiceName).toBe('');

    // 3. Reset backendServiceName and delete Service: invalidates reference again
    updateNodeData(ingress.id, { backendServiceName: 'web-service-v2' });
    const svcToDelete = useFlowStore.getState().nodes.find(n => n.id === svc.id)!;
    deleteNodes([svcToDelete]);
    expect(useFlowStore.getState().nodes.find(n => n.id === ingress.id)?.data.backendServiceName).toBe('');
  });

  it('covers nodeActions helpers: baseName update alone, group/ungroup non-matching nodes, alignAllNodesToGrid without activity log', () => {
    const pod1 = { id: 'p-grp-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'p1' } };
    const pod2 = { id: 'p-grp-2', type: 'Pod', position: { x: 10, y: 10 }, data: { label: 'p2' } };
    useFlowStore.setState({ nodes: [pod1, pod2] as any });

    const { updateNodeData, groupNodes, ungroupNodes, alignAllNodesToGrid } = useFlowStore.getState();

    // 1. updateNodeData with baseName alone
    updateNodeData(pod1.id, { baseName: 'p1-new-base' });
    expect(useFlowStore.getState().nodes.find(n => n.id === pod1.id)?.data.baseName).toBe('p1-new-base');

    // 2. groupNodes only touches matching node, pod2 remains undefined
    groupNodes(['p-grp-1']);
    expect(useFlowStore.getState().nodes.find(n => n.id === pod1.id)?.data.groupId).toBeDefined();
    expect(useFlowStore.getState().nodes.find(n => n.id === pod2.id)?.data.groupId).toBeUndefined();

    // 3. ungroupNodes only touches matching node
    ungroupNodes(['p-grp-1']);
    expect(useFlowStore.getState().nodes.find(n => n.id === pod1.id)?.data.groupId).toBeUndefined();

    // 4. alignAllNodesToGrid when addActivityLog is undefined
    useFlowStore.setState({ addActivityLog: undefined });
    expect(() => alignAllNodesToGrid(16)).not.toThrow();
    useFlowStore.setState({ addActivityLog: initialAddActivityLog });
  });


  it('covers controller pod additions (StatefulSet and ReplicaSet) and others mapping in handleAdditionSync', () => {
    const { addNode } = useFlowStore.getState();

    // 1. Add Pod into StatefulSet parent
    addNode('StatefulSet', { x: 0, y: 0 });
    const ssParent = useFlowStore.getState().nodes.find(n => n.type === 'StatefulSet')!;
    addNode('Pod', { x: 10, y: 10 }, ssParent.id);
    expect(useFlowStore.getState().nodes.some(n => n.parentId === ssParent.id && n.type === 'Pod')).toBe(true);

    // 2. Add Pod into ReplicaSet parent with an unrelated node on canvas
    addNode('ReplicaSet', { x: 100, y: 100 });
    const rsParent = useFlowStore.getState().nodes.find(n => n.type === 'ReplicaSet')!;
    addNode('Pod', { x: 110, y: 110 }, rsParent.id);
    expect(useFlowStore.getState().nodes.some(n => n.parentId === rsParent.id && n.type === 'Pod')).toBe(true);
  });

  it('covers processNodeDeletion for child pod inside Namespace parent and with unrelated canvas nodes', () => {
    const nsParent = { id: 'ns-del-test', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
    const podInNs = { id: 'pod-in-ns', type: 'Pod', parentId: 'ns-del-test', position: { x: 10, y: 10 }, data: {} };
    const unrelatedNode = { id: 'unrelated-del', type: 'Service', position: { x: 50, y: 50 }, data: { label: 'svc-unrelated' } };

    useFlowStore.setState({ nodes: [nsParent, podInNs, unrelatedNode] as any });
    const { deleteNodes } = useFlowStore.getState();

    // Deleting pod inside Namespace: parent is not in WORKLOAD_CONTROLLERS
    deleteNodes([podInNs as any]);
    expect(useFlowStore.getState().nodes.some(n => n.id === 'pod-in-ns')).toBe(false);

    // Deleting child pod inside Deployment with unrelated node on canvas to exercise others.map fallback
    const depParent = { id: 'dep-del-test', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 2 } };
    const childPodNoReplicas = { id: 'pod-no-rep', type: 'Pod', parentId: 'dep-del-test', position: { x: 10, y: 10 }, data: {} }; // no replicas in data
    useFlowStore.setState({ nodes: [depParent, childPodNoReplicas, unrelatedNode] as any });

    deleteNodes([childPodNoReplicas as any]);
    expect(useFlowStore.getState().nodes.some(n => n.id === 'pod-no-rep')).toBe(false);
    expect(useFlowStore.getState().nodes.some(n => n.id === 'unrelated-del')).toBe(true);
  });

  it('covers deleteNodes for PVC/Namespace (non-workload) and fallback dimensions/types', () => {
    const pvcNode = { id: 'pvc-del', type: 'PVC', position: { x: 0, y: 0 }, data: {} }; // no width/height/label
    const nodeNoType = { id: 'node-notype', position: { x: 10, y: 10 }, data: {} }; // no type property
    useFlowStore.setState({ nodes: [pvcNode, nodeNoType] as any });

    const { deleteNodes } = useFlowStore.getState();
    deleteNodes([pvcNode as any, nodeNoType as any]);

    expect(useFlowStore.getState().nodes.some(n => n.id === 'pvc-del')).toBe(false);
    expect(useFlowStore.getState().nodes.some(n => n.id === 'node-notype')).toBe(false);
  });

  it('covers Ingress filter with unrelated edge and live resource command limit fallbacks', () => {
    const ingress = { id: 'ing-edge-test', type: 'Ingress', position: { x: 0, y: 0 }, data: { backendServiceName: 'web-svc' } };
    const svc = { id: 'svc-match', type: 'Service', position: { x: 100, y: 0 }, data: { label: 'web-svc' } };
    const unrelatedEdge = { id: 'e-unrelated-source', source: 'some-other-source', target: 'some-other-target' };
    const ingressEdge = { id: 'e-ing-svc', source: 'ing-edge-test', target: 'svc-match' };

    useFlowStore.setState({ nodes: [ingress, svc] as any, edges: [unrelatedEdge, ingressEdge] as any });
    const { updateNodeData } = useFlowStore.getState();

    // Trigger Ingress filter while unrelated edge exists
    updateNodeData(ingress.id, { backendServiceName: 'web-svc' });
    expect(useFlowStore.getState().edges.some(e => e.id === 'e-unrelated-source')).toBe(true);

    // Updating only cpuLimit (memoryLimit undefined) and updating only memoryLimit (cpuLimit undefined)
    const depNode = { id: 'dep-res-partial', type: 'Deployment', position: { x: 0, y: 0 }, data: { cpuLimit: '100m', memoryLimit: '128Mi' } };
    useFlowStore.setState({ nodes: [depNode] as any });

    updateNodeData(depNode.id, { cpuLimit: '250m' });
    expect(useFlowStore.getState().nodes.find(n => n.id === depNode.id)?.data.cpuLimit).toBe('250m');

    updateNodeData(depNode.id, { memoryLimit: '512Mi' });
    expect(useFlowStore.getState().nodes.find(n => n.id === depNode.id)?.data.memoryLimit).toBe('512Mi');
  });

  it('covers onNodeClick activeDeploymentId null for Pod, and workloadType non-controller Pod', () => {
    const podNode = { id: 'pod-plain-click', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'plain-pod' } };
    useFlowStore.setState({ nodes: [podNode] as any, activeDeploymentId: 'some-dep' });

    const { onNodeClick, updateNodeData } = useFlowStore.getState();

    // 1. onNodeClick on Pod sets activeDeploymentId to null
    onNodeClick({} as any, podNode as any);
    expect(useFlowStore.getState().activeDeploymentId).toBeNull();
    expect(useFlowStore.getState().configuringNodeId).toBe('pod-plain-click');

    // 2. updateNodeData passing workloadType on a Pod node: does not transform type
    updateNodeData(podNode.id, { workloadType: 'StatefulSet' as any, label: 'pod-new-lbl' });
    const updated = useFlowStore.getState().nodes.find(n => n.id === podNode.id)!;
    expect(updated.type).toBe('Pod');
  });


  it('covers attached patch fallbacks for secrets, hpas, and resourceLimits with sibling label fallback', () => {
    const pod1 = {
      id: 'p-patch-1',
      type: 'Pod',
      position: { x: 0, y: 0 },
      data: { baseName: 'shared-workload', podHash: 'hash123', label: 'shared-workload-abc' },
    };
    const pod2 = {
      id: 'p-patch-2',
      type: 'Pod',
      position: { x: 50, y: 50 },
      data: { baseName: undefined, podHash: 'hash123', label: 'shared-workload' },
    };
    useFlowStore.setState({ nodes: [pod1, pod2] as any });

    const { updateNodeData } = useFlowStore.getState();

    // 1. Secrets update
    updateNodeData(pod1.id, { secrets: ['sec-test-1'] });
    let p2 = useFlowStore.getState().nodes.find(n => n.id === pod2.id);
    expect(p2?.data.secrets).toEqual(['sec-test-1']);

    // 2. HPAs update
    updateNodeData(pod1.id, { hpas: ['hpa-test-1'] });
    p2 = useFlowStore.getState().nodes.find(n => n.id === pod2.id);
    expect(p2?.data.hpas).toEqual(['hpa-test-1']);

    // 3. ResourceLimits update
    updateNodeData(pod1.id, { resourceLimits: ['limit-test-1'] });
    p2 = useFlowStore.getState().nodes.find(n => n.id === pod2.id);
    expect(p2?.data.resourceLimits).toEqual(['limit-test-1']);
  });

  it('covers handlePodParentSync with undefined parent replicas and scaling to 0', () => {
    const parentDeploy = {
      id: 'parent-dep-zero',
      type: 'Deployment',
      position: { x: 0, y: 0 },
      data: { label: 'web-deploy', replicas: undefined },
    };
    const childPod = {
      id: 'child-pod-zero',
      type: 'Pod',
      parentId: 'parent-dep-zero',
      position: { x: 10, y: 10 },
      data: { label: 'web-deploy-pod1', baseName: 'web-deploy' },
    };
    useFlowStore.setState({ nodes: [parentDeploy, childPod] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData(childPod.id, { replicas: 0 });

    const updatedParent = useFlowStore.getState().nodes.find(n => n.id === parentDeploy.id);
    expect(updatedParent?.data.replicas).toBe(0);
  });

  it('covers syncEdgesFromFormSelection with missing type and baseName fallback on targets', () => {
    const untypedNode = {
      id: 'untyped-node-1',
      type: undefined as any,
      position: { x: 100, y: 100 },
      data: { label: 'other-label' },
    };
    const targetDeploy = {
      id: 'target-dep-basename',
      type: 'Deployment',
      position: { x: 200, y: 200 },
      data: { label: '', baseName: 'backend-svc-sel' },
    };
    const svc = {
      id: 'svc-sel-test',
      type: 'Service',
      position: { x: 0, y: 0 },
      data: { label: 'my-service', selector: 'backend-svc-sel', serviceType: 'ClusterIP' },
    };
    const existingEdge = {
      id: 'e-svc-target-1',
      source: svc.id,
      target: targetDeploy.id,
      type: 'custom',
    };
    useFlowStore.setState({
      nodes: [untypedNode, targetDeploy, svc] as any,
      edges: [existingEdge],
    });

    const { updateNodeData } = useFlowStore.getState();
    // Update selector triggering edge evaluation
    updateNodeData(svc.id, { selector: 'backend-svc-sel' });

    const edges = useFlowStore.getState().edges;
    expect(edges.some(e => e.source === svc.id && e.target === targetDeploy.id)).toBe(true);
  });

  it('covers target without type, empty labels, and fallback to id for live commands and logs', () => {
    const untypedTarget = {
      id: 'untyped-target-node',
      type: undefined as any,
      position: { x: 0, y: 0 },
      data: { label: '', baseName: 'prev-basename' },
    };
    useFlowStore.setState({ nodes: [untypedTarget] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData(untypedTarget.id, {
      label: '',
      image: 'nginx:alpine',
      cpuLimit: '250m',
    });

    const updated = useFlowStore.getState().nodes.find(n => n.id === untypedTarget.id);
    expect(updated).toBeDefined();
  });

  it('covers onNodeClick with undefined iamUsers and empty label in forbidden log', () => {
    const addLogSpy = vi.fn();
    useFlowStore.setState({
      activeIdentity: 'restricted-user',
      iamUsers: undefined as any,
      addLog: addLogSpy,
    });

    const secretNode = {
      id: 'secret-card-unlabeled',
      type: 'Secret',
      position: { x: 0, y: 0 },
      data: { label: '' },
    };
    useFlowStore.setState({ nodes: [secretNode] as any });

    const { onNodeClick } = useFlowStore.getState();
    onNodeClick({} as any, secretNode as any);

    expect(addLogSpy).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('Access forbidden for user "restricted-user" on card "secret-card-unlabeled" (Secret)'),
      'UI'
    );
  });


  it('covers handleAdditionSync when Pod is added into a Namespace parent', () => {
    const nsNode = { id: 'ns-target', type: 'Namespace', position: { x: 0, y: 0 }, data: { label: 'my-ns' } };
    useFlowStore.setState({ nodes: [nsNode] as any });

    const { addNode } = useFlowStore.getState();
    addNode('Pod', { x: 50, y: 50 }, 'ns-target');

    const pod = useFlowStore.getState().nodes.find(n => n.type === 'Pod');
    expect(pod?.parentId).toBe('ns-target');
  });

  it('covers sanitizeAndUpdateServiceSelector when selector is empty/undefined', () => {
    const svc = {
      id: 'svc-no-sel',
      type: 'Service',
      position: { x: 0, y: 0 },
      data: { label: 'svc-no-sel', serviceType: 'LoadBalancer', selector: '' },
    };
    useFlowStore.setState({ nodes: [svc] as any });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData(svc.id, { serviceType: 'ClusterIP' });

    const updatedSvc = useFlowStore.getState().nodes.find(n => n.id === svc.id);
    expect(updatedSvc?.data.serviceType).toBe('ClusterIP');
  });

  it('covers Ingress filter preserving edges where e.source !== targetNode.id', () => {
    const ingress = {
      id: 'ing-edge-test',
      type: 'Ingress',
      position: { x: 0, y: 0 },
      data: { label: 'my-ing', backendServiceName: 'old-svc' },
    };
    const svc = {
      id: 'svc-matching',
      type: 'Service',
      position: { x: 200, y: 0 },
      data: { label: 'new-svc' },
    };
    const unrelatedEdge = {
      id: 'e-unrelated-source',
      source: 'other-source-id',
      target: 'other-target-id',
    };
    const oldIngressEdge = {
      id: 'e-old-ingress',
      source: ingress.id,
      target: svc.id,
    };
    useFlowStore.setState({
      nodes: [ingress, svc] as any,
      edges: [unrelatedEdge, oldIngressEdge] as any,
    });

    const { updateNodeData } = useFlowStore.getState();
    updateNodeData(ingress.id, { backendServiceName: 'new-svc' });

    const edges = useFlowStore.getState().edges;
    expect(edges.some(e => e.id === 'e-unrelated-source')).toBe(true);
    expect(edges.some(e => e.source === ingress.id && e.target === svc.id)).toBe(true);
  });

});
