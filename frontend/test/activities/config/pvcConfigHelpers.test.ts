import { describe, it, expect } from 'vitest';
import {
  calculatePvcConnectedReplicas,
  evaluatePvcRealtimeStatus,
  handlePvcRwoAccessMode,
  syncPvcRealtimeState,
} from '@/activities/config/pvcConfigHelpers';
import { Node, Edge } from '@xyflow/react';

describe('pvcConfigHelpers test suite', () => {
  it('returns 0 when PVC has no connected workload edges or invalid nodes', () => {
    const pvcId = 'pvc-1';
    const nodes: Node[] = [
      { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } },
      { id: 'unknown-1', type: 'Unknown', data: {}, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'pvc-1', target: 'unknown-1' }];

    const total = calculatePvcConnectedReplicas(pvcId, nodes, edges);
    expect(total).toBe(0);
  });

  it('calculates total replicas for connected Deployments and standalone Pods', () => {
    const pvcId = 'pvc-1';
    const nodes: Node[] = [
      { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } },
      { id: 'dep-1', type: 'Deployment', data: { replicas: 3 }, position: { x: 0, y: 0 } },
      { id: 'pod-1', type: 'Pod', data: {}, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'dep-1', target: 'pvc-1' },
      { id: 'e2', source: 'pvc-1', target: 'pod-1' },
    ];

    const total = calculatePvcConnectedReplicas(pvcId, nodes, edges);
    expect(total).toBe(4); // 3 from dep-1 + 1 from pod-1
  });

  it('does not double-count child pods if parent Deployment is already connected', () => {
    const pvcId = 'pvc-1';
    const nodes: Node[] = [
      { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } },
      { id: 'dep-1', type: 'Deployment', data: { replicas: 2 }, position: { x: 0, y: 0 } },
      { id: 'pod-child', type: 'Pod', data: { parentId: 'dep-1' }, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'dep-1', target: 'pvc-1' },
      { id: 'e2', source: 'pod-child', target: 'pvc-1' },
    ];

    const total = calculatePvcConnectedReplicas(pvcId, nodes, edges);
    expect(total).toBe(2); // Only dep-1 replicas counted
  });

  it('evaluatePvcRealtimeStatus evaluates Multi-Attach Error vs Bound vs Pending correctly', () => {
    const pvcNode: Node = {
      id: 'pvc-1',
      type: 'PVC',
      data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Pending' },
      position: { x: 0, y: 0 },
    };
    const depNode: Node = {
      id: 'dep-1',
      type: 'Deployment',
      data: { replicas: 2 },
      position: { x: 0, y: 0 },
    };
    const edges: Edge[] = [{ id: 'e1', source: 'dep-1', target: 'pvc-1' }];

    // Replicas = 2 with RWO -> Multi-Attach Error
    expect(evaluatePvcRealtimeStatus(pvcNode, [pvcNode, depNode], edges)).toBe('Multi-Attach Error');

    // RWX accessMode with 2 replicas -> Bound
    const rwxPvcNode = { ...pvcNode, data: { accessMode: 'ReadWriteMany' } };
    expect(evaluatePvcRealtimeStatus(rwxPvcNode, [rwxPvcNode, depNode], edges)).toBe('Bound');

    // Replicas scaled down to 1 with RWO -> Bound
    const depNodeScaledDown = { ...depNode, data: { replicas: 1 } };
    expect(evaluatePvcRealtimeStatus(pvcNode, [pvcNode, depNodeScaledDown], edges)).toBe('Bound');

    // Disconnected -> Pending (or fallback to existing pvcStatus 'Bound' when disconnected)
    expect(evaluatePvcRealtimeStatus(pvcNode, [pvcNode], [])).toBe('Pending');
    const pvcBoundNoConn: Node = { id: 'pvc-1', type: 'PVC', data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' }, position: { x: 0, y: 0 } };
    expect(evaluatePvcRealtimeStatus(pvcBoundNoConn, [pvcBoundNoConn], [])).toBe('Bound');
  });

  it('handlePvcRwoAccessMode handles unchanged edge errors, disconnected PVCs, and unconfigured pending pods', () => {
    const pvcNode: Node = {
      id: 'pvc-1',
      type: 'PVC',
      data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Multi-Attach Error' },
      position: { x: 0, y: 0 },
    };
    const depNode: Node = {
      id: 'dep-1',
      type: 'Deployment',
      data: { replicas: 3 },
      position: { x: 0, y: 0 },
    };
    const unconfiguredPodNode: Node = {
      id: 'pod-unconfig',
      type: 'Pod',
      parentId: 'dep-1',
      data: { status: 'pending', image: '' }, // empty image
      position: { x: 0, y: 0 },
    };
    const errorMsg = 'Multi-Attach Error: Volume "pvc-1" (ReadWriteOnce) cannot be mounted by 3 replicas simultaneously';
    const edgeWithError: Edge = {
      id: 'e1',
      source: 'dep-1',
      target: 'pvc-1',
      data: { validationError: errorMsg },
    };

    // Edge already has errorMsg -> edgesChanged is false
    const resSameError = handlePvcRwoAccessMode(
      pvcNode,
      [pvcNode, depNode, unconfiguredPodNode],
      [edgeWithError]
    );
    expect(resSameError.edges[0].data?.validationError).toBe(errorMsg);

    // Disconnected PVC node with connectedWorkloadIds.size === 0
    const pvcDisconnected: Node = {
      id: 'pvc-disc',
      type: 'PVC',
      data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Pending' },
      position: { x: 0, y: 0 },
    };
    const resDisc = handlePvcRwoAccessMode(pvcDisconnected, [pvcDisconnected], []);
    expect(resDisc.nodes).toEqual([pvcDisconnected]);

    // When replicas scale down to 1, unconfigured pod remains pending (image is empty)
    const depNode1 = { ...depNode, data: { replicas: 1 } };
    const resScaleDownUnconfig = handlePvcRwoAccessMode(
      pvcNode,
      [pvcNode, depNode1, unconfiguredPodNode],
      [edgeWithError]
    );
    const updatedUnconfigPod = resScaleDownUnconfig.nodes.find((n) => n.id === 'pod-unconfig');
    expect(updatedUnconfigPod?.data?.status).toBe('pending');

    // Edge with non-Multi-Attach validationError remains unchanged
    const edgeOtherErr: Edge = {
      id: 'e1',
      source: 'dep-1',
      target: 'pvc-1',
      data: { validationError: 'Other Error' },
    };
    const resOtherErr = handlePvcRwoAccessMode(pvcNode, [pvcNode, depNode1], [edgeOtherErr]);
    expect(resOtherErr.edges[0].data?.validationError).toBe('Other Error');
  });

  it('handlePvcRwoAccessMode evaluates and toggles RWO PVC multi-attach error state and pod statuses', () => {
    const pvcNode: Node = {
      id: 'pvc-1',
      type: 'PVC',
      data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' },
      position: { x: 0, y: 0 },
    };
    const depNode: Node = {
      id: 'dep-1',
      type: 'Deployment',
      data: { replicas: 3 },
      position: { x: 0, y: 0 },
    };
    const podNode: Node = {
      id: 'pod-1',
      type: 'Pod',
      parentId: 'dep-1',
      data: { status: 'ready', image: 'nginx:latest' },
      position: { x: 0, y: 0 },
    };
    const edges: Edge[] = [
      { id: 'e1', source: 'dep-1', target: 'pvc-1', data: {} },
    ];

    // 1. When replicas > 1, sets Multi-Attach Error and marks pod pending
    const resError = handlePvcRwoAccessMode(
      pvcNode,
      [pvcNode, depNode, podNode],
      edges
    );
    const updatedPvcError = resError.nodes.find((n) => n.id === 'pvc-1');
    const updatedPodPending = resError.nodes.find((n) => n.id === 'pod-1');
    expect(updatedPvcError?.data?.pvcStatus).toBe('Multi-Attach Error');
    expect(updatedPodPending?.data?.status).toBe('pending');
    expect(resError.edges[0].data?.validationError).toContain('Multi-Attach Error');

    // 2. Scale down replica count to 1 -> clears error, restores Bound status & ready pod status for configured pod
    const depNode1 = { ...depNode, data: { replicas: 1 } };
    const resBound = handlePvcRwoAccessMode(
      updatedPvcError!,
      [updatedPvcError!, depNode1, updatedPodPending!],
      resError.edges
    );
    const updatedPvcBound = resBound.nodes.find((n) => n.id === 'pvc-1');
    const updatedPodReady = resBound.nodes.find((n) => n.id === 'pod-1');

    expect(updatedPvcBound?.data?.pvcStatus).toBe('Bound');
    expect(updatedPodReady?.data?.status).toBe('ready');
    expect(resBound.edges[0].data?.validationError).toBeUndefined();
  });

  it('syncPvcRealtimeState dynamically updates PVC status across all PVC nodes on canvas', () => {
    const pvcNode: Node = {
      id: 'pvc-1',
      type: 'PVC',
      data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' },
      position: { x: 0, y: 0 },
    };
    const depNode: Node = {
      id: 'dep-1',
      type: 'Deployment',
      data: { replicas: 3 },
      position: { x: 0, y: 0 },
    };
    const edges: Edge[] = [{ id: 'e1', source: 'dep-1', target: 'pvc-1', data: {} }];

    const syncedError = syncPvcRealtimeState([pvcNode, depNode], edges);
    const updatedPvcError = syncedError.nodes.find((n) => n.id === 'pvc-1');
    expect(updatedPvcError?.data?.pvcStatus).toBe('Multi-Attach Error');

    const depNode1 = { ...depNode, data: { replicas: 1 } };
    const syncedBound = syncPvcRealtimeState([updatedPvcError!, depNode1], syncedError.edges);
    const updatedPvcBound = syncedBound.nodes.find((n) => n.id === 'pvc-1');
    expect(updatedPvcBound?.data?.pvcStatus).toBe('Bound');

    // Return original arrays unchanged if no PVC nodes exist
    const noPvcRes = syncPvcRealtimeState([depNode], edges);
    expect(noPvcRes.nodes).toEqual([depNode]);
  });
});
