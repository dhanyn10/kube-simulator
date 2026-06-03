import { describe, it, expect, vi } from 'vitest';
import {
  calculateReachability,
  updateInternetTraffic,
  SimulationContext,
  calculateResourceMetrics,
  checkPvcReadiness,
  calculateIncomingTraffic,
  handleHpaScaling
} from '@/lib/simulation';
import { safeRandom } from '@/lib/utils';
import { Node, Edge } from '@xyflow/react';

describe('simulation utils', () => {
  it('safeRandom returns a number between 0 and 1', () => {
    const val = safeRandom();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(1);
  });

  it('calculateReachability identifies reachable nodes', () => {
    const nodes: Node[] = [
      { id: '1', data: {}, position: { x: 0, y: 0 } } as Node,
      { id: '2', data: {}, position: { x: 0, y: 0 } } as Node,
      { id: '3', data: {}, position: { x: 0, y: 0 } } as Node,
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
    ];
    const activeEdges = ['e1-2', 'e2-3'];

    const edgeMap = new Map<string, Edge[]>();
    edgeMap.set('1', [edges[0]]);
    edgeMap.set('2', [edges[1]]);

    const reachable = calculateReachability([nodes[0]], edgeMap, activeEdges);
    expect(reachable.has('1')).toBe(true);
    expect(reachable.has('2')).toBe(true);
    expect(reachable.has('3')).toBe(true);
  });

  it('calculateReachability respects active edges', () => {
     const nodes: Node[] = [
      { id: '1', data: {}, position: { x: 0, y: 0 } } as Node,
      { id: '2', data: {}, position: { x: 0, y: 0 } } as Node,
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2' },
    ];
    const activeEdges: string[] = [];

    const edgeMap = new Map<string, Edge[]>();
    edgeMap.set('1', [edges[0]]);

    const reachable = calculateReachability([nodes[0]], edgeMap, activeEdges);
    expect(reachable.has('1')).toBe(true);
    expect(reachable.has('2')).toBe(false);
  });

  describe('updateInternetTraffic', () => {
    const mockCtx = (updatedNodes: Node[] = []): SimulationContext => ({
      nodes: [],
      edges: [],
      activeSimulationEdges: [],
      updatedNodes,
      newMetrics: {},
      ticks: 0,
      get: vi.fn(),
      set: vi.fn()
    });

    it('handles missing traffic and currentTraffic', () => {
      const internetNode: Node = { id: 'i1', data: {}, position: { x: 0, y: 0 } } as Node;
      const updatedNodes: Node[] = [structuredClone(internetNode)];
      const ctx = mockCtx(updatedNodes);

      const result = updateInternetTraffic(internetNode, ctx);

      expect(result.traffic).toBe(1000); // target defaults to 1000, current defaults to 0, next is 0 + 1000
      expect(result.hasChanges).toBe(true);
      expect(ctx.updatedNodes[0].data.currentTraffic).toBe(1000);
    });

    it('maintains traffic when target reached', () => {
      const internetNode: Node = { id: 'i1', data: { traffic: 2000, currentTraffic: 2000 }, position: { x: 0, y: 0 } } as Node;
      const updatedNodes: Node[] = [structuredClone(internetNode)];
      const ctx = mockCtx(updatedNodes);

      const result = updateInternetTraffic(internetNode, ctx);

      expect(result.traffic).toBe(2000);
      expect(result.hasChanges).toBe(false);
    });
  });

  describe('calculateResourceMetrics', () => {
    const mockCtx = (): SimulationContext => ({
      nodes: [],
      edges: [],
      activeSimulationEdges: [],
      updatedNodes: [],
      newMetrics: {},
      ticks: 0,
      get: vi.fn(),
      set: vi.fn()
    });

    it('calculates metrics based on traffic', () => {
      const depNode: Node = {
        id: 'd1',
        type: 'Deployment',
        data: { replicas: 1, cpuLimit: '1000m', memoryLimit: '1024Mi' },
        position: { x: 0, y: 0 }
      } as Node;
      const ctx = mockCtx();

      const result = calculateResourceMetrics(depNode, 5000, ctx);

      expect(result.cpuPercent).toBeGreaterThan(0);
      expect(ctx.newMetrics['d1']).toHaveLength(1);
      expect(ctx.newMetrics['d1'][0].cpuLimit).toBe(1000);
    });

    it('detects OOM when memory limit exceeded', () => {
       const depNode: Node = {
        id: 'd1',
        type: 'Deployment',
        data: { replicas: 1, cpuLimit: '1000m', memoryLimit: '50Mi' }, // Very low limit
        position: { x: 0, y: 0 }
      } as Node;
      const ctx = mockCtx();

      // Traffic 10000 -> memValue ~ ((10000/1000)*128/1) + 100 = 1380 Mi
      const result = calculateResourceMetrics(depNode, 10000, ctx);
      expect(result.isOOM).toBe(true);
    });
  });

  describe('checkPvcReadiness', () => {
    it('returns isBlocked: false when no PVCs are connected', () => {
      const dep: Node = { id: 'd1', type: 'Deployment', data: {}, position: { x: 0, y: 0 } } as Node;
      const ctx: SimulationContext = {
        nodes: [dep],
        edges: [],
        activeSimulationEdges: [],
        updatedNodes: [],
        newMetrics: {},
        ticks: 0,
        get: vi.fn(),
        set: vi.fn(),
        edgeMap: new Map(),
        nodeMap: new Map([['d1', dep]])
      };

      const result = checkPvcReadiness(dep, ctx);
      expect(result.isBlocked).toBe(false);
    });

    it('returns isBlocked: true when connected PVC is Pending', () => {
      const dep: Node = { id: 'd1', type: 'Deployment', data: {}, position: { x: 0, y: 0 } } as Node;
      const pvc: Node = { id: 'pvc1', type: 'PVC', data: { pvcStatus: 'Pending' }, position: { x: 0, y: 0 } } as Node;
      const edge: Edge = { id: 'e1', source: 'd1', target: 'pvc1' };

      const ctx: SimulationContext = {
        nodes: [dep, pvc],
        edges: [edge],
        activeSimulationEdges: [],
        updatedNodes: [structuredClone(dep), structuredClone(pvc)],
        newMetrics: {},
        ticks: 0,
        get: vi.fn(),
        set: vi.fn(),
        edgeMap: new Map([['d1', [edge]]]),
        nodeMap: new Map([['d1', dep], ['pvc1', pvc]]),
        childPodMap: new Map()
      };

      const result = checkPvcReadiness(dep, ctx);
      expect(result.isBlocked).toBe(true);
    });
  });

  describe('calculateIncomingTraffic', () => {
    it('calculates traffic from internet nodes', () => {
      const dep: Node = { id: 'd1', type: 'Deployment', data: {}, position: { x: 0, y: 0 } } as Node;
      const internetNode: Node = { id: 'i1', type: 'Internet', data: { currentTraffic: 5000 }, position: { x: 0, y: 0 } } as Node;

      const ctx: SimulationContext = {
        nodes: [dep, internetNode],
        edges: [],
        activeSimulationEdges: [],
        updatedNodes: [],
        newMetrics: {},
        ticks: 0,
        get: vi.fn(),
        set: vi.fn(),
        internetNodes: [internetNode],
        internetReachableMap: new Map([['i1', new Set(['d1'])]]),
        childPodMap: new Map()
      };

      const result = calculateIncomingTraffic(dep, ctx);
      expect(result.traffic).toBe(5000);
    });

    it('returns 0 when not reachable', () => {
      const dep: Node = { id: 'd1', type: 'Deployment', data: {}, position: { x: 0, y: 0 } } as Node;
      const internetNode: Node = { id: 'i1', type: 'Internet', data: { currentTraffic: 5000 }, position: { x: 0, y: 0 } } as Node;

      const ctx: SimulationContext = {
        nodes: [dep, internetNode],
        edges: [],
        activeSimulationEdges: [],
        updatedNodes: [],
        newMetrics: {},
        ticks: 0,
        get: vi.fn(),
        set: vi.fn(),
        internetNodes: [internetNode],
        internetReachableMap: new Map([['i1', new Set()]]),
        childPodMap: new Map()
      };

      const result = calculateIncomingTraffic(dep, ctx);
      expect(result.traffic).toBe(0);
    });
  });

  describe('handleHpaScaling', () => {
    it('returns false when no HPA connected', () => {
      const dep: Node = { id: 'd1', type: 'Deployment', data: { replicas: 1 }, position: { x: 0, y: 0 } } as Node;
      const ctx: SimulationContext = {
        nodes: [dep],
        edges: [],
        activeSimulationEdges: [],
        updatedNodes: [structuredClone(dep)],
        newMetrics: {},
        ticks: 0,
        get: vi.fn(),
        set: vi.fn(),
        targetEdgeMap: new Map(),
        nodeMap: new Map([['d1', dep]])
      };

      const changed = handleHpaScaling(dep, 100, ctx);
      expect(changed).toBe(false);
    });

    it('scales up when CPU is above target', () => {
      const dep: Node = { id: 'd1', type: 'Deployment', data: { replicas: 1 }, position: { x: 0, y: 0 } } as Node;
      const hpa: Node = { id: 'h1', type: 'HPA', data: { targetCPU: 50, minReplicas: 1, maxReplicas: 10 }, position: { x: 0, y: 0 } } as Node;
      const edge: Edge = { id: 'e1', source: 'h1', target: 'd1' };

      const ctx: SimulationContext = {
        nodes: [dep, hpa],
        edges: [edge],
        activeSimulationEdges: [],
        updatedNodes: [structuredClone(dep), structuredClone(hpa)],
        newMetrics: {},
        ticks: 0,
        get: vi.fn().mockReturnValue({ nodes: [dep, hpa] }),
        set: vi.fn(),
        targetEdgeMap: new Map([['d1', [edge]]]),
        nodeMap: new Map([['h1', hpa], ['d1', dep]]),
        nodeIndexMap: new Map([['d1', 0], ['h1', 1]])
      };

      // cpuPercent = 100, target = 50 -> ratio = 2 -> desired = 2
      const changed = handleHpaScaling(dep, 100, ctx);
      expect(changed).toBe(true);
      // The deployment node in updatedNodes should now have replicas: 2
      const updatedDep = ctx.updatedNodes.find(n => n.id === 'd1');
      expect(updatedDep?.data.replicas).toBe(2);
    });
  });
});
