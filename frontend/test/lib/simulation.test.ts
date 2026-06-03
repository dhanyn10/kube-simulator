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

const createMockNode = (id: string, type: string, data: any = {}): Node => ({
  id,
  type,
  data,
  position: { x: 0, y: 0 }
} as Node);

const createMockCtx = (overrides: Partial<SimulationContext> = {}): SimulationContext => ({
  nodes: [],
  edges: [],
  activeSimulationEdges: [],
  updatedNodes: [],
  newMetrics: {},
  ticks: 0,
  get: vi.fn(),
  set: vi.fn(),
  edgeMap: new Map(),
  nodeMap: new Map(),
  ...overrides
});

describe('simulation utils', () => {
  it('safeRandom returns a number between 0 and 1', () => {
    const val = safeRandom();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(1);
  });

  it('calculateReachability identifies reachable nodes', () => {
    const nodes = [
      createMockNode('1', 'Deployment'),
      createMockNode('2', 'Pod'),
      createMockNode('3', 'PVC'),
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
    ];
    const activeEdges = ['e1-2', 'e2-3'];

    const edgeMap = new Map<string, Edge[]>();
    edgeMap.set('1', [edges[0]]);
    edgeMap.set('2', [edges[1]]);

    const reachable = calculateReachability(nodes.slice(0, 1), edgeMap, activeEdges);
    expect(reachable.has('1')).toBe(true);
    expect(reachable.has('2')).toBe(true);
    expect(reachable.has('3')).toBe(true);
  });

  it('calculateReachability respects active edges', () => {
    const nodes = [createMockNode('1', 'Internet'), createMockNode('2', 'Ingress')];
    const edges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }];
    const edgeMap = new Map([['1', [edges[0]]]]);

    const reachable = calculateReachability([nodes[0]], edgeMap, []);
    expect(reachable.has('1')).toBe(true);
    expect(reachable.has('2')).toBe(false);
  });

  describe('updateInternetTraffic', () => {
    it('handles missing traffic and currentTraffic', () => {
      const internetNode = createMockNode('i1', 'Internet');
      const ctx = createMockCtx({ updatedNodes: [structuredClone(internetNode)] });

      const result = updateInternetTraffic(internetNode, ctx);

      expect(result.traffic).toBe(1000);
      expect(result.hasChanges).toBe(true);
      expect(ctx.updatedNodes[0].data.currentTraffic).toBe(1000);
    });

    it('maintains traffic when target reached', () => {
      const internetNode = createMockNode('i1', 'Internet', { traffic: 2000, currentTraffic: 2000 });
      const ctx = createMockCtx({ updatedNodes: [structuredClone(internetNode)] });

      const result = updateInternetTraffic(internetNode, ctx);
      expect(result.traffic).toBe(2000);
      expect(result.hasChanges).toBe(false);
    });
  });

  describe('calculateResourceMetrics', () => {
    it('calculates metrics based on traffic', () => {
      const depNode = createMockNode('d1', 'Deployment', { replicas: 1, cpuLimit: '1000m', memoryLimit: '1024Mi' });
      const ctx = createMockCtx();

      const result = calculateResourceMetrics(depNode, 5000, ctx);
      expect(result.cpuPercent).toBeGreaterThan(0);
      expect(ctx.newMetrics['d1']).toHaveLength(1);
    });

    it('detects OOM when memory limit exceeded', () => {
      const depNode = createMockNode('d1', 'Deployment', { replicas: 1, cpuLimit: '1000m', memoryLimit: '50Mi' });
      const ctx = createMockCtx();

      const result = calculateResourceMetrics(depNode, 10000, ctx);
      expect(result.isOOM).toBe(true);
    });
  });

  describe('checkPvcReadiness', () => {
    it('returns isBlocked: false when no PVCs are connected', () => {
      const dep = createMockNode('d1', 'Deployment');
      const ctx = createMockCtx({ nodes: [dep], nodeMap: new Map([['d1', dep]]) });

      const result = checkPvcReadiness(dep, ctx);
      expect(result.isBlocked).toBe(false);
    });

    it('returns isBlocked: true when connected PVC is Pending', () => {
      const dep = createMockNode('d1', 'Deployment');
      const pvc = createMockNode('pvc1', 'PVC', { pvcStatus: 'Pending' });
      const edge = { id: 'e1', source: 'd1', target: 'pvc1' } as Edge;

      const ctx = createMockCtx({
        nodes: [dep, pvc],
        updatedNodes: [structuredClone(dep), structuredClone(pvc)],
        edgeMap: new Map([['d1', [edge]]]),
        nodeMap: new Map([['d1', dep], ['pvc1', pvc]]),
      });

      const result = checkPvcReadiness(dep, ctx);
      expect(result.isBlocked).toBe(true);
    });
  });

  describe('calculateIncomingTraffic', () => {
    it('calculates traffic from internet nodes', () => {
      const dep = createMockNode('d1', 'Deployment');
      const internetNode = createMockNode('i1', 'Internet', { currentTraffic: 5000 });

      const ctx = createMockCtx({
        nodes: [dep, internetNode],
        internetNodes: [internetNode],
        internetReachableMap: new Map([['i1', new Set(['d1'])]]),
      });

      const result = calculateIncomingTraffic(dep, ctx);
      expect(result.traffic).toBe(5000);
    });

    it('returns 0 when not reachable', () => {
      const dep = createMockNode('d1', 'Deployment');
      const internetNode = createMockNode('i1', 'Internet', { currentTraffic: 5000 });

      const ctx = createMockCtx({
        nodes: [dep, internetNode],
        internetNodes: [internetNode],
        internetReachableMap: new Map([['i1', new Set()]]),
      });

      const result = calculateIncomingTraffic(dep, ctx);
      expect(result.traffic).toBe(0);
    });
  });

  describe('handleHpaScaling', () => {
    it('returns false when no HPA connected', () => {
      const dep = createMockNode('d1', 'Deployment', { replicas: 1 });
      const ctx = createMockCtx({ updatedNodes: [structuredClone(dep)], nodeMap: new Map([['d1', dep]]) });

      const changed = handleHpaScaling(dep, 100, ctx);
      expect(changed).toBe(false);
    });

    it('scales up when CPU is above target', () => {
      const dep = createMockNode('d1', 'Deployment', { replicas: 1 });
      const hpa = createMockNode('h1', 'HPA', { targetCPU: 50, minReplicas: 1, maxReplicas: 10 });
      const edge = { id: 'e1', source: 'h1', target: 'd1' } as Edge;

      const ctx = createMockCtx({
        nodes: [dep, hpa],
        updatedNodes: [structuredClone(dep), structuredClone(hpa)],
        get: vi.fn().mockReturnValue({ nodes: [dep, hpa] }),
        targetEdgeMap: new Map([['d1', [edge]]]),
        nodeMap: new Map([['h1', hpa], ['d1', dep]]),
        nodeIndexMap: new Map([['d1', 0]])
      });

      const changed = handleHpaScaling(dep, 100, ctx);
      expect(changed).toBe(true);
      expect(ctx.updatedNodes.find(n => n.id === 'd1')?.data.replicas).toBe(2);
    });
  });
});
