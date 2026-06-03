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

const createNode = (id: string, type: string, data: any = {}): Node => ({
  id, type, data, position: { x: 0, y: 0 }
} as Node);

const baseNodes = [
    createNode('d1', 'Deployment', { replicas: 1, cpuLimit: '1000m', memoryLimit: '1024Mi' }),
    createNode('i1', 'Internet', { traffic: 1000, currentTraffic: 0 }),
    createNode('pvc1', 'PVC', { pvcStatus: 'Pending' }),
    createNode('h1', 'HPA', { targetCPU: 50, minReplicas: 1, maxReplicas: 10 })
];

const baseEdge = { id: 'e1', source: 'i1', target: 'd1' } as Edge;

const getMockCtx = (overrides: Partial<SimulationContext> = {}): SimulationContext => {
    const nodes = [...baseNodes];
    return {
        nodes,
        edges: [baseEdge],
        activeSimulationEdges: [],
        updatedNodes: nodes.map(n => ({ ...n, data: { ...n.data } })),
        newMetrics: {},
        ticks: 0,
        get: vi.fn().mockReturnValue({ nodes }),
        set: vi.fn(),
        edgeMap: new Map([['i1', [baseEdge]]]),
        targetEdgeMap: new Map([['d1', [baseEdge]]]),
        nodeMap: new Map(nodes.map(n => [n.id, n])),
        nodeIndexMap: new Map(nodes.map((n, i) => [n.id, i])),
        ...overrides
    } as SimulationContext;
};

describe('simulation test suite', () => {
  it('safeRandom returns valid range', () => {
    const v = safeRandom();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it.each([
    { active: ['e1'], expected: true },
    { active: [], expected: false }
  ])('reachability: %o', ({ active, expected }) => {
    const ctx = getMockCtx();
    expect(calculateReachability([baseNodes[1]], ctx.edgeMap!, active).has('d1')).toBe(expected);
  });

  it('internet traffic logic', () => {
    const ctx = getMockCtx();
    const res = updateInternetTraffic(baseNodes[1], ctx);
    expect(res.traffic).toBe(1000);
    expect(ctx.updatedNodes[1].data.currentTraffic).toBe(1000);
  });

  it.each([
    { incoming: 5000, limit: '1024Mi', expectOom: false },
    { incoming: 10000, limit: '10Mi', expectOom: true }
  ])('resource metrics: %o', ({ incoming, limit, expectOom }) => {
    const dep = createNode('dx', 'Deployment', { replicas: 1, cpuLimit: '1000m', memoryLimit: limit });
    const res = calculateResourceMetrics(dep, incoming, getMockCtx());
    expect(res.isOOM).toBe(expectOom);
  });

  it('pvc readiness logic', () => {
    const ctx = getMockCtx();
    const epvc = { id: 'epvc', source: 'd1', target: 'pvc1' } as Edge;
    ctx.edgeMap!.set('d1', [epvc]);
    expect(checkPvcReadiness(baseNodes[0], ctx).isBlocked).toBe(true);

    const boundPvc = { ...baseNodes[2], data: { pvcStatus: 'Bound' } };
    const boundCtx = getMockCtx({
        nodes: [baseNodes[0], baseNodes[1], boundPvc, baseNodes[3]],
        nodeMap: new Map([['d1', baseNodes[0]], ['i1', baseNodes[1]], ['pvc1', boundPvc], ['h1', baseNodes[3]]])
    });
    boundCtx.edgeMap!.set('d1', [epvc]);
    expect(checkPvcReadiness(boundCtx.nodes[0], boundCtx).isBlocked).toBe(false);
  });

  it('incoming traffic calculation', () => {
    const ctx = getMockCtx({
      internetNodes: [createNode('i1', 'Internet', { currentTraffic: 5000 })],
      internetReachableMap: new Map([['i1', new Set(['d1'])]])
    });
    expect(calculateIncomingTraffic(baseNodes[0], ctx).traffic).toBe(5000);
  });

  it('hpa scaling execution', () => {
    const ctx = getMockCtx();
    ctx.targetEdgeMap!.set('d1', [{ id: 'ehpa', source: 'h1', target: 'd1' } as Edge]);
    expect(handleHpaScaling(baseNodes[0], 100, ctx)).toBe(true);
    expect(ctx.updatedNodes.find(n => n.id === 'd1')?.data.replicas).toBe(2);
  });
});
