import { describe, it, expect } from 'vitest';
import {
  WORKER_NODES,
  WORKER_NODE_OPTIONS,
  getAssignedWorker,
  getTrafficHopInfo,
  getWorkerForIndex,
  getWorkerNodeInfo,
  getWorkerNodes,
  getWorkerNodeOptions,
  resolveServiceEndpointPods,
  pickKubeProxyRoute,
} from '@/lib/workerNodeHelpers';

describe('workerNodeHelpers', () => {
  describe('WORKER_NODES & WORKER_NODE_OPTIONS', () => {
    it('defines 3 standard worker nodes with valid IP addresses and color styles', () => {
      expect(Object.keys(WORKER_NODES)).toEqual(['worker-1', 'worker-2', 'worker-3']);
      expect(WORKER_NODES['worker-1'].ip).toBe('192.168.1.101');
      expect(WORKER_NODES['worker-2'].ip).toBe('192.168.1.102');
      expect(WORKER_NODES['worker-3'].ip).toBe('192.168.1.103');
      expect(WORKER_NODE_OPTIONS).toHaveLength(3);
    });

    it('dynamically resolves worker nodes beyond worker-3 via proxy', () => {
      const worker10 = WORKER_NODES['worker-10'];
      expect(worker10).toBeDefined();
      expect(worker10.id).toBe('worker-10');
      expect(worker10.ip).toBe('192.168.1.110');

      // Accessing non-worker string returns undefined
      expect(WORKER_NODES['invalid-property']).toBeUndefined();
    });

    it('supports getWorkerNodeInfo with numbers and string fallback', () => {
      const infoNum = getWorkerNodeInfo(5);
      expect(infoNum.id).toBe('worker-5');
      expect(infoNum.ip).toBe('192.168.1.105');

      const infoFloat = getWorkerNodeInfo(2.8);
      expect(infoFloat.id).toBe('worker-2');

      const infoFallback = getWorkerNodeInfo('non-matching-id');
      expect(infoFallback.id).toBe('worker-1');
    });

    it('supports getWorkerNodes with default count and clamped boundaries', () => {
      const defaultNodes = getWorkerNodes();
      expect(defaultNodes).toHaveLength(3);

      const clampedLow = getWorkerNodes(-5);
      expect(clampedLow).toHaveLength(1);

      const clampedHigh = getWorkerNodes(200);
      expect(clampedHigh).toHaveLength(100);
      expect(clampedHigh[99].id).toBe('worker-100');
    });

    it('supports getWorkerNodeOptions for dynamic worker count', () => {
      const options = getWorkerNodeOptions(5);
      expect(options).toHaveLength(5);
      expect(options[4].id).toBe('worker-5');
      expect(options[4].label).toContain('worker-5');
    });
  });

  describe('getAssignedWorker', () => {
    it('returns explicit assignedNode when set to valid worker', () => {
      expect(getAssignedWorker({ assignedNode: 'worker-2' })).toBe('worker-2');
      expect(getAssignedWorker({ assignedNode: 'worker-3' })).toBe('worker-3');
      expect(getAssignedWorker({ assignedNode: 'worker-1' })).toBe('worker-1');
    });

    it('derives worker deterministically from replicaIndex when present', () => {
      expect(getAssignedWorker({ replicaIndex: 0 })).toBe('worker-1');
      expect(getAssignedWorker({ replicaIndex: 1 })).toBe('worker-2');
      expect(getAssignedWorker({ replicaIndex: 2 })).toBe('worker-3');
      expect(getAssignedWorker({ replicaIndex: 3 })).toBe('worker-1');
      expect(getAssignedWorker({ replicaIndex: -1 })).toBe('worker-2');
    });

    it('derives worker deterministically by hashing nodeId or label when replicaIndex is absent', () => {
      const w1 = getAssignedWorker(null, 'pod-node-a');
      const w2 = getAssignedWorker(null, 'pod-node-a');
      expect(w1).toBe(w2);
      expect(['worker-1', 'worker-2', 'worker-3']).toContain(w1);

      const wLabel = getAssignedWorker({ label: 'web-pod-xyz' });
      expect(['worker-1', 'worker-2', 'worker-3']).toContain(wLabel);
    });

    it('falls back to worker-1 when data and nodeId are missing or empty', () => {
      expect(getAssignedWorker(null)).toBe('worker-1');
      expect(getAssignedWorker({})).toBe('worker-1');
      expect(getAssignedWorker({ label: '' }, '')).toBe('worker-1');
    });
  });

  describe('getTrafficHopInfo', () => {
    it('evaluates cluster policy when traffic enters on a different node (extra hop)', () => {
      const hop = getTrafficHopInfo(
        { entryNode: 'worker-1', externalTrafficPolicy: 'Cluster' },
        { assignedNode: 'worker-2' }
      );

      expect(hop.entryNode).toBe('worker-1');
      expect(hop.targetNode).toBe('worker-2');
      expect(hop.policy).toBe('Cluster');
      expect(hop.isExtraHop).toBe(true);
      expect(hop.isDropped).toBe(false);
      expect(hop.entryNodeIp).toBe('192.168.1.101');
      expect(hop.targetNodeIp).toBe('192.168.1.102');
    });

    it('evaluates local policy dropping packet when target pod is not on entry node', () => {
      const hop = getTrafficHopInfo(
        { entryNode: 'worker-1', externalTrafficPolicy: 'Local' },
        { assignedNode: 'worker-3' }
      );

      expect(hop.entryNode).toBe('worker-1');
      expect(hop.targetNode).toBe('worker-3');
      expect(hop.policy).toBe('Local');
      expect(hop.isExtraHop).toBe(true);
      expect(hop.isDropped).toBe(true);
    });

    it('evaluates local policy direct delivery when target pod is on same entry node', () => {
      const hop = getTrafficHopInfo(
        { entryNode: 'worker-2', externalTrafficPolicy: 'Local' },
        { assignedNode: 'worker-2' }
      );

      expect(hop.entryNode).toBe('worker-2');
      expect(hop.targetNode).toBe('worker-2');
      expect(hop.policy).toBe('Local');
      expect(hop.isExtraHop).toBe(false);
      expect(hop.isDropped).toBe(false);
    });

    it('falls back to defaults when service and pod data are empty', () => {
      const hop = getTrafficHopInfo(null, null);
      expect(hop.entryNode).toBe('worker-1');
      expect(hop.targetNode).toBe('worker-1');
      expect(hop.policy).toBe('Cluster');
      expect(hop.isExtraHop).toBe(false);
      expect(hop.isDropped).toBe(false);
    });
  });

  describe('getWorkerForIndex', () => {
    it('spreads replica indices round-robin across 3 workers', () => {
      expect([0, 1, 2, 3, 4].map(getWorkerForIndex)).toEqual(['worker-1', 'worker-2', 'worker-3', 'worker-1', 'worker-2']);
      expect(getWorkerForIndex(-2)).toBe('worker-3');
    });
  });

  describe('resolveServiceEndpointPods', () => {
    const nodes = [
      { id: 'dep', type: 'Deployment', data: { label: 'web' } },
      { id: 'p1', type: 'Pod', parentId: 'dep', data: { label: 'web-1', assignedNode: 'worker-1' } },
      { id: 'p2', type: 'Pod', data: { parentId: 'dep', label: 'web-2', assignedNode: 'worker-2' } },
      { id: 'solo', type: 'Pod', data: { label: 'solo' } },
      { id: 'empty-dep', type: 'Deployment', data: { label: 'empty' } },
      { id: 'svc', type: 'Service', data: { label: 'web' } },
    ];

    it('returns empty list when selector is missing', () => {
      expect(resolveServiceEndpointPods(undefined, nodes)).toEqual([]);
    });

    it('expands deployments into child pods and keeps standalone pods', () => {
      expect(resolveServiceEndpointPods('web', nodes).map(n => n.id)).toEqual(['p1', 'p2']);
      expect(resolveServiceEndpointPods('solo', nodes).map(n => n.id)).toEqual(['solo']);
    });

    it('falls back to the workload itself when it has no child pods', () => {
      expect(resolveServiceEndpointPods('empty', nodes).map(n => n.id)).toEqual(['empty-dep']);
    });

    it('matches by baseName and labels.app', () => {
      const extra = [
        { id: 'b', type: 'Pod', data: { baseName: 'base' } },
        { id: 'l', type: 'Pod', data: { labels: { app: 'lbl' } } },
        { id: 'n', type: 'Pod' },
      ];
      expect(resolveServiceEndpointPods('base', extra).map(n => n.id)).toEqual(['b']);
      expect(resolveServiceEndpointPods('lbl', extra).map(n => n.id)).toEqual(['l']);
    });
  });

  describe('pickKubeProxyRoute', () => {
    const endpoints = [
      { id: 'p1', data: { assignedNode: 'worker-1' } },
      { id: 'p2', data: { assignedNode: 'worker-2' } },
      { id: 'p3', data: { assignedNode: 'worker-3' } },
    ];

    it('returns null when there are no endpoints', () => {
      expect(pickKubeProxyRoute({}, [], 0.5)).toBeNull();
    });

    it('Cluster policy may route to a remote worker (extra hop)', () => {
      const route = pickKubeProxyRoute({ entryNode: 'worker-1', externalTrafficPolicy: 'Cluster' }, endpoints, 0.99);
      expect(route?.targetNode).toBe('worker-3');
      expect(route?.isExtraHop).toBe(true);
      expect(route?.isDropped).toBe(false);
      expect(route?.endpointCount).toBe(3);
      expect(route?.localEndpointCount).toBe(1);
    });

    it('Local policy only routes to endpoints on the entry node', () => {
      const route = pickKubeProxyRoute({ entryNode: 'worker-2', externalTrafficPolicy: 'Local' }, endpoints, 0.99);
      expect(route?.targetNode).toBe('worker-2');
      expect(route?.isExtraHop).toBe(false);
      expect(route?.isDropped).toBe(false);
    });

    it('Local policy drops when no endpoint lives on the entry node', () => {
      const route = pickKubeProxyRoute({ entryNode: 'worker-1', externalTrafficPolicy: 'Local' }, endpoints.slice(1), -1);
      expect(route?.isDropped).toBe(true);
      expect(route?.localEndpointCount).toBe(0);
    });

    it('defaults entry node and policy when service data is missing', () => {
      const route = pickKubeProxyRoute(null, endpoints, 0);
      expect(route?.entryNode).toBe('worker-1');
      expect(route?.policy).toBe('Cluster');
      expect(route?.targetNode).toBe('worker-1');
    });
  });
});
