import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFlowStore } from '@/store';
import { Node, Edge } from '@xyflow/react';
import { syncRoleRulesFromConnections, checkPvcTopologyError } from '@/store/slices/createFlowSlice';

describe('createFlowSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      activeIdentity: 'system:admin',
      iamUsers: [],
      lastActionId: 'init'
    });
  });

  it('setNodes updates nodes state directly', () => {
    const node1: Node = { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
    useFlowStore.getState().setNodes([node1]);
    expect(useFlowStore.getState().nodes).toEqual([node1]);
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

  it('onNodesChange rejects position changes for forbidden nodes', () => {
    const devUser = {
      id: 'dev1',
      username: 'dev-user',
      policies: [{ name: 'ContainerDeveloperPolicy', description: 'Dev' }],
      roles: [],
    };
    const svcNode = { id: 'svc1', type: 'Service', position: { x: 0, y: 0 }, data: { label: 'svc1' } };
    useFlowStore.setState({
      nodes: [svcNode] as any,
      iamUsers: [devUser] as any,
      activeIdentity: 'dev-user',
    });

    const { onNodesChange } = useFlowStore.getState();
    onNodesChange([{ id: 'svc1', type: 'position', position: { x: 100, y: 100 } }]);

    const state = useFlowStore.getState();
    expect(state.nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it('onNodesChange handles dx===0 and dy===0 or position changes without group', () => {
    const node1 = { id: 'n1', position: { x: 10, y: 10 }, data: { groupId: 'g1' } };
    useFlowStore.setState({ nodes: [node1] as any });

    const { onNodesChange } = useFlowStore.getState();
    onNodesChange([{ id: 'n1', type: 'position', position: { x: 10, y: 10 } }]);

    expect(useFlowStore.getState().nodes[0].position).toEqual({ x: 10, y: 10 });
  });

  it('syncRoleRulesFromConnections syncs rules for all connected workload types', () => {
    const roleNode: Node = { id: 'role1', type: 'Role', position: { x: 0, y: 0 }, data: { rules: [{ apiGroups: [''], resources: [], verbs: ['get'] }] } };
    const depNode: Node = { id: 'dep1', type: 'Deployment', position: { x: 100, y: 0 }, data: { replicas: 1 } };
    const podNode: Node = { id: 'pod1', type: 'Pod', position: { x: 200, y: 0 }, data: {} };
    const svcNode: Node = { id: 'svc1', type: 'Service', position: { x: 300, y: 0 }, data: {} };
    const pvcNode: Node = { id: 'pvc1', type: 'PVC', position: { x: 400, y: 0 }, data: {} };
    const cmNode: Node = { id: 'cm1', type: 'ConfigMap', position: { x: 500, y: 0 }, data: {} };
    const secNode: Node = { id: 'sec1', type: 'Secret', position: { x: 600, y: 0 }, data: {} };
    const rsNode: Node = { id: 'rs1', type: 'ReplicaSet', position: { x: 700, y: 0 }, data: {} };

    const edges: Edge[] = [
      { id: 'e1', source: 'role1', target: 'dep1' },
      { id: 'e2', source: 'role1', target: 'pod1' },
      { id: 'e3', source: 'role1', target: 'svc1' },
      { id: 'e4', source: 'role1', target: 'pvc1' },
      { id: 'e5', source: 'role1', target: 'cm1' },
      { id: 'e6', source: 'role1', target: 'sec1' },
      { id: 'e7', source: 'role1', target: 'rs1' },
    ];

    useFlowStore.setState({
      nodes: [roleNode, depNode, podNode, svcNode, pvcNode, cmNode, secNode, rsNode],
      edges: [],
    });

    const { setEdges } = useFlowStore.getState();
    setEdges(edges);

    const state = useFlowStore.getState();
    const updatedRole = state.nodes.find(n => n.id === 'role1');
    const resources = updatedRole?.data.rules[0].resources;
    expect(resources).toEqual(expect.arrayContaining([
      'deployments', 'pods', 'services', 'persistentvolumeclaims', 'configmaps', 'secrets', 'replicasets'
    ]));
  });

  it('syncRoleRulesFromConnections handles no roles or unchanged role rules', () => {
    const podNode: Node = { id: 'pod1', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
    useFlowStore.setState({ nodes: [podNode], edges: [] });

    const { setEdges } = useFlowStore.getState();
    setEdges([]);
    expect(useFlowStore.getState().nodes[0].id).toBe('pod1');

    // Role with matching resources -> isSame returns node
    const roleNode: Node = {
      id: 'role1',
      type: 'Role',
      position: { x: 0, y: 0 },
      data: { rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }] }
    };
    const edge: Edge = { id: 'e1', source: 'role1', target: 'pod1' };
    useFlowStore.setState({ nodes: [roleNode, podNode], edges: [edge] });
    setEdges([edge]);
    expect(useFlowStore.getState().nodes[0].data.rules[0].resources).toEqual(['pods']);
  });

  it('onConnect reroutes connections between Role and child Pod in Deployment', () => {
    const roleNode = { id: 'role1', type: 'Role', position: { x: 0, y: 0 }, data: {} };
    const depNode = { id: 'dep1', type: 'Deployment', position: { x: 100, y: 0 }, data: {} };
    const childPod = { id: 'pod1', type: 'Pod', parentId: 'dep1', position: { x: 120, y: 40 }, data: {} };

    useFlowStore.setState({ nodes: [roleNode, depNode, childPod] as any, edges: [] });

    // Connect Role -> child Pod
    useFlowStore.getState().onConnect({ source: 'role1', target: 'pod1' });
    let edges = useFlowStore.getState().edges;
    expect(edges[0].target).toBe('dep1');

    // Reset edges
    useFlowStore.setState({ edges: [] });

    // Connect child Pod -> Role
    useFlowStore.getState().onConnect({ source: 'pod1', target: 'role1' });
    edges = useFlowStore.getState().edges;
    expect(edges[0].source).toBe('dep1');

    // Connect child Pod (source) to Role (target) with parent Deployment
    const roleTarget = { id: 'role-t', type: 'Role', position: { x: 0, y: 0 }, data: {} };
    const depParent = { id: 'dep-p', type: 'Deployment', position: { x: 100, y: 0 }, data: {} };
    const childPodSource = { id: 'pod-s', type: 'Pod', parentId: 'dep-p', position: { x: 120, y: 40 }, data: {} };
    useFlowStore.setState({ nodes: [roleTarget, depParent, childPodSource] as any, edges: [] });

    useFlowStore.getState().onConnect({ source: 'pod-s', target: 'role-t' });
    const edgesRerouted = useFlowStore.getState().edges;
    expect(edgesRerouted[0].source).toBe('dep-p');
    expect(edgesRerouted[0].target).toBe('role-t');
  });

  it('onConnect handles existing duplicate edge and missing nodes', () => {
    const hpa = { id: 'h1', type: 'HPA', data: {} };
    const dep = { id: 'd1', type: 'Deployment', data: { label: 'd1' } };
    const res = { id: 'r1', type: 'ResourceLimit', data: {} };
    const existingEdge: Edge = { id: 'eh1-d1', source: 'h1', target: 'd1' };
    useFlowStore.setState({ nodes: [hpa, dep, res] as any, edges: [existingEdge] });

    // Connecting existing edge returns state unchanged (line 421 return state)
    useFlowStore.getState().onConnect({ source: 'h1', target: 'd1' });
    expect(useFlowStore.getState().edges).toHaveLength(1);
  });

  it('onConnect validates edges and handles HPA auto-config', () => {
    const hpa = { id: 'h1', type: 'HPA', data: {} };
    const dep = { id: 'd1', type: 'Deployment', data: { label: 'dep', cpuRequest: '100m', memoryRequest: '128Mi' } };
    useFlowStore.setState({ nodes: [hpa, dep] as any, edges: [] });

    const { onConnect } = useFlowStore.getState();
    onConnect({ source: 'h1', target: 'd1' });

    const state = useFlowStore.getState();
    expect(state.edges).toHaveLength(1);

    const updatedDep = state.nodes.find(n => n.id === 'd1');
    expect(updatedDep?.data.cpuRequest).toBe('100m');
    expect(updatedDep?.data.memoryRequest).toBe('128Mi');
  });

  it('validateEdge handles edge with missing source/target nodes and flags invalid connections', () => {
    useFlowStore.setState({ nodes: [] });
    const { validateEdge } = useFlowStore.getState();

    const missingEdge = { id: 'e-missing', source: 'missing1', target: 'missing2' } as any;
    expect(validateEdge(missingEdge)).toEqual(missingEdge);

    const internet = { id: 'i1', type: 'Internet', data: {} };
    const pvc = { id: 'p1', type: 'PVC', data: {} };
    useFlowStore.setState({ nodes: [internet, pvc] as any });

    const edge = { id: 'e1', source: 'i1', target: 'p1' };
    const validated = validateEdge(edge as any);

    expect(validated.data.validationError).toBeDefined();
  });

  it('onReconnect re-routes an existing edge with valid node state', () => {
    const n1 = { id: 'n1', type: 'Service', data: { label: 'svc1' } };
    const n2 = { id: 'n2', type: 'Pod', data: { label: 'pod2' } };
    const n3 = { id: 'n3', type: 'Pod', data: { label: 'pod3' } };
    const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' };
    useFlowStore.setState({ nodes: [n1, n2, n3] as any, edges: [edge] });

    useFlowStore.getState().onReconnect(edge, {
      source: 'n1',
      target: 'n3',
      sourceHandle: 'right',
      targetHandle: 'left',
    });

    const edges = useFlowStore.getState().edges;
    expect(edges[0].target).toBe('n3');
  });

  it('onConnect updates Ingress backendServiceName and Service selector on bidirectional linking', () => {
    // 1. Ingress -> Service
    const ing = { id: 'ing1', type: 'Ingress', data: { label: 'MyIngress' } };
    const svc = { id: 'svc1', type: 'Service', data: { label: 'MyService', serviceType: 'ClusterIP' } };
    useFlowStore.setState({ nodes: [ing, svc] as any, edges: [] });

    useFlowStore.getState().onConnect({ source: 'ing1', target: 'svc1' });

    let state = useFlowStore.getState();
    const updatedIng = state.nodes.find((n) => n.id === 'ing1');
    expect(updatedIng?.data.backendServiceName).toBe('MyService');

    // 2. Service -> Workload (using baseName fallback)
    const svc2 = { id: 'svc2', type: 'Service', data: { label: 'Svc2' } };
    const podBase = { id: 'pod-base', type: 'Pod', data: { baseName: 'my-base-pod' } };
    useFlowStore.setState({ nodes: [svc2, podBase] as any, edges: [] });

    useFlowStore.getState().onConnect({ source: 'svc2', target: 'pod-base' });

    state = useFlowStore.getState();
    const updatedSvc2 = state.nodes.find((n) => n.id === 'svc2');
    expect(updatedSvc2?.data.selector).toBe('my-base-pod');
  });


  it('onConnect auto-corrects serviceType to Headless when Service connects to StatefulSet', () => {
    // 1. Service with ClusterIP connecting to StatefulSet -> auto-sets Headless
    const svc1 = { id: 'svc-headless-1', type: 'Service', data: { label: 'db-svc', serviceType: 'ClusterIP' } };
    const ss1 = { id: 'ss-1', type: 'StatefulSet', data: { label: 'mysql-cluster', port: 3306 } };
    useFlowStore.setState({ nodes: [svc1, ss1] as any, edges: [] });

    useFlowStore.getState().onConnect({ source: 'svc-headless-1', target: 'ss-1' });

    let state = useFlowStore.getState();
    let updatedSvc = state.nodes.find((n) => n.id === 'svc-headless-1');
    expect(updatedSvc?.data.selector).toBe('mysql-cluster');
    expect(updatedSvc?.data.serviceType).toBe('Headless');
    expect(updatedSvc?.data.targetPort).toBe(3306);

    // 2. Service with undefined serviceType connecting to Deployment with workloadType StatefulSet
    const svc2 = { id: 'svc-headless-2', type: 'Service', data: { label: 'db-svc-2' } };
    const ss2 = { id: 'ss-2', type: 'Deployment', data: { label: 'mongo-stateful', workloadType: 'StatefulSet', port: 27017 } };
    useFlowStore.setState({ nodes: [svc2, ss2] as any, edges: [] });

    useFlowStore.getState().onConnect({ source: 'svc-headless-2', target: 'ss-2' });

    state = useFlowStore.getState();
    updatedSvc = state.nodes.find((n) => n.id === 'svc-headless-2');
    expect(updatedSvc?.data.selector).toBe('mongo-stateful');
    expect(updatedSvc?.data.serviceType).toBe('Headless');
    expect(updatedSvc?.data.targetPort).toBe(27017);

    // 3. Service with explicit NodePort does NOT overwrite serviceType
    const svcNp = { id: 'svc-np', type: 'Service', data: { label: 'np-svc', serviceType: 'NodePort' } };
    useFlowStore.setState({ nodes: [svcNp, ss1] as any, edges: [] });

    useFlowStore.getState().onConnect({ source: 'svc-np', target: 'ss-1' });

    state = useFlowStore.getState();
    updatedSvc = state.nodes.find((n) => n.id === 'svc-np');
    expect(updatedSvc?.data.selector).toBe('mysql-cluster');
    expect(updatedSvc?.data.serviceType).toBe('NodePort');
  });

  it('onConnect updates Service selector when Workload connects to Service without selector, but preserves existing selector', () => {
    // 1. Workload -> Service without selector: sets selector
    const depBackend = { id: 'dep-backend', type: 'Deployment', data: { label: 'backend-app', port: 8080 } };
    const svcBackend = { id: 'svc-backend', type: 'Service', data: { label: 'backend-svc' } };
    useFlowStore.setState({ nodes: [depBackend, svcBackend] as any, edges: [] });

    useFlowStore.getState().onConnect({ source: 'dep-backend', target: 'svc-backend' });

    let state = useFlowStore.getState();
    let updatedSvc = state.nodes.find((n) => n.id === 'svc-backend');
    expect(updatedSvc?.data.selector).toBe('backend-app');
    expect(updatedSvc?.data.targetPort).toBe(8080);

    // 2. Workload B -> Service with existing selector for Workload A: does NOT overwrite selector
    const depFrontend = { id: 'dep-frontend', type: 'Deployment', data: { label: 'frontend-app', port: 3000 } };
    useFlowStore.setState({ nodes: [depBackend, depFrontend, updatedSvc] as any, edges: state.edges });

    useFlowStore.getState().onConnect({ source: 'dep-frontend', target: 'svc-backend' });

    state = useFlowStore.getState();
    updatedSvc = state.nodes.find((n) => n.id === 'svc-backend');
    expect(updatedSvc?.data.selector).toBe('backend-app');
    expect(state.edges).toHaveLength(2);
  });

  it('onQuickConnect connects nodes in orthogonal directions (right, left, top, bottom) and logs action', () => {
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
    expect(useFlowStore.getState().lastActionName).toBe('Connect Nodes');

    useFlowStore.getState().onQuickConnect('center', 'left');
    expect(useFlowStore.getState().edges.some((e) => e.target === 'leftN')).toBe(true);

    useFlowStore.getState().onQuickConnect('center', 'top');
    expect(useFlowStore.getState().edges.some((e) => e.target === 'topN')).toBe(true);

    useFlowStore.getState().onQuickConnect('center', 'bottom');
    expect(useFlowStore.getState().edges.some((e) => e.target === 'bottomN')).toBe(true);
  });

  it('onQuickConnect returns early when source node is missing or no candidates match direction', () => {
    useFlowStore.setState({ nodes: [], edges: [] });
    useFlowStore.getState().onQuickConnect('nonexistent', 'right');
    expect(useFlowStore.getState().edges).toHaveLength(0);

    const centerNode: Node = { id: 'center', type: 'Pod', position: { x: 100, y: 100 }, data: {} };
    // Node positioned at bottom-right (not top)
    const bottomRightNode: Node = { id: 'br', type: 'Pod', position: { x: 300, y: 300 }, data: {} };
    useFlowStore.setState({ nodes: [centerNode, bottomRightNode], edges: [] });
    useFlowStore.getState().onQuickConnect('center', 'top');
    expect(useFlowStore.getState().edges).toHaveLength(0);
  });

  it('autoLayout triggers dagre layout in LR and TB directions with parent nodes', () => {
    const parentNode = { id: 'p1', position: { x: 0, y: 0 }, width: 300, height: 200, data: {} };
    const childNode = { id: 'c1', parentId: 'p1', position: { x: 10, y: 10 }, width: 100, height: 100, data: {} };
    const node2 = { id: 'n2', position: { x: 0, y: 0 }, width: 100, height: 100, data: {} };
    const edge = { id: 'e1', source: 'p1', target: 'n2' };
    useFlowStore.setState({ nodes: [parentNode, childNode, node2] as any, edges: [edge] as any });

    const { autoLayout } = useFlowStore.getState();
    autoLayout('TB');

    const state = useFlowStore.getState();
    expect(state.lastActionName).toBe('Auto Layout');
    expect(state.nodes.find(n => n.id === 'c1')?.position).toEqual({ x: 10, y: 10 });
  });

  it('onEdgesChange updates selected state and handles edge deletion with live log commands', () => {
    const node1: Node = { id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
    const node2: Node = { id: 'n2', type: 'Service', position: { x: 100, y: 0 }, data: { label: 'svc-1' } };
    const edge: Edge = { id: 'e1', source: 'n1', target: 'n2', selected: false };
    useFlowStore.setState({ nodes: [node1, node2], edges: [edge] });

    useFlowStore.getState().onEdgesChange([{ id: 'e1', type: 'select', selected: true }]);
    expect(useFlowStore.getState().edges[0].selected).toBe(true);

    useFlowStore.getState().onEdgesChange([{ id: 'e1', type: 'remove' }]);
    expect(useFlowStore.getState().edges).toHaveLength(0);
    expect(useFlowStore.getState().lastActionName).toBe('Delete Edge');
  });

  it('onEdgesChange clears Service selector when Service outgoing edge to workload is removed', () => {
    const svcNode: Node = { id: 's1', type: 'Service', position: { x: 0, y: 0 }, data: { label: 'web-svc', selector: 'web-pod' } };
    const podNode: Node = { id: 'p1', type: 'Pod', position: { x: 100, y: 0 }, data: { label: 'web-pod' } };
    const edge: Edge = { id: 'e-s1-p1', source: 's1', target: 'p1' };

    useFlowStore.setState({ nodes: [svcNode, podNode], edges: [edge] });

    useFlowStore.getState().onEdgesChange([{ id: 'e-s1-p1', type: 'remove' }]);

    const state = useFlowStore.getState();
    expect(state.edges).toHaveLength(0);
    expect(state.nodes.find(n => n.id === 's1')?.data.selector).toBe('');
  });

  it('onEdgesChange clears Service selector when incoming edge from workload (Workload -> Service) is removed and preserves selector if incoming edge matches', () => {
    const svcNode: Node = { id: 's-in', type: 'Service', position: { x: 0, y: 0 }, data: { label: 'web-svc', selector: 'web-pod' } };
    const podNode: Node = { id: 'p-in', type: 'Pod', position: { x: 100, y: 0 }, data: { label: 'web-pod' } };
    const edgeIncoming: Edge = { id: 'e-p-to-s', source: 'p-in', target: 's-in' };

    // 1. Edge change removing an unrelated edge does not clear selector because e-p-to-s (edge.target === serviceNodeId) matches
    const dummyEdge: Edge = { id: 'e-dummy', source: 'other-1', target: 'other-2' };
    useFlowStore.setState({ nodes: [svcNode, podNode] as any, edges: [edgeIncoming, dummyEdge] });
    useFlowStore.getState().onEdgesChange([{ id: 'e-dummy', type: 'remove' }]);

    let state = useFlowStore.getState();
    expect(state.nodes.find((n) => n.id === 's-in')?.data.selector).toBe('web-pod');

    // 2. Removing the incoming edge e-p-to-s clears the selector
    useFlowStore.getState().onEdgesChange([{ id: 'e-p-to-s', type: 'remove' }]);
    state = useFlowStore.getState();
    expect(state.nodes.find((n) => n.id === 's-in')?.data.selector).toBe('');
  });

  it('onConnect rejects connection when source or target node is forbidden for active user', () => {
    const devUser = {
      id: 'dev1',
      username: 'dev-user',
      policies: [{ name: 'ContainerDeveloperPolicy', description: 'Dev' }],
      roles: [],
    };
    const svcNode = { id: 'svc1', type: 'Service', data: {} };
    const podNode = { id: 'pod1', type: 'Pod', data: {} };
    const addLogSpy = vi.fn();

    useFlowStore.setState({
      nodes: [svcNode, podNode] as any,
      edges: [],
      activeIdentity: 'dev-user',
      iamUsers: [devUser] as any,
      addLog: addLogSpy,
    });

    useFlowStore.getState().onConnect({ source: 'svc1', target: 'pod1' });

    expect(useFlowStore.getState().edges).toHaveLength(0);
    expect(addLogSpy).toHaveBeenCalledWith('warn', expect.stringContaining('Connection rejected: User "dev-user" cannot connect forbidden card(s).'), 'UI');
  });

  it('onConnect blocks HPA connection when target workload lacks Resource Limit prerequisite', () => {
    const hpaNode = { id: 'hpa1', type: 'HPA', data: {} };
    const depNode = { id: 'dep1', type: 'Deployment', data: { label: 'my-dep' } };
    const addLogSpy = vi.fn();

    useFlowStore.setState({
      nodes: [hpaNode, depNode] as any,
      edges: [],
      addLog: addLogSpy,
    });

    useFlowStore.getState().onConnect({ source: 'hpa1', target: 'dep1' });

    expect(useFlowStore.getState().edges).toHaveLength(0);
    expect(addLogSpy).toHaveBeenCalledWith('error', expect.stringContaining('Resource Limit is required on target workload before attaching HPA.'), 'UI');
  });

  it('onConnect reroutes child pod in ReplicaSet and updates PVC status on connection', () => {
    const rsNode = { id: 'rs1', type: 'ReplicaSet', data: {} };
    const childPod = { id: 'pod1', type: 'Pod', parentId: 'rs1', data: { parentId: 'rs1' } };
    const pvcNode = { id: 'pvc1', type: 'PVC', data: { pvcStatus: 'Pending' } };

    useFlowStore.setState({
      nodes: [rsNode, childPod, pvcNode] as any,
      edges: [],
    });

    useFlowStore.getState().onConnect({ source: 'pod1', target: 'pvc1' });

    const edges = useFlowStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('rs1');
    expect(edges[0].target).toBe('pvc1');
  });

  it('onConnect handles invalid connection with error log and edge validation error', () => {
    const internet = { id: 'i1', type: 'Internet', data: {} };
    const pvc = { id: 'p1', type: 'PVC', data: {} };
    useFlowStore.setState({ nodes: [internet, pvc] as any, edges: [] });

    useFlowStore.getState().onConnect({ source: 'i1', target: 'p1' });

    const edges = useFlowStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].data?.validationError).toBeDefined();
  });

  it('onConnect flags validationError and emits warning log on cross-namespace connection', () => {
    const addLogSpy = vi.fn();
    const ns1 = { id: 'ns1', type: 'Namespace', data: { label: 'ns-1' }, position: { x: 0, y: 0 } };
    const ns2 = { id: 'ns2', type: 'Namespace', data: { label: 'ns-2' }, position: { x: 0, y: 0 } };
    const svc1 = { id: 'svc1', type: 'Service', parentId: 'ns1', data: { serviceType: 'ClusterIP' }, position: { x: 0, y: 0 } };
    const pod2 = { id: 'pod2', type: 'Pod', parentId: 'ns2', data: { label: 'pod-2' }, position: { x: 0, y: 0 } };

    useFlowStore.setState({
      nodes: [ns1, ns2, svc1, pod2] as any,
      edges: [],
      addLog: addLogSpy,
    });

    useFlowStore.getState().onConnect({ source: 'svc1', target: 'pod2' });

    const edges = useFlowStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].data?.validationError).toContain('Cross-namespace connection is not allowed');
    expect(addLogSpy).toHaveBeenCalledWith('warn', expect.stringContaining('Cross-namespace connection is not allowed'), 'UI');
  });

  it('onConnect handles parented source and target nodes with container handles', () => {
    const ns = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: {} };
    const pod1 = { id: 'p1', type: 'Pod', parentId: 'ns1', position: { x: 10, y: 10 }, data: {} };
    const pod2 = { id: 'p2', type: 'Pod', parentId: 'ns1', position: { x: 100, y: 10 }, data: {} };

    useFlowStore.setState({ nodes: [ns, pod1, pod2] as any, edges: [] });

    useFlowStore.getState().onConnect({ source: 'p1', target: 'p2' });
    expect(useFlowStore.getState().edges).toHaveLength(1);
  });

  describe('onNodesChange with dimensions changes', () => {
    it('synchronizes Deployment parent layout on child dimension change', () => {
      const depNode = { id: 'dep1', type: 'Deployment', position: { x: 0, y: 0 }, data: { replicas: 1, label: 'dep-1' } };
      const podNode = { id: 'pod1', type: 'Pod', parentId: 'dep1', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
      useFlowStore.setState({ nodes: [depNode, podNode] as any });

      const { onNodesChange } = useFlowStore.getState();
      onNodesChange([{ id: 'pod1', type: 'dimensions', dimensions: { width: 200, height: 100 } }]);

      const state = useFlowStore.getState();
      expect(state.nodes.some(n => n.id === 'dep1')).toBe(true);
      expect(state.nodes.some(n => n.id === 'pod1')).toBe(true);
    });

    it('synchronizes StatefulSet parent layout on child dimension change', () => {
      const ssNode = { id: 'ss1', type: 'StatefulSet', position: { x: 0, y: 0 }, data: { replicas: 1, label: 'ss-1' } };
      const podNode = { id: 'pod1', type: 'Pod', parentId: 'ss1', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
      useFlowStore.setState({ nodes: [ssNode, podNode] as any });

      const { onNodesChange } = useFlowStore.getState();
      onNodesChange([{ id: 'pod1', type: 'dimensions', dimensions: { width: 200, height: 100 } }]);

      const state = useFlowStore.getState();
      expect(state.nodes.some(n => n.id === 'ss1')).toBe(true);
      expect(state.nodes.some(n => n.id === 'pod1')).toBe(true);
    });

    it('synchronizes ReplicaSet parent layout on child dimension change', () => {
      const rsNode = { id: 'rs1', type: 'ReplicaSet', position: { x: 0, y: 0 }, data: { replicas: 1, label: 'rs-1' } };
      const podNode = { id: 'pod1', type: 'Pod', parentId: 'rs1', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
      useFlowStore.setState({ nodes: [rsNode, podNode] as any });

      const { onNodesChange } = useFlowStore.getState();
      onNodesChange([{ id: 'pod1', type: 'dimensions', dimensions: { width: 200, height: 100 } }]);

      const state = useFlowStore.getState();
      expect(state.nodes.some(n => n.id === 'rs1')).toBe(true);
      expect(state.nodes.some(n => n.id === 'pod1')).toBe(true);
    });

    it('synchronizes non-workload container (e.g. Namespace) on child dimension change', () => {
      const nsNode = { id: 'ns1', type: 'Namespace', position: { x: 0, y: 0 }, data: { label: 'ns-1' } };
      const podNode = { id: 'pod1', type: 'Pod', parentId: 'ns1', position: { x: 10, y: 10 }, data: { label: 'pod-1' } };
      useFlowStore.setState({ nodes: [nsNode, podNode] as any });

      const { onNodesChange } = useFlowStore.getState();
      onNodesChange([{ id: 'pod1', type: 'dimensions', dimensions: { width: 200, height: 100 } }]);

      const state = useFlowStore.getState();
      expect(state.nodes.some(n => n.id === 'ns1')).toBe(true);
    });

    it('handles child node with missing or unknown parentId on dimension change', () => {
      const podNode = { id: 'pod1', type: 'Pod', parentId: 'missing-parent', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
      useFlowStore.setState({ nodes: [podNode] as any });

      const { onNodesChange } = useFlowStore.getState();
      onNodesChange([{ id: 'pod1', type: 'dimensions', dimensions: { width: 200, height: 100 } }]);

      expect(useFlowStore.getState().nodes).toHaveLength(1);
    });

    it('handles dimension change on standalone node without parentId', () => {
      const podNode = { id: 'pod1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod-1' } };
      useFlowStore.setState({ nodes: [podNode] as any });

      const { onNodesChange } = useFlowStore.getState();
      onNodesChange([{ id: 'pod1', type: 'dimensions', dimensions: { width: 200, height: 100 } }]);

      expect(useFlowStore.getState().nodes).toHaveLength(1);
    });
  });

  it('onConnect promotes Ingress to multi-path ingressPaths when connected to multiple Services', () => {
    const ingress = {
      id: 'ing-1',
      type: 'Ingress',
      position: { x: 0, y: 0 },
      data: { label: 'main-ing', ingressPath: '/api' },
    };
    const svc1 = { id: 'svc-1', type: 'Service', position: { x: 100, y: 0 }, data: { label: 'api-svc', port: 8080 } };
    const svc2 = { id: 'svc-2', type: 'Service', position: { x: 100, y: 100 }, data: { label: 'pay-svc', port: 3000 } };
    const svc3 = { id: 'svc-3', type: 'Service', position: { x: 100, y: 200 }, data: { label: 'web-svc', port: 80 } };

    useFlowStore.setState({
      nodes: [ingress, svc1, svc2, svc3] as any,
      edges: [],
    });

    // 1. Connect first service -> sets backendServiceName and servicePort
    useFlowStore.getState().onConnect({ source: 'ing-1', target: 'svc-1' });
    let ingNode = useFlowStore.getState().nodes.find((n) => n.id === 'ing-1')!;
    expect(ingNode.data.backendServiceName).toBe('api-svc');
    expect(ingNode.data.servicePort).toBe(8080);

    // 2. Connect second service -> promotes to 2-item ingressPaths
    useFlowStore.getState().onConnect({ source: 'ing-1', target: 'svc-2' });
    ingNode = useFlowStore.getState().nodes.find((n) => n.id === 'ing-1')!;
    expect(ingNode.data.ingressPaths).toHaveLength(2);
    expect((ingNode.data.ingressPaths as any[])[0]).toMatchObject({
      path: '/api',
      serviceName: 'api-svc',
      servicePort: 8080,
    });
    expect((ingNode.data.ingressPaths as any[])[1]).toMatchObject({
      path: '/path-2',
      serviceName: 'pay-svc',
      servicePort: 3000,
    });

    // 3. Connect third service -> appends 3rd path rule
    useFlowStore.getState().onConnect({ source: 'ing-1', target: 'svc-3' });
    ingNode = useFlowStore.getState().nodes.find((n) => n.id === 'ing-1')!;
    expect(ingNode.data.ingressPaths).toHaveLength(3);
    expect((ingNode.data.ingressPaths as any[])[2]).toMatchObject({
      path: '/path-3',
      serviceName: 'web-svc',
      servicePort: 80,
    });

    // 4. Removing edge from ing-1 to svc-1 clears api-svc from ingressPaths and falls back backendServiceName to pay-svc
    const edgeToSvc1 = useFlowStore.getState().edges.find((e) => e.source === 'ing-1' && e.target === 'svc-1')!;
    useFlowStore.getState().onEdgesChange([{ id: edgeToSvc1.id, type: 'remove' }]);
    ingNode = useFlowStore.getState().nodes.find((n) => n.id === 'ing-1')!;
    expect(ingNode.data.backendServiceName).toBe('pay-svc');
    expect((ingNode.data.ingressPaths as any[])[0].serviceName).toBe('');
  });

  it('onConnect sets selector when LoadBalancer Service connects to Ingress or Service connects to StatefulSet', () => {
    const lbSvc = {
      id: 'svc-lb',
      type: 'Service',
      position: { x: 0, y: 0 },
      data: { label: 'lb-svc', serviceType: 'LoadBalancer' },
    };
    const clusterSvc = {
      id: 'svc-cip',
      type: 'Service',
      position: { x: 0, y: 100 },
      data: { label: 'cip-svc', serviceType: 'ClusterIP' },
    };
    const ingress = {
      id: 'ing-target',
      type: 'Ingress',
      position: { x: 200, y: 0 },
      data: { label: 'edge-ingress' },
    };
    const ingress2 = {
      id: 'ing-target-2',
      type: 'Ingress',
      position: { x: 200, y: 50 },
      data: { label: 'second-ingress' },
    };
    const statefulSet = {
      id: 'ss-target',
      type: 'StatefulSet',
      position: { x: 200, y: 100 },
      data: { label: 'db-statefulset', port: 5432 },
    };

    useFlowStore.setState({
      nodes: [lbSvc, clusterSvc, ingress, ingress2, statefulSet] as any,
      edges: [],
    });

    useFlowStore.getState().onConnect({ source: 'svc-lb', target: 'ing-target' });
    let updatedLb = useFlowStore.getState().nodes.find((n) => n.id === 'svc-lb')!;
    expect(updatedLb.data.selector).toBe('edge-ingress');
    expect(updatedLb.data.ingressTargets).toEqual(['edge-ingress']);

    useFlowStore.getState().onConnect({ source: 'svc-lb', target: 'ing-target-2' });
    updatedLb = useFlowStore.getState().nodes.find((n) => n.id === 'svc-lb')!;
    expect(updatedLb.data.ingressTargets).toEqual(['edge-ingress', 'second-ingress']);

    const firstLbEdge = useFlowStore.getState().edges.find((e) => e.source === 'svc-lb' && e.target === 'ing-target')!;
    useFlowStore.getState().onEdgesChange([{ id: firstLbEdge.id, type: 'remove' }]);
    updatedLb = useFlowStore.getState().nodes.find((n) => n.id === 'svc-lb')!;
    expect(updatedLb.data.ingressTargets).toEqual(['second-ingress']);
    expect(updatedLb.data.selector).toBe('second-ingress');

    useFlowStore.getState().onConnect({ source: 'svc-cip', target: 'ss-target' });
    const updatedCip = useFlowStore.getState().nodes.find((n) => n.id === 'svc-cip')!;
    expect(updatedCip.data.selector).toBe('db-statefulset');
    expect(updatedCip.data.targetPort).toBe(5432);

    // Connecting LoadBalancer (that had ingressTargets) to StatefulSet clears ingressTargets
    useFlowStore.getState().onConnect({ source: 'svc-lb', target: 'ss-target' });
    updatedLb = useFlowStore.getState().nodes.find((n) => n.id === 'svc-lb')!;
    expect(updatedLb.data.selector).toBe('db-statefulset');
    expect(updatedLb.data.ingressTargets).toBeUndefined();

    // Connecting child Pod to Role reroutes sourceId to parent Deployment
    useFlowStore.setState({
      nodes: [
        { id: 'dep-r', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'dep-r' } },
        { id: 'pod-r', type: 'Pod', parentId: 'dep-r', position: { x: 10, y: 10 }, data: { label: 'pod-r' } },
        { id: 'role-r', type: 'Role', position: { x: 200, y: 0 }, data: { label: 'role-r', rules: [{ apiGroups: [''], resources: [], verbs: ['get'] }] } },
      ] as any,
      edges: [],
    });
    useFlowStore.getState().onConnect({ source: 'pod-r', target: 'role-r' });
    expect(useFlowStore.getState().edges[0]?.source).toBe('dep-r');

    // onQuickConnect sorts multiple candidate nodes in the same direction by distance
    useFlowStore.setState({
      nodes: [
        { id: 'qc-svc', type: 'Service', position: { x: 0, y: 0 }, width: 150, height: 100, data: { label: 'qc-svc' } },
        { id: 'qc-dep-far', type: 'Deployment', position: { x: 500, y: 0 }, width: 150, height: 100, data: { label: 'far-dep' } },
        { id: 'qc-dep-near', type: 'Deployment', position: { x: 250, y: 0 }, width: 150, height: 100, data: { label: 'near-dep' } },
      ] as any,
      edges: [],
    });
    useFlowStore.getState().onQuickConnect('qc-svc', 'right');
    expect(useFlowStore.getState().edges[0]?.target).toBe('qc-dep-near');
  });

  describe('validateEdge with PVC Volume Claim Template topology', () => {
    it('covers all branch conditions in checkPvcTopologyError', () => {
      const pvc = { id: 'pvc-topo', type: 'PVC', position: { x: 0, y: 0 }, data: { label: 'topo-pvc' } };
      const ss = { id: 'ss-topo', type: 'StatefulSet', position: { x: 100, y: 0 }, data: { label: 'topo-ss', workloadType: 'StatefulSet' } };
      const dep = { id: 'dep-topo', type: 'Deployment', position: { x: 200, y: 0 }, data: { label: 'topo-dep' } };
      const svc = { id: 'svc-topo', type: 'Service', position: { x: 300, y: 0 }, data: { label: 'topo-svc' } };

      useFlowStore.setState({
        nodes: [pvc, ss, dep, svc] as any,
        edges: [],
      });

      const { validateEdge } = useFlowStore.getState();

      // 1. Non-PVC edge -> returns no PVC topology error
      const nonPvcEdge = validateEdge({ id: 'e-non-pvc', source: 'svc-topo', target: 'dep-topo' } as any);
      expect(nonPvcEdge.data?.validationError).toBeFalsy();

      // 2. PVC as target, connecting to Deployment when PVC already has incoming edge from StatefulSet
      // Also tests e.id === edge.id (continue), unrelated edges (return null), and missing node in nodes.find
      useFlowStore.setState({
        edges: [
          { id: 'e-existing-ss', source: 'ss-topo', target: 'pvc-topo' },
          { id: 'e-self', source: 'dep-topo', target: 'pvc-topo' },
          { id: 'e-unrelated', source: 'svc-topo', target: 'dep-topo' },
          { id: 'e-ghost', source: 'ghost-node', target: 'pvc-topo' }, // node not in store
        ] as any,
      });

      const depEdge = validateEdge({ id: 'e-self', source: 'dep-topo', target: 'pvc-topo' } as any);
      expect(depEdge.data?.validationError).toContain('Volume Claim Template Conflict');

      // 3. Existing edge from PVC to StatefulSet (reversed edge direction where PVC is source)
      useFlowStore.setState({
        edges: [
          { id: 'e-existing-out-ss', source: 'pvc-topo', target: 'ss-topo' },
          { id: 'e-ghost-out', source: 'pvc-topo', target: 'ghost-out' }, // node not in store
        ] as any,
      });

      const depEdgeReverse = validateEdge({ id: 'e-prop', source: 'dep-topo', target: 'pvc-topo' } as any);
      expect(depEdgeReverse.data?.validationError).toContain('Volume Claim Template Conflict');
    });
  });

  it('reroutes role connection when child pod is source and Role is target', () => {
    const dep = { id: 'dep-parent', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'dep-parent' } };
    const pod = { id: 'pod-child', type: 'Pod', parentId: 'dep-parent', position: { x: 0, y: 0 }, data: { label: 'pod-child' } };
    const role = { id: 'role-1', type: 'Role', position: { x: 100, y: 0 }, data: { label: 'role-1' } };

    useFlowStore.setState({
      nodes: [dep, pod, role] as any,
      edges: [],
    });

    useFlowStore.getState().onConnect({ source: 'pod-child', target: 'role-1' });

    const edges = useFlowStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('dep-parent');
    expect(edges[0].target).toBe('role-1');
  });

  it('synchronizes realtime PVC state during onEdgesChange when PVC nodes exist', () => {
    const pvc = { id: 'pvc-sync', type: 'PVC', position: { x: 0, y: 0 }, data: { pvcStatus: 'Pending' } };
    const dep = { id: 'dep-sync', type: 'Deployment', position: { x: 100, y: 0 }, data: { label: 'dep-sync' } };
    const edge = { id: 'e-sync', source: 'dep-sync', target: 'pvc-sync' };

    useFlowStore.setState({
      nodes: [pvc, dep] as any,
      edges: [edge] as any,
    });

    useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-sync' }]);
    expect(useFlowStore.getState().edges).toHaveLength(0);
  });

  it('keeps existing ingress config when target service is already present in ingressPaths', () => {
    const ingressNode = {
      id: 'ing-existing',
      type: 'Ingress',
      position: { x: 0, y: 0 },
      data: {
        label: 'my-ingress',
        backendServiceName: 'svc-app',
        ingressPaths: [{ path: '/api', serviceName: 'svc-app', port: 8080 }],
      },
    };
    const svcNode = {
      id: 'svc-app-id',
      type: 'Service',
      position: { x: 100, y: 0 },
      data: { label: 'svc-app', serviceType: 'ClusterIP', port: 8080 },
    };

    useFlowStore.setState({
      nodes: [ingressNode, svcNode] as any,
      edges: [],
    });

    useFlowStore.getState().onConnect({ source: 'ing-existing', target: 'svc-app-id' });
    const updatedIngress = useFlowStore.getState().nodes.find((n) => n.id === 'ing-existing');
    expect(updatedIngress?.data?.backendServiceName).toBe('svc-app');
  });

  it('handles invalid direction in quick connect gracefully', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'qc-src', type: 'Service', position: { x: 0, y: 0 }, width: 100, height: 50, data: {} },
        { id: 'qc-target', type: 'Deployment', position: { x: 100, y: 0 }, width: 100, height: 50, data: {} },
      ] as any,
      edges: [],
    });

    useFlowStore.getState().onQuickConnect('qc-src', 'unknown-dir' as any);
    expect(useFlowStore.getState().edges).toHaveLength(0);
  });

  describe('uncovered branch conditions in createFlowSlice', () => {
    it('covers Ingress and Service edge removal reconciliation branches', () => {
      // 1. collectRemovedIngressServices with target service having no data.label (fallback to tNode.id)
      const ingNode: Node = {
        id: 'ing-1',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: {
          backendServiceName: 'svc-no-lbl',
          ingressPaths: [
            { path: '/api', serviceName: 'svc-no-lbl' },
            { path: '/web', serviceName: 'svc-remaining' },
          ],
        },
      };
      const svcNoLbl: Node = {
        id: 'svc-no-lbl',
        type: 'Service',
        position: { x: 100, y: 0 },
        data: {}, // no label
      };
      const edgeIng = { id: 'e-ing-svc', source: 'ing-1', target: 'svc-no-lbl' };

      useFlowStore.setState({
        nodes: [ingNode, svcNoLbl] as any,
        edges: [edgeIng] as any,
      });

      useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-ing-svc' }]);
      const updatedIng = useFlowStore.getState().nodes.find((n) => n.id === 'ing-1');
      expect(updatedIng?.data?.backendServiceName).toBe('svc-remaining');

      // 2. clearRemovedIngressServicesFromPaths when rawPaths is not an array
      const ingNonArrayPaths: Node = {
        id: 'ing-non-arr',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: { backendServiceName: 'svc-del', ingressPaths: 'invalid-paths' as any },
      };
      const svcDel: Node = { id: 'svc-del', type: 'Service', position: { x: 0, y: 0 }, data: { label: 'svc-del' } };
      useFlowStore.setState({
        nodes: [ingNonArrayPaths, svcDel] as any,
        edges: [{ id: 'e-del', source: 'ing-non-arr', target: 'svc-del' }] as any,
      });
      useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-del' }]);
      const resNonArr = useFlowStore.getState().nodes.find((n) => n.id === 'ing-non-arr');
      expect(resNonArr?.data?.backendServiceName).toBe('');

      // 3. reconcileIngressOnRemovedEdges when no backend match and no paths match
      const ingNoMatch: Node = {
        id: 'ing-nomatch',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: { backendServiceName: 'other-svc', ingressPaths: [{ path: '/', serviceName: 'other-svc' }] },
      };
      useFlowStore.setState({
        nodes: [ingNoMatch, svcDel] as any,
        edges: [{ id: 'e-del2', source: 'ing-nomatch', target: 'svc-del' }] as any,
      });
      useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-del2' }]);
      const resNoMatch = useFlowStore.getState().nodes.find((n) => n.id === 'ing-nomatch');
      expect(resNoMatch?.data?.backendServiceName).toBe('other-svc');

      // 4. reconcileIngressOnRemovedEdges with backend match only (no paths match) and empty remaining paths
      const ingBackendOnly: Node = {
        id: 'ing-bo',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: { backendServiceName: 'svc-del', ingressPaths: [] },
      };
      useFlowStore.setState({
        nodes: [ingBackendOnly, svcDel] as any,
        edges: [{ id: 'e-bo', source: 'ing-bo', target: 'svc-del' }] as any,
      });
      useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-bo' }]);
      const resBo = useFlowStore.getState().nodes.find((n) => n.id === 'ing-bo');
      expect(resBo?.data?.backendServiceName).toBe('');

      // 5. isServiceEdgeMatching fallback to baseName and id
      const svcNode: Node = {
        id: 'svc-matching',
        type: 'Service',
        position: { x: 0, y: 0 },
        data: { selector: 'target-basename', ingressTargets: ['target-basename', 'target-id-only'] },
      };
      const targetBaseNameNode: Node = {
        id: 't-bn-id',
        type: 'Deployment',
        position: { x: 100, y: 0 },
        data: { baseName: 'target-basename' }, // no label
      };
      const targetIdOnlyNode: Node = {
        id: 'target-id-only',
        type: 'Deployment',
        position: { x: 200, y: 0 },
        data: {}, // no label, no baseName
      };
      useFlowStore.setState({
        nodes: [svcNode, targetBaseNameNode, targetIdOnlyNode] as any,
        edges: [
          { id: 'e-bn', source: 'svc-matching', target: 't-bn-id' },
          { id: 'e-id', source: 'svc-matching', target: 'target-id-only' },
          { id: 'e-other-source', source: 'other-node', target: 't-bn-id' },
          { id: 'e-missing-target', source: 'svc-matching', target: 'non-existent-node' },
        ] as any,
      });

      // Remove e-bn, leaving target-id-only
      useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-bn' }]);
      const updatedSvc = useFlowStore.getState().nodes.find((n) => n.id === 'svc-matching');
      expect(updatedSvc?.data?.selector).toBe('target-id-only');

      // Remove e-id, leaving 0 targets (covers remainingTargets[0] || '' and ingressTargets: undefined)
      useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-id' }]);
      const emptySvc = useFlowStore.getState().nodes.find((n) => n.id === 'svc-matching');
      expect(emptySvc?.data?.selector).toBe('');
      expect(emptySvc?.data?.ingressTargets).toBeUndefined();

      // 6. Service with plain selector without match in nextEdges
      const svcSgl: Node = {
        id: 'svc-sgl',
        type: 'Service',
        position: { x: 0, y: 0 },
        data: { selector: 'missing-app' },
      };
      useFlowStore.setState({
        nodes: [svcSgl] as any,
        edges: [{ id: 'e-dummy', source: 'other', target: 'other' }] as any,
      });
      useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-dummy' }]);
      expect(useFlowStore.getState().nodes.find((n) => n.id === 'svc-sgl')?.data?.selector).toBe('');
    });

    it('covers emitRemovedEdgeCommands edge cases: missing id, missing removed edge, missing sNode/label', () => {
      const mockEdge = { id: 'e-valid', source: 's-missing-label', target: 't-node' };
      const sNodeNoLabel = { id: 's-missing-label', type: 'Pod', position: { x: 0, y: 0 }, data: {} };
      const tNode = { id: 't-node', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'target-lbl' } };

      useFlowStore.setState({
        nodes: [sNodeNoLabel, tNode] as any,
        edges: [mockEdge] as any,
      });

      // Pass change without id, change with missing edge id, and valid change with sNode missing label
      useFlowStore.getState().onEdgesChange([
        { type: 'remove' } as any, // missing 'id'
        { type: 'remove', id: 'e-nonexistent' } as any,
        { type: 'remove', id: 'e-valid' },
      ]);
      expect(useFlowStore.getState().edges).toHaveLength(0);
    });

    it('covers Ingress connection endpoint updates: fallback to id/tgtId, existing backend preservation, and default path/port', () => {
      // 1. Ingress with existing backendServiceName preserved
      const ingNode: Node = {
        id: 'ing-target',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: { backendServiceName: 'pre-existing-svc', ingressPath: '', servicePort: undefined },
      };
      // Target service without label in store
      const svcIdOnly: Node = {
        id: 'svc-id-only',
        type: 'Service',
        position: { x: 100, y: 0 },
        data: {}, // no label
      };
      useFlowStore.setState({
        nodes: [ingNode, svcIdOnly] as any,
        edges: [],
      });

      useFlowStore.getState().onConnect({ source: 'ing-target', target: 'svc-id-only' });
      const updatedIng = useFlowStore.getState().nodes.find((n) => n.id === 'ing-target');
      expect(updatedIng?.data?.backendServiceName).toBe('pre-existing-svc');
      // Default ingressPath '/' and port 80 are applied
      expect(updatedIng?.data?.ingressPaths?.[0]?.path).toBe('/');
      expect(updatedIng?.data?.ingressPaths?.[0]?.servicePort).toBe(80);

      // 2. Ingress with undefined data connecting to Service without label (fallback to id)
      const ingNodeNoData: Node = {
        id: 'ing-nodata',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: undefined as any,
      };
      const svcWithPortNoLabel: Node = {
        id: 'svc-custom-port',
        type: 'Service',
        position: { x: 100, y: 0 },
        data: { port: 8080 },
      };
      useFlowStore.setState({
        nodes: [ingNodeNoData, svcWithPortNoLabel] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'ing-nodata', target: 'svc-custom-port' });
      const updatedIngNoData = useFlowStore.getState().nodes.find((n) => n.id === 'ing-nodata');
      expect(updatedIngNoData?.data?.backendServiceName).toBe('svc-custom-port');
      expect(updatedIngNoData?.data?.servicePort).toBe(8080);
    });

    it('covers deriveRoleResources and syncRoleRulesFromConnections branches: StatefulSet, 0 replicas workload, untyped nodes, empty rules', () => {
      // Role node with empty rules
      const roleNode: Node = {
        id: 'role-empty',
        type: 'Role',
        position: { x: 0, y: 0 },
        data: { rules: [] },
      };
      // StatefulSet controller
      const ssNode: Node = {
        id: 'ss-ctrl',
        type: 'StatefulSet',
        position: { x: 100, y: 0 },
        data: { replicas: 1 },
      };
      // Deployment with 0 replicas and 0 child pods
      const zeroRepDep: Node = {
        id: 'zero-dep',
        type: 'Deployment',
        position: { x: 200, y: 0 },
        data: { replicas: 0 },
      };
      // Node with unknown type
      const unknownNode: Node = {
        id: 'untyped-node',
        type: undefined as any,
        position: { x: 300, y: 0 },
        data: {},
      };

      const edges: Edge[] = [
        { id: 'e1', source: 'role-empty', target: 'ss-ctrl' },
        { id: 'e2', source: 'role-empty', target: 'zero-dep' },
        { id: 'e3', source: 'role-empty', target: 'untyped-node' },
      ];

      useFlowStore.setState({
        nodes: [roleNode, ssNode, zeroRepDep, unknownNode] as any,
        edges,
      });

      // Trigger syncRoleRulesFromConnections via setEdges
      useFlowStore.getState().setEdges(edges);

      const updatedRole = useFlowStore.getState().nodes.find((n) => n.id === 'role-empty');
      const rules = updatedRole?.data?.rules;
      expect(rules).toBeDefined();
      expect(rules[0].resources).toContain('statefulsets');
      expect(rules[0].resources).toContain('pods');
    });

    it('covers computeAutoLayout fallback dimensions when measured and width/height are missing', () => {
      const nodeNoDim1: Node = {
        id: 'dim1',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        width: undefined,
        height: undefined,
        measured: undefined,
        data: {},
      };
      const nodeNoDim2: Node = {
        id: 'dim2',
        type: 'Service',
        position: { x: 0, y: 0 },
        width: undefined,
        height: undefined,
        measured: undefined,
        data: {},
      };
      const childPodNoDim: Node = {
        id: 'child-dim',
        type: 'Pod',
        parentId: 'dim1',
        position: { x: 0, y: 0 },
        width: undefined,
        height: undefined,
        measured: undefined,
        data: {},
      };

      useFlowStore.setState({
        nodes: [nodeNoDim1, nodeNoDim2, childPodNoDim] as any,
        edges: [{ id: 'e-dim', source: 'dim1', target: 'dim2' }] as any,
      });

      useFlowStore.getState().autoLayout('LR');
      const nodes = useFlowStore.getState().nodes;
      expect(nodes[0].position.x).toBeDefined();
      expect(nodes[1].position.x).toBeDefined();
    });

    it('covers getGroupDragExtraChanges when multiple members of the same group are moved', () => {
      const gNode1 = { id: 'g1', position: { x: 0, y: 0 }, data: { groupId: 'shared-grp' } };
      const gNode2 = { id: 'g2', position: { x: 50, y: 50 }, data: { groupId: 'shared-grp' } };

      useFlowStore.setState({
        nodes: [gNode1, gNode2] as any,
      });

      // Move both nodes of the same group simultaneously
      useFlowStore.getState().onNodesChange([
        { id: 'g1', type: 'position', position: { x: 10, y: 10 } },
        { id: 'g2', type: 'position', position: { x: 60, y: 60 } },
      ]);

      const state = useFlowStore.getState();
      expect(state.nodes.find((n) => n.id === 'g1')?.position).toEqual({ x: 10, y: 10 });
      expect(state.nodes.find((n) => n.id === 'g2')?.position).toEqual({ x: 60, y: 60 });
    });

    it('covers HPA connection prerequisite branches: Deployment -> HPA direction, missing label, and missing targetNode in ResourceLimit check', () => {
      const addLogSpy = vi.fn();
      const depWithoutLimits: Node = {
        id: 'dep-no-limits',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: {}, // no label, no limits
      };
      const depWithLabelNoLimits: Node = {
        id: 'dep-with-label',
        type: 'Deployment',
        position: { x: 50, y: 0 },
        data: { label: 'my-dep-label' }, // has label, no limits
      };
      const hpaNode: Node = {
        id: 'hpa-target',
        type: 'HPA',
        position: { x: 100, y: 0 },
        data: {},
      };

      useFlowStore.setState({
        nodes: [depWithoutLimits, depWithLabelNoLimits, hpaNode] as any,
        edges: [],
        addLog: addLogSpy,
      });

      // Connect Deployment (source) -> HPA (target) without ResourceLimit
      useFlowStore.getState().onConnect({ source: 'dep-no-limits', target: 'hpa-target' });
      expect(addLogSpy).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('[HPA Prerequisite] Cannot connect HPA to dep-no-limits'),
        'UI'
      );
      expect(useFlowStore.getState().edges).toHaveLength(0);

      // Connect HPA (source) -> Deployment (target) with label
      useFlowStore.getState().onConnect({ source: 'hpa-target', target: 'dep-with-label' });
      expect(addLogSpy).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('[HPA Prerequisite] Cannot connect HPA to my-dep-label'),
        'UI'
      );
      expect(useFlowStore.getState().edges).toHaveLength(0);

      // Connect HPA -> Non-workload (e.g. ConfigMap) -> isHpaConnection is false, not blocked
      const cmNode: Node = {
        id: 'cm-node',
        type: 'ConfigMap',
        position: { x: 200, y: 0 },
        data: {},
      };
      useFlowStore.setState({
        nodes: [cmNode, hpaNode] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'hpa-target', target: 'cm-node' });
      expect(useFlowStore.getState().edges).toHaveLength(1);
    });

    it('covers updateServiceSelector branches: undefined serviceType/data, id/tgtId fallbacks, Ingress selector, existing baseTargets, and empty nextTargets', () => {
      // 1. Service with undefined serviceType and selector matching an Ingress
      const ingressTargetNode: Node = {
        id: 'ing-sel-target',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: { label: 'ing-app' },
      };
      const svcNodeWithIngressSel: Node = {
        id: 'svc-ing-sel',
        type: 'Service',
        position: { x: 100, y: 0 },
        data: { selector: 'ing-app', serviceType: undefined },
      };
      const depTarget: Node = {
        id: 'dep-new-target',
        type: 'Deployment',
        position: { x: 200, y: 0 },
        data: { label: 'dep-new-app' },
      };

      useFlowStore.setState({
        nodes: [ingressTargetNode, svcNodeWithIngressSel, depTarget] as any,
        edges: [],
      });

      // Connect service to deployment -> updates ingressTargets and selector
      useFlowStore.getState().onConnect({ source: 'svc-ing-sel', target: 'dep-new-target' });
      const updatedSvc = useFlowStore.getState().nodes.find((n) => n.id === 'svc-ing-sel');
      expect(updatedSvc?.data?.selector).toBe('dep-new-app');

      // 2. Connect again to same target (baseTargets.includes(targetLabel) is true)
      useFlowStore.getState().onConnect({ source: 'svc-ing-sel', target: 'dep-new-target' });

      // 3. Service with undefined data connecting to target without label (fallback to id/tgtId)
      const svcNodata: Node = {
        id: 'svc-nodata',
        type: 'Service',
        position: { x: 0, y: 0 },
        data: undefined as any,
      };
      const targetNoLabel: Node = {
        id: 'target-no-lbl',
        type: 'Deployment',
        position: { x: 100, y: 0 },
        data: {},
      };
      useFlowStore.setState({
        nodes: [svcNodata, targetNoLabel] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'svc-nodata', target: 'target-no-lbl' });
      const resSvcNodata = useFlowStore.getState().nodes.find((n) => n.id === 'svc-nodata');
      expect(resSvcNodata?.data?.selector).toBe('target-no-lbl');

      // Target node not in store -> fallback to tgtId
      useFlowStore.getState().onConnect({ source: 'svc-nodata', target: 'ghost-target-id' });
    });

    it('covers updateConnectedNodeState type fallbacks and checkPvcTopologyError reverse connection (Deployment -> PVC)', () => {
      // 1. PVC topology error when source is Deployment and target is PVC (isSourcePvc = false)
      const depWorkload: Node = {
        id: 'dep-rev',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: { label: 'dep-rev' },
      };
      const ssExisting: Node = {
        id: 'ss-existing',
        type: 'StatefulSet',
        position: { x: 100, y: 0 },
        data: { label: 'ss-existing', workloadType: 'StatefulSet' },
      };
      const pvcNode: Node = {
        id: 'pvc-rev',
        type: 'PVC',
        position: { x: 200, y: 0 },
        data: { label: 'pvc-rev' },
      };
      const existingEdge: Edge = {
        id: 'e-ss-pvc',
        source: 'ss-existing',
        target: 'pvc-rev',
      };

      useFlowStore.setState({
        nodes: [depWorkload, ssExisting, pvcNode] as any,
        edges: [existingEdge],
      });

      const { validateEdge } = useFlowStore.getState();
      // Reverse connection: dep -> pvc
      const validatedRev = validateEdge({ id: 'e-rev', source: 'dep-rev', target: 'pvc-rev' } as any);
      expect(validatedRev.data?.validationError).toContain('Volume Claim Template Conflict');

      // 2. updateConnectedNodeState with node having data.type fallback and missing srcNode/tgtNode types
      const srcNodeNoType: Node = {
        id: 'src-notype',
        type: undefined as any,
        position: { x: 0, y: 0 },
        data: { type: 'Service' },
      };
      const tgtNodeNoType: Node = {
        id: 'tgt-notype',
        type: undefined as any,
        position: { x: 100, y: 0 },
        data: { type: 'Pod' },
      };
      useFlowStore.setState({
        nodes: [srcNodeNoType, tgtNodeNoType] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'src-notype', target: 'tgt-notype' });
      expect(useFlowStore.getState().edges).toHaveLength(1);
    });

    it('covers store slice edge cases: missing iamUsers, duplicate onConnect, validateEdge untyped nodes, and onReconnect unmatched edges', () => {
      // 1. iamUsers is undefined in onNodesChange and onConnect
      const podNode = { id: 'pod-u', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod-u' } };
      const svcNode = { id: 'svc-u', type: 'Service', position: { x: 100, y: 0 }, data: { label: 'svc-u' } };
      useFlowStore.setState({
        nodes: [podNode, svcNode] as any,
        edges: [],
        iamUsers: undefined as any,
        activeIdentity: 'system:admin',
      });

      useFlowStore.getState().onNodesChange([{ id: 'pod-u', type: 'position', position: { x: 10, y: 10 } }]);
      expect(useFlowStore.getState().nodes.find((n) => n.id === 'pod-u')?.position).toEqual({ x: 10, y: 10 });

      // 2. onConnect when edge already exists (duplicate connection early return)
      useFlowStore.getState().onConnect({ source: 'pod-u', target: 'svc-u' });
      expect(useFlowStore.getState().edges).toHaveLength(1);
      // Attempt duplicate connect
      useFlowStore.getState().onConnect({ source: 'pod-u', target: 'svc-u' });
      expect(useFlowStore.getState().edges).toHaveLength(1);

      // 3. validateEdge when nodes lack type property (covers sourceNode.type || '' and targetNode.type || '')
      const untypedSource: Node = { id: 'u-src', type: undefined as any, position: { x: 0, y: 0 }, data: {} };
      const untypedTarget: Node = { id: 'u-tgt', type: undefined as any, position: { x: 0, y: 0 }, data: {} };
      useFlowStore.setState({
        nodes: [untypedSource, untypedTarget] as any,
      });
      const validatedUntyped = useFlowStore.getState().validateEdge({ id: 'e-untyped', source: 'u-src', target: 'u-tgt' } as any);
      expect(validatedUntyped).toBeDefined();

      // 4. onReconnect when multiple edges exist (covers e.id !== oldEdge.id in map)
      const edgeA: Edge = { id: 'e-a', source: 'u-src', target: 'u-tgt' };
      const edgeB: Edge = { id: 'e-b', source: 'u-src', target: 'u-tgt' };
      useFlowStore.setState({
        edges: [edgeA, edgeB],
      });
      useFlowStore.getState().onReconnect(edgeA, { source: 'u-src', target: 'u-tgt' });
      expect(useFlowStore.getState().edges).toHaveLength(2);
    });

    it('covers Ingress and Service edge removal branches: non-Service target, non-Ingress node, empty backend, and preserved selector', () => {
      // 1. collectRemovedIngressServices with non-Service target (Branch 1 idx 1)
      const ingNode: Node = {
        id: 'ing-rem-test',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: {
          backendServiceName: 'svc-main',
          ingressPaths: [{ id: 'p1', serviceName: 'svc-sub', servicePort: 80 }],
        },
      };
      const podTarget: Node = {
        id: 'pod-non-svc',
        type: 'Pod',
        position: { x: 100, y: 0 },
        data: { label: 'pod-target' },
      };
      const edgeToPod: Edge = {
        id: 'e-ing-pod',
        source: 'ing-rem-test',
        target: 'pod-non-svc',
      };
      useFlowStore.setState({
        nodes: [ingNode, podTarget] as any,
        edges: [edgeToPod],
      });
      // Edge selection change on Ingress (removedEdges.length === 0 early return)
      useFlowStore.getState().onEdgesChange([{ type: 'select', id: 'e-ing-pod', selected: true }]);
      useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-ing-pod' }]);

      // 2. reconcileRemovedIngressEndpoints on non-Ingress node (Branch 5 idx 0)
      const depNode: Node = {
        id: 'dep-rem-test',
        type: 'Deployment',
        position: { x: 0, y: 0 },
        data: { label: 'dep-label' },
      };
      const edgeToDep: Edge = {
        id: 'e-dep-pod',
        source: 'dep-rem-test',
        target: 'pod-non-svc',
      };
      useFlowStore.setState({
        nodes: [depNode, podTarget] as any,
        edges: [edgeToDep],
      });
      useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-dep-pod' }]);

      // 3. Ingress with empty backendServiceName but hasPathsMatch, and hasBackendMatch is false (Branches 8 idx 1 & 13 idx 1)
      const ingNoBackend: Node = {
        id: 'ing-no-backend',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: {
          backendServiceName: undefined,
          ingressPaths: [
            { id: 'p1', serviceName: 'svc-alpha', servicePort: 80 },
            { id: 'p2', serviceName: 'svc-beta', servicePort: 80 },
          ],
        },
      };
      const svcAlpha: Node = {
        id: 'svc-alpha',
        type: 'Service',
        position: { x: 100, y: 0 },
        data: { label: 'svc-alpha' },
      };
      const svcBeta: Node = {
        id: 'svc-beta',
        type: 'Service',
        position: { x: 200, y: 0 },
        data: { label: 'svc-beta' },
      };
      const edgeToAlpha: Edge = {
        id: 'e-ing-alpha',
        source: 'ing-no-backend',
        target: 'svc-alpha',
      };
      const edgeToBeta: Edge = {
        id: 'e-ing-beta',
        source: 'ing-no-backend',
        target: 'svc-beta',
      };
      useFlowStore.setState({
        nodes: [ingNoBackend, svcAlpha, svcBeta] as any,
        edges: [edgeToAlpha, edgeToBeta],
      });
      useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-ing-alpha' }]);
      const updatedIngNoBackend = useFlowStore.getState().nodes.find((n) => n.id === 'ing-no-backend');
      expect(updatedIngNoBackend?.data?.ingressPaths).toHaveLength(2);
      expect(updatedIngNoBackend?.data?.ingressPaths?.[0]?.serviceName).toBe('');
      expect(updatedIngNoBackend?.data?.ingressPaths?.[1]?.serviceName).toBe('svc-beta');

      // 4. Service with multiple outgoing edges: remove 1, hasMatch remains true (Branch 24 idx 1)
      const multiSvc: Node = {
        id: 'svc-multi',
        type: 'Service',
        position: { x: 0, y: 0 },
        data: { selector: 'shared-pod' },
      };
      const pod1: Node = {
        id: 'pod-1',
        type: 'Pod',
        position: { x: 100, y: 0 },
        data: { label: 'shared-pod' },
      };
      const pod2: Node = {
        id: 'pod-2',
        type: 'Pod',
        position: { x: 200, y: 0 },
        data: { label: 'shared-pod' },
      };
      const edgeSvcPod1: Edge = { id: 'e-svc-p1', source: 'svc-multi', target: 'pod-1' };
      const edgeSvcPod2: Edge = { id: 'e-svc-p2', source: 'svc-multi', target: 'pod-2' };
      useFlowStore.setState({
        nodes: [multiSvc, pod1, pod2] as any,
        edges: [edgeSvcPod1, edgeSvcPod2],
      });
      useFlowStore.getState().onEdgesChange([{ type: 'remove', id: 'e-svc-p1' }]);
      const updatedMultiSvc = useFlowStore.getState().nodes.find((n) => n.id === 'svc-multi');
      expect(updatedMultiSvc?.data?.selector).toBe('shared-pod');
    });

    it('covers buildConnectedIngressData branches: existingPaths without existingBackend, and tgtId fallback', () => {
      // 1. existingPaths without existingBackend where alreadyExists is true (Branch 37 idx 1)
      const ingWithPathsNoBackend: Node = {
        id: 'ing-paths-nobackend',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: {
          ingressPaths: [{ id: 'p1', serviceName: 'svc-exist', servicePort: 80 }],
        },
      };
      const svcExist: Node = {
        id: 'svc-exist',
        type: 'Service',
        position: { x: 100, y: 0 },
        data: { label: 'svc-exist' },
      };
      useFlowStore.setState({
        nodes: [ingWithPathsNoBackend, svcExist] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'ing-paths-nobackend', target: 'svc-exist' });
      const updated1 = useFlowStore.getState().nodes.find((n) => n.id === 'ing-paths-nobackend');
      expect(updated1?.data?.backendServiceName).toBe('svc-exist');

      // 2. existingPaths without existingBackend where alreadyExists is false (Branch 38 idx 1)
      const ingWithPathsNoBackend2: Node = {
        id: 'ing-paths-nobackend-2',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: {
          ingressPaths: [{ id: 'p1', serviceName: 'svc-exist', servicePort: 80 }],
        },
      };
      const svcNew: Node = {
        id: 'svc-new',
        type: 'Service',
        position: { x: 100, y: 0 },
        data: { label: 'svc-new' },
      };
      useFlowStore.setState({
        nodes: [ingWithPathsNoBackend2, svcNew] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'ing-paths-nobackend-2', target: 'svc-new' });
      const updated2 = useFlowStore.getState().nodes.find((n) => n.id === 'ing-paths-nobackend-2');
      expect(updated2?.data?.backendServiceName).toBe('svc-new');
      expect(updated2?.data?.ingressPaths).toHaveLength(2);

      // 3. targetNode has empty label and empty id (Branch 32 idx 2)
      const ingTargetFallback: Node = {
        id: 'ing-tgt-fallback',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: {},
      };
      const svcEmptyIdAndLabel: Node = {
        id: '',
        type: 'Service',
        position: { x: 100, y: 0 },
        data: {},
      };
      useFlowStore.setState({
        nodes: [ingTargetFallback, svcEmptyIdAndLabel] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'ing-tgt-fallback', target: '' });
      const updated3 = useFlowStore.getState().nodes.find((n) => n.id === 'ing-tgt-fallback');
      expect(updated3?.data?.backendServiceName).toBe('');
    });

    it('covers Role rule sync with unrelated edge, undefined resources, and autoLayout non-toplevel edge', () => {
      // 1. Role rule sync with unrelated edge (Branch 52 idx 1)
      // 2. Role node with rules[0].resources undefined (Branch 57 idx 1)
      const roleNode: Node = {
        id: 'role-test',
        type: 'Role',
        position: { x: 0, y: 0 },
        data: {
          rules: [{ apiGroups: [''], resources: undefined, verbs: ['get'] }],
        },
      };
      const podA: Node = { id: 'pod-a', type: 'Pod', position: { x: 100, y: 0 }, data: {} };
      const podB: Node = { id: 'pod-b', type: 'Pod', position: { x: 200, y: 0 }, data: {} };
      const unrelatedEdge: Edge = { id: 'e-a-b', source: 'pod-a', target: 'pod-b' };
      const resNodes = syncRoleRulesFromConnections([roleNode, podA, podB], [unrelatedEdge]);
      expect(resNodes).toBeDefined();

      // 3. autoLayout with edge connecting to child pod (Branch 63 idx 1)
      const depContainer: Node = { id: 'dep-parent', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const childPod: Node = { id: 'child-pod-edge', parentId: 'dep-parent', type: 'Pod', position: { x: 10, y: 10 }, data: {} };
      const standaloneNode: Node = { id: 'standalone-svc', type: 'Service', position: { x: 200, y: 0 }, data: {} };
      const edgeToChild: Edge = { id: 'e-to-child', source: 'standalone-svc', target: 'child-pod-edge' };
      useFlowStore.setState({
        nodes: [depContainer, childPod, standaloneNode] as any,
        edges: [edgeToChild],
      });
      useFlowStore.getState().autoLayout('LR');
      expect(useFlowStore.getState().nodes).toHaveLength(3);
    });

    it('covers quick connect untyped nodes and child pod parentId in data fallback', () => {
      // 1. canQuickConnect with sourceNode.type or targetNode.type undefined (Branches 80 & 81 idx 1)
      const untypedSrc: Node = { id: 'untyped-s', position: { x: 0, y: 0 }, data: {} };
      const untypedTgt: Node = { id: 'untyped-t', position: { x: 200, y: 0 }, data: {} };
      useFlowStore.setState({
        nodes: [untypedSrc, untypedTgt] as any,
        edges: [],
      });
      useFlowStore.getState().onQuickConnect('untyped-s', 'right');
      expect(useFlowStore.getState().edges).toHaveLength(0);

      // 2. rerouteChildPodConnection with pod.data.parentId when pod.parentId is undefined (Branch 95 idx 1)
      const parentDep: Node = { id: 'dep-parent-data', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const podWithDataParent: Node = {
        id: 'pod-data-parent',
        type: 'Pod',
        parentId: undefined,
        position: { x: 10, y: 10 },
        data: { parentId: 'dep-parent-data' },
      };
      const testRole: Node = { id: 'role-reroute', type: 'Role', position: { x: 200, y: 0 }, data: {} };
      useFlowStore.setState({
        nodes: [parentDep, podWithDataParent, testRole] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'role-reroute', target: 'pod-data-parent' });
      expect(useFlowStore.getState().edges[0]?.target).toBe('dep-parent-data');
    });

    it('covers onNodesChange with unknown node id and dimension sync non-dimensions changes', () => {
      // 1. filterAllowedNodeChanges when targetNode is not found (Branch 104 idx 0)
      useFlowStore.setState({
        nodes: [{ id: 'existing-n', type: 'Pod', position: { x: 0, y: 0 }, data: {} }] as any,
        edges: [],
      });
      useFlowStore.getState().onNodesChange([
        { type: 'position', id: 'unknown-node-id', position: { x: 50, y: 50 } },
      ]);
      expect(useFlowStore.getState().nodes.find((n) => n.id === 'existing-n')?.position).toEqual({ x: 0, y: 0 });

      // 2. syncParentContainersOnDimensionChange with mixed dimension and select changes (Branch 106 idx 1)
      const parentCont: Node = { id: 'parent-dep', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const childItem: Node = { id: 'child-item', parentId: 'parent-dep', type: 'Pod', position: { x: 10, y: 10 }, data: {} };
      useFlowStore.setState({
        nodes: [parentCont, childItem] as any,
        edges: [],
      });
      useFlowStore.getState().onNodesChange([
        { type: 'select', id: 'parent-dep', selected: true },
        { type: 'dimensions', id: 'child-item', dimensions: { width: 120, height: 80 } },
      ]);
      expect(useFlowStore.getState().nodes.find((n) => n.id === 'parent-dep')?.selected).toBe(true);
    });

    it('covers updateServiceSelector branches: id fallback in targetLabel, id match in isCurrentSelIngress, and already-included target', () => {
      // 1. targetLabel falls back to tgtId when target node has no label, no baseName, and empty id (Branch 121 idx 3)
      // 2. isCurrentSelIngress matches on item.id when item has no label (Branch 127 idx 1)
      const currentIngress: Node = {
        id: 'ing-sel-id-only',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: {},
      };
      const secondIngress: Node = {
        id: 'ing-sel-2',
        type: 'Ingress',
        position: { x: 100, y: 0 },
        data: { label: 'ing-2-label' },
      };
      const serviceNode: Node = {
        id: 'svc-sel-test',
        type: 'Service',
        position: { x: 200, y: 0 },
        data: { serviceType: 'LoadBalancer', selector: 'ing-sel-id-only' },
      };
      useFlowStore.setState({
        nodes: [currentIngress, secondIngress, serviceNode] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'svc-sel-test', target: 'ing-sel-2' });
      const updatedSvc = useFlowStore.getState().nodes.find((n) => n.id === 'svc-sel-test');
      expect(updatedSvc?.data?.ingressTargets).toContain('ing-2-label');

      // 3. baseTargets already includes targetLabel (Branch 130 idx 0)
      const svcWithTargets: Node = {
        id: 'svc-existing-targets',
        type: 'Service',
        position: { x: 0, y: 0 },
        data: { serviceType: 'LoadBalancer', ingressTargets: ['ing-2-label'], selector: 'ing-2-label' },
      };
      useFlowStore.setState({
        nodes: [secondIngress, svcWithTargets] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'svc-existing-targets', target: 'ing-sel-2' });
      const updatedSvc2 = useFlowStore.getState().nodes.find((n) => n.id === 'svc-existing-targets');
      expect(updatedSvc2?.data?.ingressTargets).toHaveLength(1);

      // 4. nextTargets[0] is empty fallback to targetLabel (Branch 131 idx 1)
      const ingEmptyName: Node = {
        id: '',
        type: 'Ingress',
        position: { x: 0, y: 0 },
        data: { label: '' },
      };
      const svcFallback: Node = {
        id: 'svc-fb',
        type: 'Service',
        position: { x: 100, y: 0 },
        data: { serviceType: 'LoadBalancer', ingressTargets: [''] },
      };
      useFlowStore.setState({
        nodes: [ingEmptyName, svcFallback] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'svc-fb', target: '' });
      expect(useFlowStore.getState().nodes.find((n) => n.id === 'svc-fb')?.data?.selector).toBe('');
    });

    it('covers PVC status unchanged branch, updateConnectedNodeState srcNode.type fallback, and checkPvcTopologyError PVC -> Deployment connection', () => {
      // 1. PVC status unchanged when already equals realTimeStatus (Branch 138 idx 1)
      const unboundPvc: Node = {
        id: 'pvc-bound-test',
        type: 'PVC',
        position: { x: 0, y: 0 },
        data: { label: 'pvc-bound', pvcStatus: 'Pending' },
      };
      const dummyWorkload: Node = {
        id: 'dummy-w',
        type: 'Deployment',
        position: { x: 100, y: 0 },
        data: { label: 'dummy-w', resourceLimits: { memory: '256Mi' } },
      };
      const dummyWorkload2: Node = {
        id: 'dummy-w2',
        type: 'Deployment',
        position: { x: 200, y: 0 },
        data: { label: 'dummy-w2', resourceLimits: { memory: '256Mi' } },
      };
      useFlowStore.setState({
        nodes: [unboundPvc, dummyWorkload, dummyWorkload2] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'dummy-w', target: 'dummy-w2' });
      expect(useFlowStore.getState().nodes.find((n) => n.id === 'pvc-bound-test')?.data?.pvcStatus).toBe('Pending');

      // 2. updateConnectedNodeState with sType falling back to srcNode.type or empty (Branch 140 idx 2 & 3)
      const nodeNoType: Node = {
        id: 'node-no-type',
        type: undefined as any,
        position: { x: 0, y: 0 },
        data: {},
      };
      const nodeTargetType: Node = {
        id: 'node-target-type',
        type: 'Deployment',
        position: { x: 100, y: 0 },
        data: { resourceLimits: { memory: '256Mi' } },
      };
      useFlowStore.setState({
        nodes: [nodeNoType, nodeTargetType] as any,
        edges: [],
      });
      useFlowStore.getState().onConnect({ source: 'node-no-type', target: 'node-target-type' });
      expect(useFlowStore.getState().edges).toHaveLength(1);

      // 3. checkPvcTopologyError when source is PVC and target is Deployment (Branches 155 & 156 idx 0)
      const ssForConflict: Node = {
        id: 'ss-for-conflict',
        type: 'StatefulSet',
        position: { x: 0, y: 0 },
        data: { label: 'ss-for-conflict', workloadType: 'StatefulSet' },
      };
      const pvcShared: Node = {
        id: 'pvc-shared',
        type: 'PVC',
        position: { x: 100, y: 0 },
        data: { label: 'pvc-shared' },
      };
      const depTarget: Node = {
        id: 'dep-target-conflict',
        type: 'Deployment',
        position: { x: 200, y: 0 },
        data: { label: 'dep-target-conflict' },
      };
      const edgeSsPvc: Edge = {
        id: 'e-ss-pvc-shared',
        source: 'ss-for-conflict',
        target: 'pvc-shared',
      };
      useFlowStore.setState({
        nodes: [ssForConflict, pvcShared, depTarget] as any,
        edges: [edgeSsPvc],
      });
      const err = checkPvcTopologyError(
        { id: 'e-pvc-dep', source: 'pvc-shared', target: 'dep-target-conflict' } as any,
        pvcShared as any,
        depTarget as any,
        [ssForConflict, pvcShared, depTarget] as any,
        [edgeSsPvc]
      );
      expect(err).toContain('Volume Claim Template Conflict');
    });

    it('covers quickConnectNodes updating Service serviceType from ClusterIP to LoadBalancer when connected from Internet', () => {
      const internetNode: Node = {
        id: 'internet-qc',
        type: 'Internet',
        position: { x: 0, y: 100 },
        data: {},
      };
      const serviceNode: Node = {
        id: 'service-qc',
        type: 'Service',
        position: { x: 200, y: 100 },
        data: { serviceType: 'ClusterIP', label: 'service-qc' },
      };
      useFlowStore.setState({
        nodes: [internetNode, serviceNode] as any,
        edges: [],
      });
      useFlowStore.getState().onQuickConnect('internet-qc', 'right');
      const updatedSvc = useFlowStore.getState().nodes.find((n) => n.id === 'service-qc');
      expect(updatedSvc?.data.serviceType).toBe('LoadBalancer');
    });
  });
});
