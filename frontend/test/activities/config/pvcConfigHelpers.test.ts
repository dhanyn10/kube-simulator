import { describe, it, expect } from 'vitest';
import { calculatePvcConnectedReplicas, evaluatePvcRealtimeStatus } from '@/activities/config/pvcConfigHelpers';
import { Node, Edge } from '@xyflow/react';

describe('pvcConfigHelpers test suite', () => {
  it('returns 0 when PVC has no connected workload edges', () => {
    const pvcId = 'pvc-1';
    const nodes: Node[] = [{ id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } }];
    const edges: Edge[] = [];

    const total = calculatePvcConnectedReplicas(pvcId, nodes, edges);
    expect(total).toBe(0);
  });

  it('calculates total replicas for connected Deployments and standalone Pods', () => {
    const pvcId = 'pvc-1';
    const nodes: Node[] = [
      { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } },
      { id: 'dep-1', type: 'Deployment', data: { replicas: 3 }, position: { x: 0, y: 0 } },
      { id: 'pod-1', type: 'Pod', data: {}, position: { x: 0, y: 0 } }
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'dep-1', target: 'pvc-1' },
      { id: 'e2', source: 'pvc-1', target: 'pod-1' }
    ];

    const total = calculatePvcConnectedReplicas(pvcId, nodes, edges);
    expect(total).toBe(4); // 3 from dep-1 + 1 from pod-1
  });

  it('does not double-count child pods if parent Deployment is already connected', () => {
    const pvcId = 'pvc-1';
    const nodes: Node[] = [
      { id: 'pvc-1', type: 'PVC', data: {}, position: { x: 0, y: 0 } },
      { id: 'dep-1', type: 'Deployment', data: { replicas: 2 }, position: { x: 0, y: 0 } },
      { id: 'pod-child', type: 'Pod', data: { parentId: 'dep-1' }, position: { x: 0, y: 0 } }
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'dep-1', target: 'pvc-1' },
      { id: 'e2', source: 'pod-child', target: 'pvc-1' }
    ];

    const total = calculatePvcConnectedReplicas(pvcId, nodes, edges);
    expect(total).toBe(2); // Only dep-1 replicas counted
  });

  it('evaluatePvcRealtimeStatus evaluates Multi-Attach Error vs Bound vs Pending correctly', () => {
    const pvcNode: Node = { id: 'pvc-1', type: 'PVC', data: { accessMode: 'ReadWriteOnce', pvcStatus: 'Pending' }, position: { x: 0, y: 0 } };
    const depNode: Node = { id: 'dep-1', type: 'Deployment', data: { replicas: 2 }, position: { x: 0, y: 0 } };
    const edges: Edge[] = [{ id: 'e1', source: 'dep-1', target: 'pvc-1' }];

    // Replicas = 2 with RWO -> Multi-Attach Error
    expect(evaluatePvcRealtimeStatus(pvcNode, [pvcNode, depNode], edges)).toBe('Multi-Attach Error');

    // Replicas scaled down to 1 with RWO -> Bound
    const depNodeScaledDown = { ...depNode, data: { replicas: 1 } };
    expect(evaluatePvcRealtimeStatus(pvcNode, [pvcNode, depNodeScaledDown], edges)).toBe('Bound');

    // Disconnected -> Pending
    expect(evaluatePvcRealtimeStatus(pvcNode, [pvcNode], [])).toBe('Pending');
  });
});
