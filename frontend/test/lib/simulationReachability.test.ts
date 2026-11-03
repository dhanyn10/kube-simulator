import { describe, it, expect } from 'vitest';
import { Node, Edge } from '@xyflow/react';
import {
  hasValidIngressBackend,
  calculateReachability,
  isInternetConnectionRed,
} from '@/lib/simulationReachability';
import { SimulationContext } from '@/lib/simulation';

describe('simulationReachability', () => {
  it('covers hasValidIngressBackend when target service has no serviceType (fallback to ClusterIP)', () => {
    const ingressNode: Node = {
      id: 'ing-1',
      type: 'Ingress',
      data: {},
      position: { x: 0, y: 0 },
    };
    const svcNode: Node = {
      id: 'svc-1',
      type: 'Service',
      data: {}, // no serviceType, should fallback to ClusterIP
      position: { x: 0, y: 0 },
    };
    const edgeMap = new Map<string, Edge[]>([
      ['ing-1', [{ id: 'e1', source: 'ing-1', target: 'svc-1' }]],
    ]);

    const result = hasValidIngressBackend(ingressNode, [svcNode], edgeMap);
    expect(result).toBe(true);
  });

  it('covers calculateReachability without allNodes argument (nodes || [] fallback)', () => {
    const startNode: Node = {
      id: 'start-1',
      type: 'Internet',
      data: {},
      position: { x: 0, y: 0 },
    };
    const edgeMap = new Map<string, Edge[]>([
      ['start-1', [{ id: 'e1', source: 'start-1', target: 'other-1' }]],
    ]);

    // Omit allNodes argument so nodes is undefined
    const reachable = calculateReachability([startNode], edgeMap, ['e1']);
    expect(reachable.has('start-1')).toBe(true);
    expect(reachable.has('other-1')).toBe(true);
  });

  it('covers Service with undefined serviceType and Ingress with missing backendName during reachability traversal', () => {
    const svcNode: Node = {
      id: 'svc-default',
      type: 'Service',
      data: {
        // serviceType undefined -> fallback to ClusterIP
        selector: 'app=web',
      },
      position: { x: 0, y: 0 },
    };
    const podNode: Node = {
      id: 'pod-1',
      type: 'Pod',
      data: { label: 'web', selector: 'app=web' },
      position: { x: 0, y: 0 },
    };
    const ingressNode: Node = {
      id: 'ing-no-backend',
      type: 'Ingress',
      data: {
        // neither backendServiceName nor serviceName provided
      },
      position: { x: 0, y: 0 },
    };

    const edgeMap = new Map<string, Edge[]>([
      ['svc-default', [{ id: 'e-svc-pod', source: 'svc-default', target: 'pod-1' }]],
      ['ing-no-backend', []],
    ]);

    const allNodes = [svcNode, podNode, ingressNode];
    const reachable = calculateReachability([svcNode, ingressNode], edgeMap, ['e-svc-pod'], allNodes);
    expect(reachable.has('svc-default')).toBe(true);
    expect(reachable.has('ing-no-backend')).toBe(true);
  });

  it('covers isInternetConnectionRed when Service has no matching workloads and no Ingress target', () => {
    const internetNode: Node = {
      id: 'i1',
      type: 'Internet',
      data: {},
      position: { x: 0, y: 0 },
    };
    const svcNode: Node = {
      id: 'svc-isolated',
      type: 'Service',
      data: { selector: 'non-matching-selector' }, // no serviceType -> fallback ClusterIP
      position: { x: 0, y: 0 },
    };

    const ctx: SimulationContext = {
      nodes: [internetNode, svcNode],
      edges: [{ id: 'e1', source: 'i1', target: 'svc-isolated' }],
      edgeMap: new Map([['i1', [{ id: 'e1', source: 'i1', target: 'svc-isolated' }]]]),
      nodeMap: new Map([['i1', internetNode], ['svc-isolated', svcNode]]),
      activeSimulationEdges: ['e1'],
      simulationMetrics: {},
    };

    // checkNodeUnreadyInternal returns true because outgoing is empty, no Ingress target, and serviceType is ClusterIP
    const isRed = isInternetConnectionRed(internetNode, ctx);
    expect(isRed).toBe(true);
  });

  it('covers enqueueDynamicIngressTargets early return when backendName is missing on Ingress with valid edge', () => {
    const ingNode: Node = {
      id: 'ing-edge-only',
      type: 'Ingress',
      data: {}, // no backendServiceName or serviceName
      position: { x: 0, y: 0 },
    };
    const svcNode: Node = {
      id: 'svc-clusterip',
      type: 'Service',
      data: { serviceType: 'ClusterIP', selector: 'app=web' },
      position: { x: 0, y: 0 },
    };
    const podNode: Node = {
      id: 'pod-1',
      type: 'Pod',
      data: { label: 'web', selector: 'app=web' },
      position: { x: 0, y: 0 },
    };

    const edgeMap = new Map([
      ['ing-edge-only', [{ id: 'e-ing-svc', source: 'ing-edge-only', target: 'svc-clusterip' }]],
      ['svc-clusterip', [{ id: 'e-svc-pod', source: 'svc-clusterip', target: 'pod-1' }]],
    ]);

    const allNodes = [ingNode, svcNode, podNode];
    // Traversal reaches ing-edge-only, which hasValidIngressBackend (via edge), but line 95 !backendName returns early!
    const reachable = calculateReachability([ingNode], edgeMap, ['e-ing-svc', 'e-svc-pod'], allNodes);
    expect(reachable.has('ing-edge-only')).toBe(true);
    expect(reachable.has('svc-clusterip')).toBe(true);
  });

  it('covers isInternetConnectionRed when Ingress downstream has no valid backend (line 183)', () => {
    const internetNode: Node = {
      id: 'i1',
      type: 'Internet',
      data: {},
      position: { x: 0, y: 0 },
    };
    const invalidIngressNode: Node = {
      id: 'ing-invalid',
      type: 'Ingress',
      data: { backendServiceName: 'non-existent-service' },
      position: { x: 0, y: 0 },
    };

    const edgeMap = new Map([
      ['i1', [{ id: 'e-invalid', source: 'i1', target: 'ing-invalid' }]],
    ]);

    const ctx: SimulationContext = {
      nodes: [internetNode, invalidIngressNode],
      edges: [{ id: 'e-invalid', source: 'i1', target: 'ing-invalid' }],
      edgeMap,
      nodeMap: new Map([['i1', internetNode], ['ing-invalid', invalidIngressNode]]),
      activeSimulationEdges: ['e-invalid'],
      simulationMetrics: {},
    };

    const isRed = isInternetConnectionRed(internetNode, ctx);
    expect(isRed).toBe(true);
  });

  it('covers isInternetConnectionRed matching ReplicaSet workload type in checkNodeUnreadyInternal', () => {
    const internetNode: Node = {
      id: 'i1',
      type: 'Internet',
      data: {},
      position: { x: 0, y: 0 },
    };
    const svcNode: Node = {
      id: 'svc-rs',
      type: 'Service',
      data: { selector: 'worker', serviceType: 'ClusterIP' },
      position: { x: 0, y: 0 },
    };
    const rsNode: Node = {
      id: 'rs-1',
      type: 'ReplicaSet',
      data: { label: 'worker', status: 'ready' },
      position: { x: 0, y: 0 },
    };

    const edgeMap = new Map([
      ['i1', [{ id: 'e1', source: 'i1', target: 'svc-rs' }]],
      ['svc-rs', [{ id: 'e2', source: 'svc-rs', target: 'rs-1' }]],
    ]);

    const ctx: SimulationContext = {
      nodes: [internetNode, svcNode, rsNode],
      edges: [
        { id: 'e1', source: 'i1', target: 'svc-rs' },
        { id: 'e2', source: 'svc-rs', target: 'rs-1' },
      ],
      edgeMap,
      nodeMap: new Map([
        ['i1', internetNode],
        ['svc-rs', svcNode],
        ['rs-1', rsNode],
      ]),
      activeSimulationEdges: ['e1', 'e2'],
      simulationMetrics: {},
    };

    const isRed = isInternetConnectionRed(internetNode, ctx);
    expect(isRed).toBe(false);
  });

  it('enqueues dynamic Ingress targets from ingressPaths even when backendServiceName is empty', () => {
    const ingNode: Node = {
      id: 'ing-paths-only',
      type: 'Ingress',
      data: {
        backendServiceName: '',
        ingressPaths: [{ id: 'p1', path: '/api', serviceName: 'api-svc', servicePort: 80 }],
      },
      position: { x: 0, y: 0 },
    };
    const svcNode: Node = {
      id: 'svc-api',
      type: 'Service',
      data: { label: 'api-svc', serviceType: 'ClusterIP', selector: 'api-pod' },
      position: { x: 100, y: 0 },
    };
    const podNode: Node = {
      id: 'pod-api',
      type: 'Pod',
      data: { label: 'api-pod', status: 'ready' },
      position: { x: 200, y: 0 },
    };

    const reachable = calculateReachability(
      [ingNode],
      new Map(),
      new Set(),
      [ingNode, svcNode, podNode]
    );
    expect(reachable.has('svc-api')).toBe(true);
    expect(reachable.has('pod-api')).toBe(true);
  });

  it('covers isInternetConnectionRed when Ingress downstream has a valid backend (line 183 false branch)', () => {
    const internetNode: Node = {
      id: 'i1',
      type: 'Internet',
      data: {},
      position: { x: 0, y: 0 },
    };
    const validIngressNode: Node = {
      id: 'ing-valid',
      type: 'Ingress',
      data: { backendServiceName: 'valid-service' },
      position: { x: 0, y: 0 },
    };
    const svcNode: Node = {
      id: 'svc-1',
      type: 'Service',
      data: { label: 'valid-service', serviceType: 'ClusterIP', selector: 'app=web' },
      position: { x: 0, y: 0 },
    };
    const podNode: Node = {
      id: 'pod-1',
      type: 'Pod',
      data: { label: 'web', selector: 'app=web', status: 'ready' },
      position: { x: 0, y: 0 },
    };

    const edgeMap = new Map([
      ['i1', [{ id: 'e-ing', source: 'i1', target: 'ing-valid' }]],
      ['ing-valid', [{ id: 'e-svc', source: 'ing-valid', target: 'svc-1' }]],
      ['svc-1', [{ id: 'e-pod', source: 'svc-1', target: 'pod-1' }]],
    ]);

    const ctx: SimulationContext = {
      nodes: [internetNode, validIngressNode, svcNode, podNode],
      edges: [
        { id: 'e-ing', source: 'i1', target: 'ing-valid' },
        { id: 'e-svc', source: 'ing-valid', target: 'svc-1' },
        { id: 'e-pod', source: 'svc-1', target: 'pod-1' },
      ],
      edgeMap,
      nodeMap: new Map([
        ['i1', internetNode],
        ['ing-valid', validIngressNode],
        ['svc-1', svcNode],
        ['pod-1', podNode],
      ]),
      activeSimulationEdges: ['e-ing', 'e-svc', 'e-pod'],
      simulationMetrics: {},
    };

    const isRed = isInternetConnectionRed(internetNode, ctx);
    expect(isRed).toBe(false);
  });
  it('respects externalTrafficPolicy Local vs Cluster when calculating reachability for NodePort/LoadBalancer', () => {
    const localSvc: Node = {
      id: 'svc-local',
      type: 'Service',
      data: {
        serviceType: 'NodePort',
        selector: 'my-app',
        externalTrafficPolicy: 'Local',
        entryNode: 'worker-1',
      },
      position: { x: 0, y: 0 },
    };

    const podOnWorker1: Node = {
      id: 'pod-w1',
      type: 'Pod',
      data: { label: 'my-app', assignedNode: 'worker-1' },
      position: { x: 0, y: 0 },
    };

    const podOnWorker2: Node = {
      id: 'pod-w2',
      type: 'Pod',
      data: { label: 'my-app', assignedNode: 'worker-2' },
      position: { x: 0, y: 0 },
    };

    const edgeMap = new Map<string, Edge[]>();

    // 1. Local policy with target on worker-1 -> Reachable!
    const reachLocal1 = calculateReachability([localSvc], edgeMap, [], [localSvc, podOnWorker1]);
    expect(reachLocal1.has('pod-w1')).toBe(true);

    // 2. Local policy with target on worker-2 (no endpoints on worker-1) -> Blocked!
    const reachLocal2 = calculateReachability([localSvc], edgeMap, [], [localSvc, podOnWorker2]);
    expect(reachLocal2.has('pod-w2')).toBe(false);

    // 3. Cluster policy with target on worker-2 -> Reachable via extra hop!
    const clusterSvc: Node = {
      ...localSvc,
      data: { ...localSvc.data, externalTrafficPolicy: 'Cluster' },
    };
    const reachCluster = calculateReachability([clusterSvc], edgeMap, [], [clusterSvc, podOnWorker2]);
    expect(reachCluster.has('pod-w2')).toBe(true);

    // 4. Local policy with Deployment target having child pods on matching worker
    const deployNode: Node = {
      id: 'dep-target',
      type: 'Deployment',
      data: { label: 'my-app' },
      position: { x: 0, y: 0 },
    };
    const childOnWorker1: Node = {
      id: 'child-w1',
      type: 'Pod',
      parentId: 'dep-target',
      data: { assignedNode: 'worker-1' },
      position: { x: 0, y: 0 },
    };
    const depEdgeMap = new Map<string, Edge[]>([
      ['svc-local', [{ id: 'e1', source: 'svc-local', target: 'dep-target' } as Edge]],
    ]);
    const reachDepMatch = calculateReachability(
      [localSvc],
      depEdgeMap,
      [],
      [localSvc, deployNode, childOnWorker1]
    );
    expect(reachDepMatch.has('dep-target')).toBe(true);

    // 5. Local policy with Deployment having child pods only on non-matching worker
    const childOnWorker2: Node = {
      id: 'child-w2',
      type: 'Pod',
      parentId: 'dep-target',
      data: { assignedNode: 'worker-2' },
      position: { x: 0, y: 0 },
    };
    const reachDepBlocked = calculateReachability(
      [localSvc],
      depEdgeMap,
      [],
      [localSvc, deployNode, childOnWorker2]
    );
    expect(reachDepBlocked.has('dep-target')).toBe(false);

    // 6. Local policy with Deployment fallback assignedNode on itself
    const depWithNode: Node = {
      id: 'dep-standalone-node',
      type: 'Deployment',
      data: { label: 'my-app', assignedNode: 'worker-1' },
      position: { x: 0, y: 0 },
    };
    const fallbackEdgeMap = new Map<string, Edge[]>([
      ['svc-local', [{ id: 'e2', source: 'svc-local', target: 'dep-standalone-node' } as Edge]],
    ]);
    const reachFallback = calculateReachability(
      [localSvc],
      fallbackEdgeMap,
      [],
      [localSvc, depWithNode]
    );
    expect(reachFallback.has('dep-standalone-node')).toBe(true);

    // 7. Local policy with undefined entryNode (falls back to 'worker-1')
    const svcNoEntryNode: Node = {
      id: 'svc-no-entry',
      type: 'Service',
      data: {
        serviceType: 'LoadBalancer',
        selector: 'my-app',
        externalTrafficPolicy: 'Local',
        // entryNode omitted to trigger fallback to 'worker-1'
      },
      position: { x: 0, y: 0 },
    };
    const reachDefaultEntry = calculateReachability(
      [svcNoEntryNode],
      edgeMap,
      [],
      [svcNoEntryNode, podOnWorker1]
    );
    expect(reachDefaultEntry.has('pod-w1')).toBe(true);

    // 8. Deployment target when nodes contains an unrelated Pod (type === 'Pod' but parentId !== node.id)
    const unrelatedPod: Node = {
      id: 'unrelated-pod',
      type: 'Pod',
      parentId: 'different-parent',
      data: { assignedNode: 'worker-1' },
      position: { x: 0, y: 0 },
    };
    const reachUnrelatedPod = calculateReachability(
      [localSvc],
      depEdgeMap,
      [],
      [localSvc, deployNode, unrelatedPod, childOnWorker1]
    );
    expect(reachUnrelatedPod.has('dep-target')).toBe(true);
  });
});
