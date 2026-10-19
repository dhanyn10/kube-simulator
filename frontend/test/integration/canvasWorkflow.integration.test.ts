import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFlowStore } from '@/store';
import { generateYamlClientSide } from '@/lib/manifestGenerator';
import { evaluatePvcRealtimeStatus } from '@/activities/config/pvcConfigHelpers';
import {
  isServiceSelectorMatching,
  hasValidServiceSelectorTarget,
  hasValidIngressBackend,
} from '@/lib/simulationReachability';
import { scenarios } from '@/scenarios';
import type { Node, Edge } from '@xyflow/react';

describe('Canvas UI & Workflow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).go = {
      main: {
        App: {
          PushHistory: vi.fn().mockResolvedValue(true),
          UpdateProject: vi.fn().mockResolvedValue(true),
          SaveSetting: vi.fn().mockResolvedValue(true),
        },
      },
    };

    useFlowStore.setState({
      nodes: [],
      edges: [],
      logs: [],
      activeIdentity: 'system:admin',
      iamUsers: [],
      lastActionId: 'init',
      colorMode: 'dark',
    });
  });

  it('orchestrates complete architecture creation, wiring, and YAML manifest generation', () => {
    const { addNode, onConnect } = useFlowStore.getState();

    // Step 1: Add Namespace container
    addNode('Namespace', { x: 0, y: 0 });
    const nsNode = useFlowStore.getState().nodes.find((n) => n.type === 'Namespace')!;
    expect(nsNode).toBeDefined();

    // Step 2: Add Workload (Deployment) inside Namespace
    addNode('Deployment', { x: 50, y: 50 }, nsNode.id);
    const depNode = useFlowStore.getState().nodes.find((n) => n.type === 'Deployment')!;
    expect(depNode).toBeDefined();
    expect(depNode.parentId).toBe(nsNode.id);

    // Step 3: Add Service, ConfigMap, PVC, and Ingress inside Namespace
    addNode('Service', { x: 250, y: 50 }, nsNode.id);
    addNode('ConfigMap', { x: 50, y: 250 }, nsNode.id);
    addNode('PVC', { x: 250, y: 250 }, nsNode.id);
    addNode('Ingress', { x: 450, y: 50 }, nsNode.id);

    const initialNodes = useFlowStore.getState().nodes;
    const svcNode = initialNodes.find((n) => n.type === 'Service')!;
    const cmNode = initialNodes.find((n) => n.type === 'ConfigMap')!;
    const pvcNode = initialNodes.find((n) => n.type === 'PVC')!;
    const ingNode = initialNodes.find((n) => n.type === 'Ingress')!;

    expect(initialNodes).toHaveLength(6);

    // Step 4: Configure nodes with realistic data
    useFlowStore.getState().updateNodeData(depNode.id, {
      label: 'catalog-api',
      replicas: 1,
      image: 'store/catalog:1.0',
      port: 8080,
    });

    useFlowStore.getState().updateNodeData(svcNode.id, {
      label: 'catalog-svc',
      selector: 'catalog-api',
      serviceType: 'ClusterIP',
      port: 80,
      targetPort: 8080,
    });

    useFlowStore.getState().updateNodeData(cmNode.id, {
      label: 'catalog-config',
      configData: [{ key: 'DATABASE_URL', value: 'postgres://db:5432' }],
    });

    useFlowStore.getState().updateNodeData(pvcNode.id, {
      label: 'catalog-storage',
      storageCapacity: '15Gi',
      accessMode: 'ReadWriteOnce',
    });

    useFlowStore.getState().updateNodeData(ingNode.id, {
      label: 'catalog-ingress',
      ingressHost: 'catalog.example.com',
      ingressPath: '/catalog',
      backendServiceName: 'catalog-svc',
      servicePort: 80,
    });

    // Step 5: Wire connections between nodes
    onConnect({ source: ingNode.id, target: svcNode.id, sourceHandle: null, targetHandle: null });
    onConnect({ source: svcNode.id, target: depNode.id, sourceHandle: null, targetHandle: null });
    onConnect({ source: depNode.id, target: cmNode.id, sourceHandle: null, targetHandle: null });
    onConnect({ source: depNode.id, target: pvcNode.id, sourceHandle: null, targetHandle: null });

    const wiredState = useFlowStore.getState();
    expect(wiredState.edges).toHaveLength(4);

    const updatedDepNode = wiredState.nodes.find((n) => n.id === depNode.id)!;
    const updatedSvcNode = wiredState.nodes.find((n) => n.id === svcNode.id)!;
    const updatedPvcNode = wiredState.nodes.find((n) => n.id === pvcNode.id)!;
    const updatedIngNode = wiredState.nodes.find((n) => n.id === ingNode.id)!;

    // Step 6: Verify cross-node Kubernetes business logic integrations
    const pvcStatus = evaluatePvcRealtimeStatus(updatedPvcNode, wiredState.nodes, wiredState.edges);
    expect(pvcStatus).toBe('Bound');

    const isMatched = isServiceSelectorMatching(updatedSvcNode, updatedDepNode);
    expect(isMatched).toBe(true);

    const hasTarget = hasValidServiceSelectorTarget(updatedSvcNode, wiredState.nodes);
    expect(hasTarget).toBe(true);

    const hasIngress = hasValidIngressBackend(updatedIngNode, wiredState.nodes);
    expect(hasIngress).toBe(true);

    // Step 7: Verify generated client-side YAML
    const yamlOutput = generateYamlClientSide(wiredState.nodes, wiredState.edges);
    expect(yamlOutput).toContain('kind: Namespace');
    expect(yamlOutput).toContain('kind: Deployment');
    expect(yamlOutput).toContain('kind: Service');
    expect(yamlOutput).toContain('kind: Ingress');
    expect(yamlOutput).toContain('kind: ConfigMap');
    expect(yamlOutput).toContain('kind: PersistentVolumeClaim');
    expect(yamlOutput).toContain('catalog.example.com');
  });

  it('detects PVC Multi-Attach conflict upon scaling and recovers when switching to ReadWriteMany', () => {
    const { addNode, onConnect, updateNodeData } = useFlowStore.getState();

    addNode('Deployment', { x: 50, y: 50 });
    addNode('PVC', { x: 250, y: 50 });

    const depNode = useFlowStore.getState().nodes.find((n) => n.type === 'Deployment')!;
    const pvcNode = useFlowStore.getState().nodes.find((n) => n.type === 'PVC')!;

    updateNodeData(depNode.id, { replicas: 1 });
    updateNodeData(pvcNode.id, { accessMode: 'ReadWriteOnce' });

    onConnect({ source: depNode.id, target: pvcNode.id, sourceHandle: null, targetHandle: null });

    let state = useFlowStore.getState();
    let currentPvc = state.nodes.find((n) => n.id === pvcNode.id)!;
    expect(evaluatePvcRealtimeStatus(currentPvc, state.nodes, state.edges)).toBe('Bound');

    // Scale deployment to 3 replicas with ReadWriteOnce -> Multi-Attach Error
    updateNodeData(depNode.id, { replicas: 3 });
    state = useFlowStore.getState();
    currentPvc = state.nodes.find((n) => n.id === pvcNode.id)!;
    expect(evaluatePvcRealtimeStatus(currentPvc, state.nodes, state.edges)).toBe('Multi-Attach Error');

    // Switch PVC accessMode to ReadWriteMany -> Recovers to Bound
    updateNodeData(pvcNode.id, { accessMode: 'ReadWriteMany' });
    state = useFlowStore.getState();
    currentPvc = state.nodes.find((n) => n.id === pvcNode.id)!;
    expect(evaluatePvcRealtimeStatus(currentPvc, state.nodes, state.edges)).toBe('Bound');
  });

  it('cascades connected edge deletion when removing a central Service node', () => {
    const { addNode, onConnect, deleteNodes } = useFlowStore.getState();

    addNode('Ingress', { x: 0, y: 0 });
    addNode('Service', { x: 150, y: 0 });
    addNode('Deployment', { x: 300, y: 0 });

    const state = useFlowStore.getState();
    const ingNode = state.nodes.find((n) => n.type === 'Ingress')!;
    const svcNode = state.nodes.find((n) => n.type === 'Service')!;
    const depNode = state.nodes.find((n) => n.type === 'Deployment')!;

    onConnect({ source: ingNode.id, target: svcNode.id, sourceHandle: null, targetHandle: null });
    onConnect({ source: svcNode.id, target: depNode.id, sourceHandle: null, targetHandle: null });

    expect(useFlowStore.getState().edges).toHaveLength(2);

    // Delete central Service node
    deleteNodes([svcNode as Node]);

    const afterDelete = useFlowStore.getState();
    expect(afterDelete.nodes).toHaveLength(2);
    expect(afterDelete.nodes.find((n) => n.id === svcNode.id)).toBeUndefined();
    // Connected edges must be cleaned up automatically
    expect(afterDelete.edges).toHaveLength(0);
  });

  it('loads pre-configured architecture scenarios and verifies YAML output consistency', () => {
    const basicWebScenario = scenarios.find((s) => s.id === 'basic-web');
    expect(basicWebScenario).toBeDefined();

    // Populate scenario into store
    useFlowStore.setState({
      nodes: basicWebScenario!.data.nodes as Node[],
      edges: basicWebScenario!.data.edges as Edge[],
    });

    const state = useFlowStore.getState();
    expect(state.nodes.length).toBeGreaterThan(0);
    expect(state.edges.length).toBeGreaterThan(0);

    const yamlResult = generateYamlClientSide(state.nodes, state.edges);
    expect(yamlResult).toContain('kind: Service');
    expect(yamlResult).toContain('kind: Pod');
  });
});
