import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFlowStore } from '@/store';
import type { Node } from '@xyflow/react';

describe('Workload Lifecycle & Nesting Layout Integration Tests', () => {
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
    });
  });

  it('dynamically coordinates child pods and layout positions as replicas scale up and down', () => {
    const deploymentId = 'dep-yoga-1';

    const deploymentNode: Node = {
      id: deploymentId,
      type: 'Deployment',
      position: { x: 50, y: 50 },
      width: 400,
      height: 200,
      data: {
        id: deploymentId,
        label: 'api-deployment',
        type: 'Deployment',
        workloadType: 'Deployment',
        replicas: 1,
        image: 'nginx:alpine',
      },
    };

    const initialPod: Node = {
      id: 'pod-child-0',
      type: 'Pod',
      parentId: deploymentId,
      position: { x: 20, y: 40 },
      width: 160,
      height: 120,
      data: {
        id: 'pod-child-0',
        label: 'api-deployment-pod-0',
        type: 'Pod',
        replicas: 1,
        image: 'nginx:alpine',
      },
    };

    useFlowStore.setState({
      nodes: [deploymentNode, initialPod],
    });

    // Step 1: Scale from 1 to 3 replicas
    useFlowStore.getState().updateNodeData(deploymentId, { replicas: 3 });

    const scaledState = useFlowStore.getState();
    const childPods = scaledState.nodes.filter((n) => n.parentId === deploymentId && n.type === 'Pod');
    const scaledDeployment = scaledState.nodes.find((n) => n.id === deploymentId)!;

    // Verify 3 pods exist inside the deployment container
    expect(childPods).toHaveLength(3);

    // Verify Yoga layout positioned child pods at distinct coordinates without stacking
    const positions = childPods.map((p) => `${p.position.x},${p.position.y}`);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(3);

    // Verify deployment container has valid positive dimensions
    expect(scaledDeployment.width).toBeGreaterThan(0);
    expect(scaledDeployment.height).toBeGreaterThan(0);

    // Step 2: Scale down from 3 to 1 replica
    useFlowStore.getState().updateNodeData(deploymentId, { replicas: 1 });

    const contractedState = useFlowStore.getState();
    const remainingPods = contractedState.nodes.filter((n) => n.parentId === deploymentId && n.type === 'Pod');
    const contractedDeployment = contractedState.nodes.find((n) => n.id === deploymentId)!;

    // Excess pods were pruned down to 1
    expect(remainingPods).toHaveLength(1);
    expect(contractedDeployment.data.replicas).toBe(1);
  });

  it('transforms standalone Pod into ReplicaSet container group when scaling replicas greater than 1', () => {
    const { addNode, updateNodeData } = useFlowStore.getState();

    // Step 1: Add a standalone pod
    addNode('Pod', { x: 100, y: 100 });
    let state = useFlowStore.getState();
    const originalPod = state.nodes.find((n) => n.type === 'Pod')!;
    expect(originalPod.parentId).toBeUndefined();

    // Step 2: Scale replicas to 2 on standalone pod -> Triggers auto-transform into ReplicaSet
    updateNodeData(originalPod.id, { replicas: 2 });

    state = useFlowStore.getState();
    const replicaSet = state.nodes.find((n) => n.type === 'ReplicaSet');
    expect(replicaSet).toBeDefined();

    // The pods are now nested inside the generated ReplicaSet container
    const nestedPods = state.nodes.filter((n) => n.parentId === replicaSet!.id && n.type === 'Pod');
    expect(nestedPods.length).toBeGreaterThanOrEqual(1);

    // Step 3: Scale ReplicaSet container down to 1 replica
    updateNodeData(replicaSet!.id, { replicas: 1 });

    const finalState = useFlowStore.getState();
    const scaledReplicaSet = finalState.nodes.find((n) => n.id === replicaSet!.id)!;
    expect(scaledReplicaSet.data.replicas).toBe(1);

    const remainingPods = finalState.nodes.filter((n) => n.parentId === replicaSet!.id && n.type === 'Pod');
    expect(remainingPods).toHaveLength(1);
  });

  it('synchronizes container metadata and image updates across all nested child pods and parent controller', () => {
    const deploymentId = 'dep-sync-meta';

    const deploymentNode: Node = {
      id: deploymentId,
      type: 'Deployment',
      position: { x: 50, y: 50 },
      data: {
        id: deploymentId,
        label: 'worker-deployment',
        type: 'Deployment',
        replicas: 2,
        image: 'python:3.10',
      },
    };

    const pod1: Node = {
      id: 'pod-sync-1',
      type: 'Pod',
      parentId: deploymentId,
      position: { x: 20, y: 40 },
      data: { id: 'pod-sync-1', label: 'worker-1', type: 'Pod', image: 'python:3.10' },
    };

    const pod2: Node = {
      id: 'pod-sync-2',
      type: 'Pod',
      parentId: deploymentId,
      position: { x: 200, y: 40 },
      data: { id: 'pod-sync-2', label: 'worker-2', type: 'Pod', image: 'python:3.10' },
    };

    useFlowStore.setState({
      nodes: [deploymentNode, pod1, pod2],
    });

    // In Kube Simulator architecture, updating the pod template synchronizes all sibling pods and the parent controller
    useFlowStore.getState().updateNodeData('pod-sync-1', {
      image: 'node:20-alpine',
    });

    const updatedState = useFlowStore.getState();
    const updatedDep = updatedState.nodes.find((n) => n.id === deploymentId)!;
    const updatedPod1 = updatedState.nodes.find((n) => n.id === 'pod-sync-1')!;

    expect(updatedDep.data.image).toBe('node:20-alpine');
    expect(updatedPod1.data.image).toBe('node:20-alpine');
  });
});
