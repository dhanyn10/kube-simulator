import { describe, it, expect, vi } from 'vitest';
import {
  calculateReachability,
  updateInternetTraffic,
  SimulationContext,
  calculateResourceMetrics,
  checkPvcReadiness,
  calculateIncomingTraffic,
  handleHpaScaling,
  updateNodeData,
  handleUnboundPvcs,
  handleBoundPvcs
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

  it('calculateReachability ignores edges with validationError', () => {
    const ctx = getMockCtx();
    const edgeWithError = { id: 'e1', source: 'i1', target: 'd1', data: { validationError: 'error' } } as any;
    const edgeMap = new Map([['i1', [edgeWithError]]]);
    expect(calculateReachability([baseNodes[1]], edgeMap, ['e1']).has('d1')).toBe(false);
  });

  it('internet traffic logic - increment', () => {
    const ctx = getMockCtx();
    const res = updateInternetTraffic(baseNodes[1], ctx);
    expect(res.traffic).toBe(1000);
    expect(ctx.updatedNodes[1].data.currentTraffic).toBe(1000);
  });

  it('internet traffic logic - decrement', () => {
    const ctx = getMockCtx();
    const node = createNode('i1', 'Internet', { traffic: 500, currentTraffic: 1000 });
    const res = updateInternetTraffic(node, ctx);
    expect(res.traffic).toBe(500);
    expect(ctx.updatedNodes[1].data.currentTraffic).toBe(500);
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

  it('handleUnboundPvcs can transition to Bound', () => {
    const ctx = getMockCtx();
    const pvc = createNode('pvc1', 'PVC', { pvcStatus: 'Pending' });
    const pod = createNode('pod1', 'Pod', { status: 'ready' });
    ctx.updatedNodes.push(pod);
    ctx.nodeIndexMap?.set('pod1', ctx.updatedNodes.length - 1);

    const res = handleUnboundPvcs([pvc], [pod], ctx);
    expect(res.isBlocked).toBe(true);
    // pod1 should now be pending
    expect(ctx.updatedNodes.find(n => n.id === 'pod1')?.data.status).toBe('pending');
  });

  it('handleBoundPvcs transitions pods to ready', () => {
      const ctx = getMockCtx();
      const pod = createNode('pod1', 'Pod', { status: 'pending', webserver: 'nginx' });
      ctx.updatedNodes.push(pod);
      ctx.nodeIndexMap?.set('pod1', ctx.updatedNodes.length - 1);

      const res = handleBoundPvcs([pod], ctx);
      expect(res.isBlocked).toBe(false);
      expect(ctx.updatedNodes.find(n => n.id === 'pod1')?.data.status).toBe('ready');
  });

  it('incoming traffic calculation', () => {
    const ctx = getMockCtx({
      internetNodes: [createNode('i1', 'Internet', { currentTraffic: 5000 })],
      internetReachableMap: new Map([['i1', new Set(['d1'])]])
    });
    expect(calculateIncomingTraffic(baseNodes[0], ctx).traffic).toBe(5000);
  });

  it('hpa scaling execution - scale up', () => {
    const ctx = getMockCtx();
    ctx.targetEdgeMap!.set('d1', [{ id: 'ehpa', source: 'h1', target: 'd1' } as Edge]);
    expect(handleHpaScaling(baseNodes[0], 100, ctx)).toBe(true);
    expect(ctx.updatedNodes.find(n => n.id === 'd1')?.data.replicas).toBe(2);
  });

  it('hpa scaling execution - update currentCPU', () => {
    const ctx = getMockCtx();
    // No HPA edge
    expect(handleHpaScaling(baseNodes[0], 40, ctx)).toBe(false);

    // With HPA edge
    ctx.targetEdgeMap!.set('d1', [{ id: 'ehpa', source: 'h1', target: 'd1' } as Edge]);
    handleHpaScaling(baseNodes[0], 40, ctx);
    expect(ctx.updatedNodes.find(n => n.id === 'h1')?.data.currentCPU).toBe(40);
  });

  it('updateNodeData handles missing index', () => {
      const ctx = getMockCtx();
      ctx.nodeIndexMap?.clear(); // Force search
      const res = updateNodeData(ctx, 'd1', { label: 'new' });
      expect(res).toBe(true);
      expect(ctx.updatedNodes[0].data.label).toBe('new');
  });

  it('updateNodeData handles non-existent node', () => {
      const ctx = getMockCtx();
      const res = updateNodeData(ctx, 'non-existent', { label: 'new' });
      expect(res).toBe(false);
  });
});
