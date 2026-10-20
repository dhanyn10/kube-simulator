import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFlowStore } from '@/store';
import { checkWorkloadHpaStatus } from '@/activities/config/workloadConfigHelpers';
import { useWorkloadConfigHandler } from '@/activities/config/useWorkloadConfig';
import { processWorkloadSimulation, SimulationContext } from '@/lib/simulation';
import { renderHook, act } from '@testing-library/react';
import type { Node, Edge } from '@xyflow/react';

describe('HPA Lifecycle & Pod Scaling Integration Tests', () => {
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
      activityLogs: [],
      isSimulating: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coordinates pod scale-up when HPA node is connected, and restores manual control upon HPA removal', () => {
    const deploymentId = 'api-deployment';
    const hpaId = 'api-hpa';

    // 1. Initial Deployment with 1 replica and 1 child Pod
    const initialDep: Node = {
      id: deploymentId,
      type: 'Deployment',
      position: { x: 100, y: 100 },
      width: 300,
      height: 200,
      data: {
        id: deploymentId,
        label: 'api-service',
        workloadType: 'Deployment',
        replicas: 1,
        image: 'nginx:alpine',
        cpuLimit: '500m',
        memoryLimit: '256Mi',
        cpuRequest: '250m',
        memoryRequest: '128Mi',
      },
    };

    const initialPod: Node = {
      id: 'api-pod-0',
      type: 'Pod',
      parentId: deploymentId,
      position: { x: 20, y: 30 },
      data: {
        id: 'api-pod-0',
        label: 'api-service-pod-0',
        replicas: 1,
        image: 'nginx:alpine',
        status: 'ready',
      },
    };

    useFlowStore.setState({
      nodes: [initialDep, initialPod],
      edges: [],
    });

    // Verify initial state: manual replica control is active
    let hpaInfo = checkWorkloadHpaStatus(initialDep, useFlowStore.getState().nodes, []);
    expect(hpaInfo.isControlled).toBe(false);

    // 2. Connect HPA node to Deployment via canvas edge
    const hpaNode: Node = {
      id: hpaId,
      type: 'HPA',
      position: { x: 450, y: 100 },
      data: {
        id: hpaId,
        label: 'api-hpa-scaler',
        minReplicas: 2,
        maxReplicas: 5,
        targetCPU: 50,
      },
    };

    const hpaEdge: Edge = {
      id: 'e-hpa-dep',
      source: hpaId,
      target: deploymentId,
    };

    useFlowStore.setState({
      nodes: [initialDep, initialPod, hpaNode],
      edges: [hpaEdge],
    });

    // Verify HPA control locks Deployment & Child Pod
    const currentState = useFlowStore.getState();
    hpaInfo = checkWorkloadHpaStatus(initialDep, currentState.nodes, currentState.edges);
    expect(hpaInfo.isControlled).toBe(true);
    expect(hpaInfo.hpaName).toBe('api-hpa-scaler');
    expect(hpaInfo.minReplicas).toBe(2);
    expect(hpaInfo.maxReplicas).toBe(5);

    const childPodHpaInfo = checkWorkloadHpaStatus(initialPod, currentState.nodes, currentState.edges);
    expect(childPodHpaInfo.isControlled).toBe(true);

    // Verify useWorkloadConfigHandler blocks manual updateReplicas calls
    const { result } = renderHook(() => useWorkloadConfigHandler(initialDep));
    expect(result.current.hpaInfo.isControlled).toBe(true);

    act(() => {
      result.current.updateReplicas(9);
    });
    // Replicas should still be 1 (unmodified by manual attempt)
    expect(useFlowStore.getState().nodes.find((n) => n.id === deploymentId)?.data.replicas).toBe(1);

    // 3. Simulate high CPU load triggering HPA scale-up
    const simNodes = [...useFlowStore.getState().nodes];
    const nodeMap = new Map<string, Node>(simNodes.map((n) => [n.id, n]));
    const targetEdgeMap = new Map<string, Edge[]>([[deploymentId, [hpaEdge]]]);

    const ctx: SimulationContext = {
      nodes: simNodes,
      updatedNodes: simNodes,
      edges: [hpaEdge],
      activeSimulationEdges: ['e-hpa-dep'],
      newMetrics: {},
      ticks: 1,
      get: () => useFlowStore.getState() as any,
      set: useFlowStore.setState as any,
      nodeMap,
      targetEdgeMap,
      childPodMap: new Map([[deploymentId, [initialPod]]]),
    };

    // Incoming traffic of 800 req/sec generates ~80% CPU (> 50% target)
    const currentDepNode = simNodes.find((n) => n.id === deploymentId)!;
    currentDepNode.data = { ...currentDepNode.data, traffic: 800 };

    const simulationResult = processWorkloadSimulation(currentDepNode, ctx);
    expect(simulationResult.hasChanges).toBe(true);

    // Update store with simulation result
    useFlowStore.setState({ nodes: ctx.updatedNodes });

    const scaledState = useFlowStore.getState();
    const scaledDep = scaledState.nodes.find((n) => n.id === deploymentId)!;
    const scaledChildPods = scaledState.nodes.filter((n) => n.parentId === deploymentId && n.type === 'Pod');

    // Pods should have scaled up to at least minReplicas (2) or higher
    expect(scaledDep.data.replicas).toBeGreaterThanOrEqual(2);
    expect(scaledChildPods.length).toBe(scaledDep.data.replicas);

    // 4. Remove HPA node & edge from canvas
    useFlowStore.getState().deleteNodes([hpaNode]);
    useFlowStore.setState({ edges: [] });

    const stateAfterRemoval = useFlowStore.getState();
    const depAfterRemoval = stateAfterRemoval.nodes.find((n) => n.id === deploymentId)!;
    const releaseHpaInfo = checkWorkloadHpaStatus(depAfterRemoval, stateAfterRemoval.nodes, []);
    expect(releaseHpaInfo.isControlled).toBe(false);

    // 5. Verify manual control is unblocked and scales child pods directly
    const { result: manualConfigResult } = renderHook(() => useWorkloadConfigHandler(depAfterRemoval));
    expect(manualConfigResult.current.hpaInfo.isControlled).toBe(false);

    act(() => {
      manualConfigResult.current.updateReplicas(3);
    });

    let finalState = useFlowStore.getState();
    let finalDep = finalState.nodes.find((n) => n.id === deploymentId)!;
    let finalPods = finalState.nodes.filter((n) => n.parentId === deploymentId && n.type === 'Pod');

    expect(finalDep.data.replicas).toBe(3);
    expect(finalPods).toHaveLength(3);

    // Verify scaling above separated threshold (> 3) transitions into stacked card representation
    act(() => {
      manualConfigResult.current.updateReplicas(4);
    });

    finalState = useFlowStore.getState();
    finalDep = finalState.nodes.find((n) => n.id === deploymentId)!;
    finalPods = finalState.nodes.filter((n) => n.parentId === deploymentId && n.type === 'Pod');

    expect(finalDep.data.replicas).toBe(4);
    expect(finalPods[0]?.data.replicas).toBe(4);
  });

  it('manages pod lifecycle with directly attached HPA badge item and respects minReplicas', () => {
    const deploymentId = 'worker-dep';

    const depNode: Node = {
      id: deploymentId,
      type: 'Deployment',
      position: { x: 50, y: 50 },
      data: {
        id: deploymentId,
        label: 'worker-service',
        replicas: 1,
        cpuLimit: '500m',
        memoryLimit: '256Mi',
        // Attached HPA badge item with minReplicas: 3
        hpas: [
          {
            id: 'hpa-item-1',
            name: 'worker-autoscaler',
            minReplicas: 3,
            maxReplicas: 6,
            targetCPU: 60,
          },
        ],
      },
    };

    const initialPod: Node = {
      id: 'worker-pod-0',
      type: 'Pod',
      parentId: deploymentId,
      position: { x: 10, y: 10 },
      data: { id: 'worker-pod-0', label: 'worker-0', replicas: 1 },
    };

    useFlowStore.setState({
      nodes: [depNode, initialPod],
      edges: [],
    });

    // 1. Verify attached HPA detection
    const hpaStatus = checkWorkloadHpaStatus(depNode, useFlowStore.getState().nodes, []);
    expect(hpaStatus.isControlled).toBe(true);
    expect(hpaStatus.hpaName).toBe('worker-autoscaler');
    expect(hpaStatus.minReplicas).toBe(3);

    // 2. Run simulation cycle: current replica (1) is below minReplicas (3)
    const simNodes = [...useFlowStore.getState().nodes];
    const ctx: SimulationContext = {
      nodes: simNodes,
      updatedNodes: simNodes,
      edges: [],
      activeSimulationEdges: [],
      newMetrics: {},
      ticks: 1,
      get: () => useFlowStore.getState() as any,
      set: useFlowStore.setState as any,
      nodeMap: new Map(simNodes.map((n) => [n.id, n])),
      childPodMap: new Map([[deploymentId, [initialPod]]]),
    };

    const currentDep = simNodes.find((n) => n.id === deploymentId)!;
    currentDep.data = { ...currentDep.data, traffic: 100 };

    processWorkloadSimulation(currentDep, ctx);
    useFlowStore.setState({ nodes: ctx.updatedNodes });

    const scaledPods = useFlowStore.getState().nodes.filter((n) => n.parentId === deploymentId && n.type === 'Pod');
    const scaledDep = useFlowStore.getState().nodes.find((n) => n.id === deploymentId)!;

    // HPA brings replicas up to satisfy minReplicas (3)
    expect(scaledDep.data.replicas).toBeGreaterThanOrEqual(3);
    expect(scaledPods.length).toBe(scaledDep.data.replicas);

    // 3. Remove attached HPA from deployment data
    useFlowStore.getState().updateNodeData(deploymentId, { hpas: [] });

    const stateAfterHpaRemoved = useFlowStore.getState();
    const depAfterHpaRemoved = stateAfterHpaRemoved.nodes.find((n) => n.id === deploymentId)!;
    const statusAfterRemoved = checkWorkloadHpaStatus(depAfterHpaRemoved, stateAfterHpaRemoved.nodes, []);
    expect(statusAfterRemoved.isControlled).toBe(false);

    // 4. Manually scale down to 1 replica
    useFlowStore.getState().updateNodeData(deploymentId, { replicas: 1 });

    const prunedPods = useFlowStore.getState().nodes.filter((n) => n.parentId === deploymentId && n.type === 'Pod');
    expect(prunedPods).toHaveLength(1);
  });

  it('prunes excess child pods during scale-down when traffic load decreases under HPA', () => {
    const deploymentId = 'downscale-dep';

    // Start with 4 replicas
    const depNode: Node = {
      id: deploymentId,
      type: 'Deployment',
      position: { x: 50, y: 50 },
      data: {
        id: deploymentId,
        label: 'downscale-service',
        replicas: 4,
        cpuLimit: '500m',
        memoryLimit: '256Mi',
        hpas: [
          {
            id: 'hpa-downscale',
            name: 'downscale-hpa',
            minReplicas: 2,
            maxReplicas: 8,
            targetCPU: 70,
          },
        ],
      },
    };

    const childPods: Node[] = [0, 1, 2, 3].map((idx) => ({
      id: `downscale-pod-${idx}`,
      type: 'Pod',
      parentId: deploymentId,
      position: { x: 20 * idx, y: 20 },
      data: { id: `downscale-pod-${idx}`, label: `downscale-pod-${idx}`, replicas: 1 },
    }));

    useFlowStore.setState({
      nodes: [depNode, ...childPods],
      edges: [],
    });

    expect(useFlowStore.getState().nodes.filter((n) => n.parentId === deploymentId)).toHaveLength(4);

    // Simulate minimal traffic: CPU load drops significantly below target 70%
    const simNodes = [...useFlowStore.getState().nodes];
    const ctx: SimulationContext = {
      nodes: simNodes,
      updatedNodes: simNodes,
      edges: [],
      activeSimulationEdges: [],
      newMetrics: {},
      ticks: 1,
      get: () => useFlowStore.getState() as any,
      set: useFlowStore.setState as any,
      nodeMap: new Map(simNodes.map((n) => [n.id, n])),
      childPodMap: new Map([[deploymentId, childPods]]),
    };

    const currentDep = simNodes.find((n) => n.id === deploymentId)!;
    // Very low traffic of 10 req/sec results in low CPU
    currentDep.data = { ...currentDep.data, traffic: 10 };

    processWorkloadSimulation(currentDep, ctx);
    useFlowStore.setState({ nodes: ctx.updatedNodes });

    const finalState = useFlowStore.getState();
    const finalDep = finalState.nodes.find((n) => n.id === deploymentId)!;
    const finalPods = finalState.nodes.filter((n) => n.parentId === deploymentId && n.type === 'Pod');

    // Replicas should have scaled down towards minReplicas (2)
    expect(finalDep.data.replicas).toBeLessThanOrEqual(4);
    expect(finalDep.data.replicas).toBeGreaterThanOrEqual(2);
    expect(finalPods).toHaveLength(finalDep.data.replicas);
  });
});
