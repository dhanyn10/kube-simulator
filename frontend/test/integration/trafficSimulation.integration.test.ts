import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFlowStore } from '@/store';
import {
  calculateReachability,
  hasValidIngressBackend,
  hasValidServiceSelectorTarget,
  isServiceSelectorMatching,
} from '@/lib/simulationReachability';
import type { Node, Edge } from '@xyflow/react';

describe('Traffic Simulation & Reachability Integration Tests', () => {
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

  it('calculates reachable nodes across Internet, Ingress, Service, and Pod chain', () => {
    const internetNode: Node = {
      id: 'net-1',
      type: 'Internet',
      position: { x: 0, y: 100 },
      data: { label: 'Internet', traffic: 100 },
    };

    const ingressNode: Node = {
      id: 'ing-1',
      type: 'Ingress',
      position: { x: 200, y: 100 },
      data: {
        label: 'main-ingress',
        ingressHost: 'app.local',
        ingressPath: '/',
        backendServiceName: 'web-service',
      },
    };

    const serviceNode: Node = {
      id: 'svc-1',
      type: 'Service',
      position: { x: 450, y: 100 },
      data: {
        label: 'web-service',
        serviceType: 'ClusterIP',
        port: 80,
        targetPort: 8080,
        selector: 'web-pod',
      },
    };

    const podNode: Node = {
      id: 'pod-1',
      type: 'Pod',
      position: { x: 700, y: 100 },
      data: {
        label: 'web-pod',
        status: 'ready',
        port: 8080,
      },
    };

    const edges: Edge[] = [
      { id: 'e-net-ing', source: 'net-1', target: 'ing-1' },
      { id: 'e-ing-svc', source: 'ing-1', target: 'svc-1' },
      { id: 'e-svc-pod', source: 'svc-1', target: 'pod-1' },
    ];

    const nodes = [internetNode, ingressNode, serviceNode, podNode];

    useFlowStore.setState({ nodes, edges });

    // Step 1: Verify valid selector and ingress routing
    expect(isServiceSelectorMatching(serviceNode, podNode)).toBe(true);
    expect(hasValidServiceSelectorTarget(serviceNode, nodes)).toBe(true);
    expect(hasValidIngressBackend(ingressNode, nodes)).toBe(true);

    // Step 2: Calculate reachable nodes from Internet entry
    const edgeMap = new Map<string, Edge[]>();
    edges.forEach((e) => {
      if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
      edgeMap.get(e.source)!.push(e);
    });

    const activeEdgeIds = edges.map((e) => e.id);
    const reachable = calculateReachability([internetNode], edgeMap, activeEdgeIds, nodes);

    // All 4 nodes in the chain should be reachable
    expect(reachable.has('net-1')).toBe(true);
    expect(reachable.has('ing-1')).toBe(true);
    expect(reachable.has('svc-1')).toBe(true);
    expect(reachable.has('pod-1')).toBe(true);
  });

  it('detects unready backend and adjusts selector targeting for broken service', () => {
    const internetNode: Node = {
      id: 'net-multi',
      type: 'Internet',
      position: { x: 0, y: 100 },
      data: { label: 'Internet', traffic: 150 },
    };

    const svcHealthy: Node = {
      id: 'svc-healthy',
      type: 'Service',
      position: { x: 250, y: 50 },
      data: { label: 'api-service', serviceType: 'ClusterIP', selector: 'api-pod' },
    };

    const podHealthy: Node = {
      id: 'pod-api',
      type: 'Pod',
      position: { x: 500, y: 50 },
      data: { label: 'api-pod', status: 'ready' },
    };

    const svcBroken: Node = {
      id: 'svc-broken',
      type: 'Service',
      position: { x: 250, y: 200 },
      data: { label: 'orphan-service', serviceType: 'ClusterIP', selector: 'missing-pod' },
    };

    const edges: Edge[] = [
      { id: 'e-net-healthy', source: 'net-multi', target: 'svc-healthy' },
      { id: 'e-healthy-pod', source: 'svc-healthy', target: 'pod-api' },
      { id: 'e-net-broken', source: 'net-multi', target: 'svc-broken' },
    ];

    const nodes = [internetNode, svcHealthy, podHealthy, svcBroken];
    useFlowStore.setState({ nodes, edges });

    // The healthy service has a target, broken service has no matching target
    expect(hasValidServiceSelectorTarget(svcHealthy, nodes)).toBe(true);
    expect(hasValidServiceSelectorTarget(svcBroken, nodes)).toBe(false);

    const edgeMap = new Map<string, Edge[]>();
    edges.forEach((e) => {
      if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
      edgeMap.get(e.source)!.push(e);
    });

    // Reachability calculation only includes edges that are actively simulated
    const activeHealthyEdges = ['e-net-healthy', 'e-healthy-pod'];
    const reachable = calculateReachability([internetNode], edgeMap, activeHealthyEdges, nodes);

    expect(reachable.has('svc-healthy')).toBe(true);
    expect(reachable.has('pod-api')).toBe(true);
    expect(reachable.has('svc-broken')).toBe(false);
  });
});
