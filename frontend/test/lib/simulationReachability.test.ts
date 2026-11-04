import { describe, it, expect } from 'vitest';
import { Node, Edge } from '@xyflow/react';
import {
  hasValidIngressBackend,
  hasValidServiceSelectorTarget,
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
  it('validates StatefulSet selector matching, dynamic reachability, and readiness checks', () => {
    // 1. hasValidServiceSelectorTarget matching StatefulSet
    const svcNode: Node = {
      id: 'svc-stateful',
      type: 'Service',
      data: { selector: 'mysql-cluster', serviceType: 'ClusterIP' },
      position: { x: 0, y: 0 },
    };
    const ssNode: Node = {
      id: 'ss-1',
      type: 'StatefulSet',
      data: { label: 'mysql-cluster', status: 'ready' },
      position: { x: 0, y: 0 },
    };
    const childPodReady: Node = {
      id: 'pod-mysql-0',
      type: 'Pod',
      parentId: 'ss-1',
      data: { label: 'mysql-cluster-0', status: 'ready' },
      position: { x: 0, y: 0 },
    };

    const hasTarget = hasValidServiceSelectorTarget(svcNode, [ssNode]);
    expect(hasTarget).toBe(true);

    // 2. Dynamic reachability enqueues StatefulSet target without explicit canvas edge
    const reachStateful = calculateReachability(
      [svcNode],
      new Map(),
      [],
      [svcNode, ssNode]
    );
    expect(reachStateful.has('ss-1')).toBe(true);

    // 3. StatefulSet child pod unready causes downstream path unready (isInternetConnectionRed = true)
    const internetNode: Node = {
      id: 'internet-1',
      type: 'Internet',
      data: {},
      position: { x: 0, y: 0 },
    };
    const lbSvc: Node = {
      id: 'svc-lb-ss',
      type: 'Service',
      data: { serviceType: 'LoadBalancer', selector: 'mysql-cluster' },
      position: { x: 0, y: 0 },
    };
    const unreadyChildPod: Node = {
      id: 'pod-mysql-1',
      type: 'Pod',
      parentId: 'ss-1',
      data: { label: 'mysql-cluster-1', status: 'pending' },
      position: { x: 0, y: 0 },
    };

    const edgeMap = new Map<string, Edge[]>([
      ['internet-1', [{ id: 'e-in', source: 'internet-1', target: 'svc-lb-ss' } as Edge]],
      ['svc-lb-ss', [{ id: 'e-ss', source: 'svc-lb-ss', target: 'ss-1' } as Edge]],
    ]);

    const ctxUnready: SimulationContext = {
      nodes: [internetNode, lbSvc, ssNode, childPodReady, unreadyChildPod],
      edges: [
        { id: 'e-in', source: 'internet-1', target: 'svc-lb-ss' },
        { id: 'e-ss', source: 'svc-lb-ss', target: 'ss-1' },
      ],
      edgeMap,
      nodeMap: new Map([
        ['internet-1', internetNode],
        ['svc-lb-ss', lbSvc],
        ['ss-1', ssNode],
        ['pod-mysql-0', childPodReady],
        ['pod-mysql-1', unreadyChildPod],
      ]),
      activeSimulationEdges: ['e-in', 'e-ss'],
      simulationMetrics: {},
    };

    expect(isInternetConnectionRed(internetNode, ctxUnready)).toBe(true);

    // 4. When all child pods are ready and StatefulSet is ready, downstream is healthy
    const ctxReady: SimulationContext = {
      ...ctxUnready,
      nodes: [internetNode, lbSvc, ssNode, childPodReady],
      nodeMap: new Map([
        ['internet-1', internetNode],
        ['svc-lb-ss', lbSvc],
        ['ss-1', ssNode],
        ['pod-mysql-0', childPodReady],
      ]),
    };
    expect(isInternetConnectionRed(internetNode, ctxReady)).toBe(false);
  });

  it('enforces namespace boundary for service selector and ingress backend routing', () => {
    const nsStaging: Node = { id: 'ns-staging', type: 'Namespace', data: { label: 'staging' }, position: { x: 0, y: 0 } };
    const nsProd: Node = { id: 'ns-prod', type: 'Namespace', data: { label: 'production' }, position: { x: 0, y: 0 } };

    // Service in staging with selector "web"
    const svcStaging: Node = {
      id: 'svc-staging',
      type: 'Service',
      parentId: 'ns-staging',
      data: { label: 'web-svc', selector: 'web', serviceType: 'ClusterIP' },
      position: { x: 0, y: 0 },
    };

    // Pod in production with label "web"
    const podProd: Node = {
      id: 'pod-prod',
      type: 'Pod',
      parentId: 'ns-prod',
      data: { label: 'web', status: 'ready' },
      position: { x: 0, y: 0 },
    };

    // Pod in staging with label "web"
    const podStaging: Node = {
      id: 'pod-staging',
      type: 'Pod',
      parentId: 'ns-staging',
      data: { label: 'web', status: 'ready' },
      position: { x: 0, y: 0 },
    };

    const allNodesCrossNs = [nsStaging, nsProd, svcStaging, podProd];

    // 1. Service in staging should NOT match Pod in production despite matching selector
    expect(hasValidServiceSelectorTarget(svcStaging, allNodesCrossNs)).toBe(false);

    // 2. Service in staging DOES match Pod in staging
    const allNodesSameNs = [nsStaging, nsProd, svcStaging, podStaging];
    expect(hasValidServiceSelectorTarget(svcStaging, allNodesSameNs)).toBe(true);

    // 3. Dynamic service reachability: traffic from svc-staging should NOT reach pod-prod
    const edgeMap = new Map<string, Edge[]>([
      ['svc-staging', []],
    ]);
    const reachableCross = calculateReachability([svcStaging], edgeMap, [], allNodesCrossNs);
    expect(reachableCross.has('svc-staging')).toBe(true);
    expect(reachableCross.has('pod-prod')).toBe(false);

    // 4. Dynamic service reachability: traffic from svc-staging DOES reach pod-staging
    const reachableSame = calculateReachability([svcStaging], edgeMap, [], allNodesSameNs);
    expect(reachableSame.has('pod-staging')).toBe(true);

    // 5. Ingress in staging with backendServiceName: 'web-svc'
    const ingressStaging: Node = {
      id: 'ing-staging',
      type: 'Ingress',
      parentId: 'ns-staging',
      data: { backendServiceName: 'web-svc' },
      position: { x: 0, y: 0 },
    };

    // Service in production named 'web-svc'
    const svcProd: Node = {
      id: 'svc-prod',
      type: 'Service',
      parentId: 'ns-prod',
      data: { label: 'web-svc', serviceType: 'ClusterIP' },
      position: { x: 0, y: 0 },
    };

    // Ingress in staging should NOT accept backend Service in production
    expect(hasValidIngressBackend(ingressStaging, [nsStaging, nsProd, ingressStaging, svcProd])).toBe(false);

    // Ingress in staging DOES accept backend Service in staging
    expect(hasValidIngressBackend(ingressStaging, [nsStaging, nsProd, ingressStaging, svcStaging])).toBe(true);

    // Dynamic ingress reachability: Ingress in staging cannot reach Service in prod
    const ingressEdgeMap = new Map<string, Edge[]>([
      ['ing-staging', []],
    ]);
    const ingressReachableCross = calculateReachability([ingressStaging], ingressEdgeMap, [], [nsStaging, nsProd, ingressStaging, svcProd]);
    expect(ingressReachableCross.has('svc-prod')).toBe(false);

    // Dynamic ingress reachability: Ingress in staging reaches Service in staging
    const ingressReachableSame = calculateReachability([ingressStaging], ingressEdgeMap, [], [nsStaging, nsProd, ingressStaging, svcStaging]);
    expect(ingressReachableSame.has('svc-staging')).toBe(true);
  });
});
