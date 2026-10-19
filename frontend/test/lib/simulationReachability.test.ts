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
});
