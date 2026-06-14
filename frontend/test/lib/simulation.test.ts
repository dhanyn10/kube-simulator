import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  handleBoundPvcs,
  handleOomCrashes,
  scheduleRecovery
} from '@/lib/simulation';
import { safeRandom } from '@/lib/utils';
import { Node, Edge } from '@xyflow/react';

vi.mock('@/lib/utils', async () => {
    const actual = await vi.importActual('@/lib/utils');
    return {
        ...actual,
        safeRandom: vi.fn(() => 0.5)
    };
});

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
    const ctx = {
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
        ...overrides
    } as SimulationContext;

    if (!ctx.nodeIndexMap) {
        ctx.nodeIndexMap = new Map(ctx.updatedNodes.map((n, i) => [n.id, i]));
    }

    return ctx;
};

describe('simulation test suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (safeRandom as any).mockReturnValue(0.5);
    vi.useFakeTimers();
  });

  it('safeRandom returns value from mock', () => {
    (safeRandom as any).mockReturnValue(0.8);
    const v = safeRandom();
    expect(v).toBe(0.8);
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
    // Replace in updatedNodes
    ctx.updatedNodes[1] = { ...node, data: { ...node.data } };
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
    (safeRandom as any).mockReturnValue(0.8); // > 0.7 triggers Bound
    const ctx = getMockCtx();
    const pvc = ctx.updatedNodes[2]; // 'pvc1'
    const pod = createNode('pod1', 'Pod', { status: 'ready' });
    ctx.updatedNodes.push(pod);
    ctx.nodeIndexMap?.set('pod1', ctx.updatedNodes.length - 1);

    const res = handleUnboundPvcs([pvc], [pod], ctx);
    expect(res.isBlocked).toBe(true);
    expect(ctx.updatedNodes[2].data.pvcStatus).toBe('Bound');
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

  it('handleOomCrashes crashes a pod', () => {
      (safeRandom as any).mockReturnValue(0.6); // > 0.5 triggers crash check
      const ctx = getMockCtx();
      const pod = createNode('pod1', 'Pod', { status: 'ready' });
      ctx.childPodMap = new Map([['d1', [pod]]]);
      ctx.updatedNodes.push(pod);
      ctx.nodeIndexMap?.set('pod1', ctx.updatedNodes.length - 1);

      const res = handleOomCrashes(baseNodes[0], true, ctx);
      expect(res).toBe(true);
      expect(ctx.updatedNodes.find(n => n.id === 'pod1')?.data.status).toBe('crashing');
  });

  it('scheduleRecovery recovers a crashing pod', () => {
      const pod = createNode('pod1', 'Pod', { status: 'crashing' });
      const deleteNodes = vi.fn();
      const ctx = getMockCtx({
          get: vi.fn().mockReturnValue({ nodes: [baseNodes[0], pod], deleteNodes })
      });

      scheduleRecovery(baseNodes[0], 'pod1', ctx);

      // Advance time for first timeout (3000ms)
      vi.advanceTimersByTime(3000);
      expect(deleteNodes).toHaveBeenCalled();

      // Advance time for second timeout (2000ms)
      vi.advanceTimersByTime(2000);
  });
});
