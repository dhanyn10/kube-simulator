import { describe, it, expect } from 'vitest';
import {
  calculatePvcConnectedReplicas,
  evaluatePvcRealtimeStatus,
  handlePvcRwoAccessMode,
  syncPvcRealtimeState,
  analyzePvcWorkloadConnections,
  getPvcValidationErrorMsg,
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

  it('does not trigger Multi-Attach error when connected Deployment is configured as StatefulSet', () => {
    const pvcNode: Node = {
      id: 'pvc-1',
      type: 'PVC',
      data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' },
      position: { x: 0, y: 0 },
    };
    const ssNode: Node = {
      id: 'dep-1',
      type: 'Deployment',
      data: { replicas: 3, workloadType: 'StatefulSet' },
      position: { x: 0, y: 0 },
    };
    const edges: Edge[] = [{ id: 'e1', source: 'dep-1', target: 'pvc-1', data: {} }];

    const total = calculatePvcConnectedReplicas('pvc-1', [pvcNode, ssNode], edges);
    expect(total).toBe(1);

    const status = evaluatePvcRealtimeStatus(pvcNode, [pvcNode, ssNode], edges);
    expect(status).toBe('Bound');
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

  it('covers calculatePvcConnectedReplicas fallback when replicas is NaN or less than 1', () => {
    const pvcId = 'pvc-1';
    const nodes: Node[] = [
      { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } },
      { id: 'dep-nan', type: 'Deployment', data: { replicas: 'invalid-nan' }, position: { x: 0, y: 0 } },
      { id: 'rs-zero', type: 'ReplicaSet', data: { replicas: 0 }, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'dep-nan', target: 'pvc-1' },
      { id: 'e2', source: 'rs-zero', target: 'pvc-1' },
    ];

    const total = calculatePvcConnectedReplicas(pvcId, nodes, edges);
    expect(total).toBe(2); // 1 from dep-nan fallback + 1 from rs-zero fallback
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

  it('covers connected Pod with parentId pointing to unconnected parent, pvcStatus undefined fallback in evaluatePvcRealtimeStatus, and clearing Multi-Attach Error edge error', () => {
    // 1. calculatePvcConnectedReplicas with connected Pod having parentId pointing to an unconnected parent
    const pvcId = 'pvc-1';
    const nodes: Node[] = [
      { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } },
      { id: 'pod-with-unconnected-parent', type: 'Pod', data: { parentId: 'dep-not-connected' }, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'pvc-1', target: 'pod-with-unconnected-parent' },
    ];

    const total = calculatePvcConnectedReplicas(pvcId, nodes, edges);
    expect(total).toBe(1);

    // 2. evaluatePvcRealtimeStatus fallback when pvcStatus is undefined and connectedReplicas == 0
    const pvcNodeNoStatus: Node = { id: 'pvc-nostatus', type: 'PVC', data: { pvcStatus: undefined }, position: { x: 0, y: 0 } };
    expect(evaluatePvcRealtimeStatus(pvcNodeNoStatus, [pvcNodeNoStatus], [])).toBe('Pending');

    // 3. updatePvcEdges clearing Multi-Attach Error edge error when conflict is resolved
    const pvcNode: Node = {
      id: 'pvc-1',
      type: 'PVC',
      data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Multi-Attach Error' },
      position: { x: 0, y: 0 },
    };
    const depNode1: Node = {
      id: 'dep-1',
      type: 'Deployment',
      data: { replicas: 1 },
      position: { x: 0, y: 0 },
    };
    const edgeWithMultiAttachErr: Edge = {
      id: 'e1',
      source: 'dep-1',
      target: 'pvc-1',
      data: { validationError: 'Multi-Attach Error: Volume "pvc-1"' },
    };

    const resResolved = handlePvcRwoAccessMode(pvcNode, [pvcNode, depNode1], [edgeWithMultiAttachErr]);
    expect(resResolved.edges[0].data?.validationError).toBeUndefined();
  });

  it('covers line 128 in updatePvcEdges when processing an edge not connected to the PVC node', () => {
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
    const otherNode: Node = {
      id: 'other-1',
      type: 'Service',
      data: {},
      position: { x: 0, y: 0 },
    };

    const pvcEdge: Edge = { id: 'e1', source: 'dep-1', target: 'pvc-1', data: {} };
    const unrelatedEdge: Edge = { id: 'e2', source: 'dep-1', target: 'other-1', data: { validationError: 'Keep me' } };

    const res = handlePvcRwoAccessMode(pvcNode, [pvcNode, depNode, otherNode], [pvcEdge, unrelatedEdge]);

    const updatedUnrelatedEdge = res.edges.find((e) => e.id === 'e2');
    expect(updatedUnrelatedEdge?.data?.validationError).toBe('Keep me');
  });

  it('covers line 29 in calculatePvcConnectedReplicas when connected node is not found in nodes list', () => {
    const pvcId = 'pvc-1';
    const nodes: Node[] = [
      { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'pvc-1', target: 'missing-node-id' },
    ];

    const total = calculatePvcConnectedReplicas(pvcId, nodes, edges);
    expect(total).toBe(0);
  });

  it('covers line 100 in getConnectedWorkloadIds when PVC node is the edge source', () => {
    const pvcNode: Node = {
      id: 'pvc-1',
      type: 'PVC',
      data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' },
      position: { x: 0, y: 0 },
    };
    const podNode: Node = {
      id: 'pod-1',
      type: 'Pod',
      data: { status: 'pending', image: 'nginx:latest' },
      position: { x: 0, y: 0 },
    };
    // PVC is source, pod is target
    const edge: Edge = { id: 'e1', source: 'pvc-1', target: 'pod-1', data: {} };

    const res = handlePvcRwoAccessMode(pvcNode, [pvcNode, podNode], [edge]);
    const updatedPod = res.nodes.find((n) => n.id === 'pod-1');
    expect(updatedPod?.data?.status).toBe('ready');
  });

  it('covers line 208 in handlePvcRwoAccessMode fallback to ReadWriteOnce when accessMode is omitted', () => {
    const pvcNodeNoAccessMode: Node = {
      id: 'pvc-1',
      type: 'PVC',
      data: { pvcStatus: 'Pending' },
      position: { x: 0, y: 0 },
    };
    const depNode: Node = {
      id: 'dep-1',
      type: 'Deployment',
      data: { replicas: 2 },
      position: { x: 0, y: 0 },
    };
    const edge: Edge = { id: 'e1', source: 'dep-1', target: 'pvc-1', data: {} };

    const res = handlePvcRwoAccessMode(pvcNodeNoAccessMode, [pvcNodeNoAccessMode, depNode], [edge]);
    const updatedPvc = res.nodes.find((n) => n.id === 'pvc-1');
    expect(updatedPvc?.data?.pvcStatus).toBe('Multi-Attach Error');
  });

  it('detects multi-workload mount violation when 2 Deployments (1 replica each) connect to 1 RWO PVC', () => {
    const pvcNode: Node = {
      id: 'pvc-shared',
      type: 'PVC',
      data: { label: 'shared-data', accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' },
      position: { x: 0, y: 0 },
    };
    const dep1: Node = {
      id: 'dep-1',
      type: 'Deployment',
      data: { label: 'web-app', replicas: 1 },
      position: { x: 0, y: 0 },
    };
    const pod1: Node = {
      id: 'pod-1',
      type: 'Pod',
      parentId: 'dep-1',
      data: { status: 'ready', image: 'nginx:latest', assignedNode: 'worker-1' },
      position: { x: 0, y: 0 },
    };
    const dep2: Node = {
      id: 'dep-2',
      type: 'Deployment',
      data: { label: 'worker-app', replicas: 1 },
      position: { x: 0, y: 0 },
    };
    const pod2: Node = {
      id: 'pod-2',
      type: 'Pod',
      parentId: 'dep-2',
      data: { status: 'ready', image: 'redis:latest', assignedNode: 'worker-2' },
      position: { x: 0, y: 0 },
    };
    const edges: Edge[] = [
      { id: 'e1', source: 'dep-1', target: 'pvc-shared', data: {} },
      { id: 'e2', source: 'dep-2', target: 'pvc-shared', data: {} },
    ];

    const allNodes = [pvcNode, dep1, pod1, dep2, pod2];
    const total = calculatePvcConnectedReplicas('pvc-shared', allNodes, edges);
    expect(total).toBe(2);

    const status = evaluatePvcRealtimeStatus(pvcNode, allNodes, edges);
    expect(status).toBe('Multi-Attach Error');

    const synced = handlePvcRwoAccessMode(pvcNode, allNodes, edges);
    const updatedPvc = synced.nodes.find((n) => n.id === 'pvc-shared');
    const updatedPod1 = synced.nodes.find((n) => n.id === 'pod-1');
    const updatedPod2 = synced.nodes.find((n) => n.id === 'pod-2');

    expect(updatedPvc?.data?.pvcStatus).toBe('Multi-Attach Error');
    expect(updatedPod1?.data?.status).toBe('pending');
    expect(updatedPod2?.data?.status).toBe('pending');
    expect(synced.edges[0].data?.validationError).toContain('Multi-Attach Error');
    expect(synced.edges[1].data?.validationError).toContain('Multi-Attach Error');

    // Disconnect dep-2: conflict resolves
    const resolvedEdges = [edges[0]];
    const resolved = handlePvcRwoAccessMode(updatedPvc!, [updatedPvc!, dep1, updatedPod1!, dep2, updatedPod2!], resolvedEdges);
    const resolvedPvc = resolved.nodes.find((n) => n.id === 'pvc-shared');
    const resolvedPod1 = resolved.nodes.find((n) => n.id === 'pod-1');

    expect(resolvedPvc?.data?.pvcStatus).toBe('Bound');
    expect(resolvedPod1?.data?.status).toBe('ready');
    expect(resolved.edges[0].data?.validationError).toBeUndefined();
  });

  it('detects cross-namespace binding conflict between PVC and workload', () => {
    const nsApp: Node = { id: 'ns-app', type: 'Namespace', data: { label: 'app-ns' }, position: { x: 0, y: 0 } };
    const nsDb: Node = { id: 'ns-db', type: 'Namespace', data: { label: 'db-ns' }, position: { x: 0, y: 0 } };

    const pvcNode: Node = {
      id: 'pvc-db',
      type: 'PVC',
      parentId: 'ns-db',
      data: { label: 'db-volume', accessMode: 'ReadWriteOnce', pvcStatus: 'Pending' },
      position: { x: 0, y: 0 },
    };
    const depNode: Node = {
      id: 'dep-app',
      type: 'Deployment',
      parentId: 'ns-app',
      data: { label: 'frontend-app', replicas: 1 },
      position: { x: 0, y: 0 },
    };
    const podNode: Node = {
      id: 'pod-app',
      type: 'Pod',
      parentId: 'dep-app',
      data: { status: 'ready', image: 'nginx:alpine' },
      position: { x: 0, y: 0 },
    };
    const edge: Edge = { id: 'e1', source: 'dep-app', target: 'pvc-db', data: {} };

    const allNodes = [nsApp, nsDb, pvcNode, depNode, podNode];
    const status = evaluatePvcRealtimeStatus(pvcNode, allNodes, [edge]);
    expect(status).toBe('Multi-Attach Error');

    const synced = handlePvcRwoAccessMode(pvcNode, allNodes, [edge]);
    expect(synced.edges[0].data?.validationError).toContain('Cross-Namespace Binding Error');
    const updatedPod = synced.nodes.find((n) => n.id === 'pod-app');
    expect(updatedPod?.data?.status).toBe('pending');
  });

  it('covers calculatePvcConnectedReplicas fallback to 0 when pvcNodeId does not exist', () => {
    expect(calculatePvcConnectedReplicas('unknown-pvc', [], [])).toBe(0);
  });

  it('covers StatefulSet with 0 child pods in countWorkloadReplicasAndPods fallback', () => {
    const pvcNode: Node = {
      id: 'pvc-empty-ss',
      type: 'PVC',
      data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' },
      position: { x: 0, y: 0 },
    };
    const ssEmpty: Node = {
      id: 'ss-no-pods',
      type: 'StatefulSet',
      data: { label: 'empty-ss', replicas: 1, workloadType: 'StatefulSet' },
      position: { x: 0, y: 0 },
    };
    const edge: Edge = { id: 'e-ss', source: 'ss-no-pods', target: 'pvc-empty-ss' };

    const analysis = analyzePvcWorkloadConnections(pvcNode, [pvcNode, ssEmpty], [edge]);
    expect(analysis.totalReplicas).toBe(1);
    expect(analysis.connectedPods).toHaveLength(0);
  });

  it('covers StatefulSet with child pods in countWorkloadReplicasAndPods', () => {
    const pvcNode: Node = {
      id: 'pvc-ss-pods',
      type: 'PVC',
      data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' },
      position: { x: 0, y: 0 },
    };
    const ssNode: Node = {
      id: 'ss-with-pods',
      type: 'StatefulSet',
      data: { label: 'my-ss', replicas: 2, workloadType: 'StatefulSet' },
      position: { x: 0, y: 0 },
    };
    const childPod: Node = {
      id: 'my-ss-0',
      type: 'Pod',
      parentId: 'ss-with-pods',
      data: { label: 'my-ss-0', assignedNode: 'worker-1' },
      position: { x: 0, y: 0 },
    };
    const edge: Edge = { id: 'e-ss-pod', source: 'ss-with-pods', target: 'pvc-ss-pods' };

    const analysis = analyzePvcWorkloadConnections(pvcNode, [pvcNode, ssNode, childPod], [edge]);
    expect(analysis.totalReplicas).toBe(1);
    expect(analysis.connectedPods).toHaveLength(1);
    expect(analysis.connectedPods[0].id).toBe('my-ss-0');
  });

  it('preserves existing namespace conflict when multiple conflicting workloads connect to PVC', () => {
    const nsMain: Node = { id: 'ns-main', type: 'Namespace', data: { label: 'main' }, position: { x: 0, y: 0 } };
    const nsOther1: Node = { id: 'ns-o1', type: 'Namespace', data: { label: 'other-1' }, position: { x: 0, y: 0 } };
    const nsOther2: Node = { id: 'ns-o2', type: 'Namespace', data: { label: 'other-2' }, position: { x: 0, y: 0 } };
    const pvcNode: Node = { id: 'pvc-main', type: 'PVC', parentId: 'ns-main', data: {}, position: { x: 0, y: 0 } };
    const dep1: Node = { id: 'dep-1', type: 'Deployment', parentId: 'ns-o1', data: { label: 'dep-1' }, position: { x: 0, y: 0 } };
    const dep2: Node = { id: 'dep-2', type: 'Deployment', parentId: 'ns-o2', data: { label: 'dep-2' }, position: { x: 0, y: 0 } };

    const edges: Edge[] = [
      { id: 'e1', source: 'dep-1', target: 'pvc-main' },
      { id: 'e2', source: 'dep-2', target: 'pvc-main' },
    ];

    const analysis = analyzePvcWorkloadConnections(pvcNode, [nsMain, nsOther1, nsOther2, pvcNode, dep1, dep2], edges);
    expect(analysis.namespaceConflict).toBeDefined();
    expect(analysis.namespaceConflict?.pvcNs).toBe('main');
  });

  it('handles duplicate pod encountered across multiple connected workloads without duplicating in podIdsSeen', () => {
    const pvcNode: Node = {
      id: 'pvc-dup',
      type: 'PVC',
      data: { accessMode: 'ReadWriteMany' },
      position: { x: 0, y: 0 },
    };
    const childPod: Node = {
      id: 'pod-shared',
      type: 'Pod',
      parentId: 'dep-1',
      data: { label: 'child-shared' },
      position: { x: 0, y: 0 },
    };
    const dep1: Node = {
      id: 'dep-1',
      type: 'Deployment',
      data: { label: 'dep-1', replicas: 1 },
      position: { x: 0, y: 0 },
    };
    const dep2: Node = {
      id: 'dep-2',
      type: 'Deployment',
      data: { label: 'dep-2', replicas: 1 },
      position: { x: 0, y: 0 },
    };
    // childPod also parented under dep-2 to produce duplicate pod entry
    const childPodDup: Node = {
      id: 'pod-shared',
      type: 'Pod',
      parentId: 'dep-2',
      data: { label: 'child-shared' },
      position: { x: 0, y: 0 },
    };
    const edges: Edge[] = [
      { id: 'e1', source: 'dep-1', target: 'pvc-dup' },
      { id: 'e2', source: 'dep-2', target: 'pvc-dup' },
    ];

    const analysis = analyzePvcWorkloadConnections(pvcNode, [pvcNode, dep1, dep2, childPod, childPodDup], edges);
    expect(analysis.connectedPods).toHaveLength(1);
    expect(analysis.connectedPods[0].id).toBe('pod-shared');
  });

  it('covers getPvcValidationErrorMsg for various conflict and non-conflict scenarios', () => {
    const pvcNode: Node = {
      id: 'pvc-msg',
      type: 'PVC',
      data: { label: 'data-vol', accessMode: 'ReadWriteOnce' },
      position: { x: 0, y: 0 },
    };

    // 1. Namespace conflict
    const nsMsg = getPvcValidationErrorMsg(pvcNode, {
      totalReplicas: 1,
      connectedPods: [],
      workerNodes: ['worker-1'],
      namespaceConflict: {
        pvcNs: 'prod',
        workloadNs: 'dev',
        workloadLabel: 'web-app',
      },
    });
    expect(nsMsg).toContain('Cross-Namespace Binding Error');

    // 2. Multi-Attach worker node conflict
    const workerConflictMsg = getPvcValidationErrorMsg(pvcNode, {
      totalReplicas: 2,
      connectedPods: [],
      workerNodes: ['worker-1', 'worker-2'],
      workerNodeConflict: {
        workerNodes: ['worker-1', 'worker-2'],
      },
    });
    expect(workerConflictMsg).toContain('cannot be mounted on multiple worker nodes');

    // 3. Multi-Attach total replicas conflict (single node, multiple replicas)
    const replicaConflictMsg = getPvcValidationErrorMsg(pvcNode, {
      totalReplicas: 3,
      connectedPods: [],
      workerNodes: ['worker-1'],
    });
    expect(replicaConflictMsg).toContain('cannot be mounted by 3 replicas simultaneously');

    // 4. No conflict under ReadWriteOnce
    const noConflictRwo = getPvcValidationErrorMsg(pvcNode, {
      totalReplicas: 1,
      connectedPods: [],
      workerNodes: ['worker-1'],
    });
    expect(noConflictRwo).toBeUndefined();

    // 5. ReadWriteMany access mode without conflicts
    const pvcRwm: Node = {
      id: 'pvc-rwm',
      type: 'PVC',
      data: { label: 'shared-vol', accessMode: 'ReadWriteMany' },
      position: { x: 0, y: 0 },
    };
    const rwmResult = getPvcValidationErrorMsg(pvcRwm, {
      totalReplicas: 5,
      connectedPods: [],
      workerNodes: ['worker-1', 'worker-2'],
    });
    expect(rwmResult).toBeUndefined();

    // 6. Template conflict
    const templateMsg = getPvcValidationErrorMsg(pvcNode, {
      totalReplicas: 2,
      connectedPods: [],
      workerNodes: ['worker-1'],
      templateConflict: {
        statefulSetLabel: 'db-ss',
        otherWorkloadLabel: 'web-dep',
      },
    });
    expect(templateMsg).toContain('Volume Claim Template Conflict');
    expect(templateMsg).toContain('is claimed as a StatefulSet volumeClaimTemplate by "db-ss"');
    expect(templateMsg).toContain('cannot be shared with "web-dep"');
  });

  describe('PVC volumeClaimTemplate conflict detection and lifecycle', () => {
    it('detects conflict when PVC is connected to StatefulSet and Deployment', () => {
      const pvcNode: Node = { id: 'pvc-shared', type: 'PVC', data: { label: 'data-pvc' }, position: { x: 0, y: 0 } };
      const ssNode: Node = {
        id: 'ss-1',
        type: 'StatefulSet',
        data: { label: 'redis-ss', workloadType: 'StatefulSet', replicas: 1 },
        position: { x: 0, y: 0 },
      };
      const depNode: Node = {
        id: 'dep-1',
        type: 'Deployment',
        data: { label: 'api-dep', replicas: 1 },
        position: { x: 0, y: 0 },
      };
      const edges: Edge[] = [
        { id: 'e1', source: 'ss-1', target: 'pvc-shared' },
        { id: 'e2', source: 'dep-1', target: 'pvc-shared' },
      ];

      const analysis = analyzePvcWorkloadConnections(pvcNode, [pvcNode, ssNode, depNode], edges);
      expect(analysis.templateConflict).toBeDefined();
      expect(analysis.templateConflict?.statefulSetLabel).toBe('redis-ss');
      expect(analysis.templateConflict?.otherWorkloadLabel).toBe('api-dep');

      const status = evaluatePvcRealtimeStatus(pvcNode, [pvcNode, ssNode, depNode], edges);
      expect(status).toBe('Multi-Attach Error');

      const synced = handlePvcRwoAccessMode(pvcNode, [pvcNode, ssNode, depNode], edges);
      expect(synced.edges[0].data?.validationError).toContain('Volume Claim Template Conflict');
      expect(synced.edges[1].data?.validationError).toContain('Volume Claim Template Conflict');
    });

    it('detects conflict when PVC is connected to multiple StatefulSets', () => {
      const pvcNode: Node = { id: 'pvc-multi-ss', type: 'PVC', data: { label: 'cluster-pvc' }, position: { x: 0, y: 0 } };
      const ss1: Node = {
        id: 'ss-1',
        type: 'StatefulSet',
        data: { label: 'primary-ss', workloadType: 'StatefulSet', replicas: 1 },
        position: { x: 0, y: 0 },
      };
      const ss2: Node = {
        id: 'ss-2',
        type: 'StatefulSet',
        data: { label: 'replica-ss', workloadType: 'StatefulSet', replicas: 1 },
        position: { x: 0, y: 0 },
      };
      const edges: Edge[] = [
        { id: 'e1', source: 'ss-1', target: 'pvc-multi-ss' },
        { id: 'e2', source: 'ss-2', target: 'pvc-multi-ss' },
      ];

      const analysis = analyzePvcWorkloadConnections(pvcNode, [pvcNode, ss1, ss2], edges);
      expect(analysis.templateConflict).toBeDefined();
      expect(analysis.templateConflict?.statefulSetLabel).toBe('primary-ss');
      expect(analysis.templateConflict?.otherWorkloadLabel).toBe('replica-ss');
    });

    it('falls back to node IDs when connected workloads lack labels in detectPvcTemplateConflict', () => {
      const pvcNode: Node = { id: 'pvc-raw', type: 'PVC', data: {}, position: { x: 0, y: 0 } };
      const ssRaw1: Node = { id: 'ss-raw-1', type: 'StatefulSet', data: { workloadType: 'StatefulSet' }, position: { x: 0, y: 0 } };
      const ssRaw2: Node = { id: 'ss-raw-2', type: 'StatefulSet', data: { workloadType: 'StatefulSet' }, position: { x: 0, y: 0 } };
      const depRaw: Node = { id: 'dep-raw-1', type: 'Deployment', data: {}, position: { x: 0, y: 0 } };

      // 1. Multiple StatefulSets without labels
      const analysisSS = analyzePvcWorkloadConnections(
        pvcNode,
        [pvcNode, ssRaw1, ssRaw2],
        [
          { id: 'e1', source: 'ss-raw-1', target: 'pvc-raw' },
          { id: 'e2', source: 'ss-raw-2', target: 'pvc-raw' },
        ]
      );
      expect(analysisSS.templateConflict?.statefulSetLabel).toBe('ss-raw-1');
      expect(analysisSS.templateConflict?.otherWorkloadLabel).toBe('ss-raw-2');

      // 2. StatefulSet and Deployment without labels
      const analysisDep = analyzePvcWorkloadConnections(
        pvcNode,
        [pvcNode, ssRaw1, depRaw],
        [
          { id: 'e1', source: 'ss-raw-1', target: 'pvc-raw' },
          { id: 'e2', source: 'dep-raw-1', target: 'pvc-raw' },
        ]
      );
      expect(analysisDep.templateConflict?.statefulSetLabel).toBe('ss-raw-1');
      expect(analysisDep.templateConflict?.otherWorkloadLabel).toBe('dep-raw-1');
    });

    it('clears template conflict validation error from edges when conflicting edge is removed', () => {
      const pvcNode: Node = { id: 'pvc-resolved', type: 'PVC', data: { label: 'clean-pvc', pvcStatus: 'Multi-Attach Error' }, position: { x: 0, y: 0 } };
      const ssNode: Node = {
        id: 'ss-1',
        type: 'StatefulSet',
        data: { label: 'db-ss', workloadType: 'StatefulSet', replicas: 1 },
        position: { x: 0, y: 0 },
      };
      const edgeWithOldError: Edge = {
        id: 'e1',
        source: 'ss-1',
        target: 'pvc-resolved',
        data: { validationError: 'Volume Claim Template Conflict: old error' },
      };

      const synced = handlePvcRwoAccessMode(pvcNode, [pvcNode, ssNode], [edgeWithOldError]);
      expect(synced.edges[0].data?.validationError).toBeUndefined();
      const updatedPvc = synced.nodes.find((n) => n.id === 'pvc-resolved');
      expect(updatedPvc?.data?.pvcStatus).toBe('Bound');
    });
  });
});
