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
  scheduleRecovery,
  checkConfigMapSimulationStatus,
  processWorkloadSimulation
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

  it('calculateReachability accepts activeSimulationEdges as a Set', () => {
    const ctx = getMockCtx();
    const activeSet = new Set(['e1']);
    expect(calculateReachability([baseNodes[1]], ctx.edgeMap!, activeSet).has('d1')).toBe(true);
  });

  it('calculateReachability ignores edges with validationError', () => {
    const edgeWithError = { id: 'e1', source: 'i1', target: 'd1', data: { validationError: 'error' } } as any;
    const edgeMap = new Map([['i1', [edgeWithError]]]);
    expect(calculateReachability([baseNodes[1]], edgeMap, ['e1']).has('d1')).toBe(false);
  });

  it('internet traffic logic - increment after startup ticks delay', () => {
    const ctx = getMockCtx({ ticks: 4 });
    const res = updateInternetTraffic(baseNodes[1], ctx);
    expect(res.traffic).toBe(1000);
    expect(ctx.updatedNodes[1].data.currentTraffic).toBe(1000);
  });

  it('internet traffic logic - holds at 0 during initial startup ticks', () => {
    const ctx = getMockCtx({ ticks: 2 });
    const res = updateInternetTraffic(baseNodes[1], ctx);
    expect(res.traffic).toBe(0);
  });

  it('internet traffic logic - decrement', () => {
    const ctx = getMockCtx({ ticks: 4 });
    const node = createNode('i1', 'Internet', { traffic: 500, currentTraffic: 1000 });
    // Replace in updatedNodes
    ctx.updatedNodes[1] = { ...node, data: { ...node.data } };
    const res = updateInternetTraffic(node, ctx);
    expect(res.traffic).toBe(500);
    expect(ctx.updatedNodes[1].data.currentTraffic).toBe(500);
  });

  it('internet traffic logic - unchanged when current equals target and hour index matches', () => {
    const ctx = getMockCtx({ ticks: 4 });
    const node = createNode('i1', 'Internet', { traffic: 1000, currentTraffic: 1000, currentHourIndex: 1 });
    ctx.updatedNodes[1] = { ...node, data: { ...node.data } };
    const res = updateInternetTraffic(node, ctx);
    expect(res.traffic).toBe(1000);
    expect(res.hasChanges).toBe(false);
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

  it('incoming traffic calculation handles missing internetNodes or unreachable targets', () => {
    const ctxEmpty = getMockCtx({ internetNodes: undefined, internetReachableMap: undefined });
    expect(calculateIncomingTraffic(baseNodes[0], ctxEmpty).traffic).toBe(0);

    const ctxUnreachable = getMockCtx({
      internetNodes: [createNode('i1', 'Internet', { currentTraffic: 3000 })],
      internetReachableMap: new Map([['i1', new Set(['other-node'])]])
    });
    expect(calculateIncomingTraffic(baseNodes[0], ctxUnreachable).traffic).toBe(0);
  });

  it('incoming traffic calculation and child pod reachability', () => {
    // Standard traffic calculation
    const ctxStandard = getMockCtx({
      internetNodes: [createNode('i1', 'Internet', { currentTraffic: 3000 })],
      internetReachableMap: new Map([['i1', new Set(['d1'])]])
    });
    expect(calculateIncomingTraffic(baseNodes[0], ctxStandard).traffic).toBe(3000);

    // Reaching workload via child pod
    const childPod = createNode('pod1', 'Pod', { parentId: 'd1' });
    const ctxChild = getMockCtx({
      internetNodes: [createNode('i1', 'Internet', { currentTraffic: 2000 })],
      internetReachableMap: new Map([['i1', new Set(['pod1'])]]),
      childPodMap: new Map([['d1', [childPod]]])
    });
    expect(calculateIncomingTraffic(baseNodes[0], ctxChild).traffic).toBe(2000);
  });

  it('hpa scaling execution - scale up with attached hpas array or node config', () => {
    const ctx = getMockCtx();
    ctx.targetEdgeMap!.set('d1', [{ id: 'ehpa', source: 'h1', target: 'd1' } as Edge]);
    expect(handleHpaScaling(baseNodes[0], 100, ctx)).toBe(true);
    expect(ctx.updatedNodes.find(n => n.id === 'd1')?.data.replicas).toBe(2);

    // Attached HPAs array on deployment
    const depWithHpaArray = createNode('d2', 'Deployment', {
      replicas: 1,
      hpas: [{ minReplicas: 1, maxReplicas: 5, targetCPU: 50 }]
    });
    const ctx2 = getMockCtx();
    ctx2.updatedNodes.push(depWithHpaArray);
    ctx2.nodeIndexMap?.set('d2', ctx2.updatedNodes.length - 1);

    expect(handleHpaScaling(depWithHpaArray, 100, ctx2)).toBe(true);

    // Deployment with minReplicas & maxReplicas directly
    const depWithMinMax = createNode('d3', 'Deployment', {
      replicas: 1,
      minReplicas: 1,
      maxReplicas: 5,
      targetCPU: 50
    });
    const ctx3 = getMockCtx();
    ctx3.updatedNodes.push(depWithMinMax);
    ctx3.nodeIndexMap?.set('d3', ctx3.updatedNodes.length - 1);

    expect(handleHpaScaling(depWithMinMax, 100, ctx3)).toBe(true);
  });

  it('hpa scaling execution - scale down blocked by random check or allowed when random >= 0.7', () => {
    (safeRandom as any).mockReturnValue(0.5); // < 0.7 triggers scale down dampening
    const depWith3 = createNode('d-scaled', 'Deployment', {
      replicas: 3,
      hpas: [{ minReplicas: 1, maxReplicas: 5, targetCPU: 50 }]
    });
    const ctx = getMockCtx();
    ctx.updatedNodes.push(depWith3);
    ctx.nodeIndexMap?.set('d-scaled', ctx.updatedNodes.length - 1);

    // cpuPercent = 10% on target 50% -> scale down attempt dampened
    expect(handleHpaScaling(depWith3, 10, ctx)).toBe(false);

    // safeRandom >= 0.7 allows scale down
    (safeRandom as any).mockReturnValue(0.8);
    const depWith3Down = createNode('d-scaled-down', 'Deployment', {
      replicas: 3,
      hpas: [{ minReplicas: 1, maxReplicas: 5, targetCPU: 50 }]
    });
    const ctxDown = getMockCtx();
    ctxDown.updatedNodes.push(depWith3Down);
    ctxDown.nodeIndexMap?.set('d-scaled-down', ctxDown.updatedNodes.length - 1);

    expect(handleHpaScaling(depWith3Down, 10, ctxDown)).toBe(true);
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

  it('handleOomCrashes crashes a pod and handles non-OOM / already crashing pod', () => {
      // Non-OOM returns false
      const ctx0 = getMockCtx();
      expect(handleOomCrashes(baseNodes[0], false, ctx0)).toBe(false);

      (safeRandom as any).mockReturnValue(0.6); // > 0.5 triggers crash check
      const ctx = getMockCtx();
      const pod = createNode('pod1', 'Pod', { status: 'ready' });
      ctx.childPodMap = new Map([['d1', [pod]]]);
      ctx.updatedNodes.push(pod);
      ctx.nodeIndexMap?.set('pod1', ctx.updatedNodes.length - 1);

      const res = handleOomCrashes(baseNodes[0], true, ctx);
      expect(res).toBe(true);
      expect(ctx.updatedNodes.find(n => n.id === 'pod1')?.data.status).toBe('crashing');

      // Pod already crashing returns false
      const podCrashing = createNode('pod1', 'Pod', { status: 'crashing' });
      const ctxCrashing = getMockCtx();
      ctxCrashing.childPodMap = new Map([['d1', [podCrashing]]]);
      expect(handleOomCrashes(baseNodes[0], true, ctxCrashing)).toBe(false);
  });

  it('processWorkloadSimulation runs complete simulation step', () => {
    const ctx = getMockCtx();
    const res = processWorkloadSimulation(baseNodes[0], ctx);
    expect(res).toBeDefined();
    expect(typeof res.hasChanges).toBe('boolean');
  });

  it('scheduleRecovery recovers a crashing pod in-place without deleting it', () => {
      const pod = createNode('pod1', 'Pod', { status: 'crashing', webserver: 'nginx' });
      const updateNodeDataMock = vi.fn();
      const ctx = getMockCtx({
          get: vi.fn().mockReturnValue({ nodes: [baseNodes[0], pod], updateNodeData: updateNodeDataMock })
      });

      scheduleRecovery(baseNodes[0], 'pod1', ctx);

      vi.advanceTimersByTime(3000);
      expect(updateNodeDataMock).toHaveBeenCalledWith('pod1', { status: 'ready', simulatedFailureCM: undefined });
  });

  it('scheduleRecovery returns early if pod status is no longer crashing', () => {
      const pod = createNode('pod1', 'Pod', { status: 'ready', webserver: 'nginx' });
      const updateNodeDataMock = vi.fn();
      const ctx = getMockCtx({
          get: vi.fn().mockReturnValue({ nodes: [baseNodes[0], pod], updateNodeData: updateNodeDataMock })
      });

      scheduleRecovery(baseNodes[0], 'pod1', ctx);

      vi.advanceTimersByTime(3000);
      expect(updateNodeDataMock).not.toHaveBeenCalled();
  });

  it('covers remaining branches in simulation.ts: checkPvcReadiness without connected PVCs, scheduleRecovery with non-crashing pod, and HPA target CPU ratio within 10%', () => {
    // 1. checkPvcReadiness without connected PVCs returns isBlocked: false
    const ctx = getMockCtx();
    const pvcRes = checkPvcReadiness(baseNodes[0], ctx);
    expect(pvcRes.isBlocked).toBe(false);

    // 2. handleBoundPvcs with pending pod lacking ready webserver/runtime
    const unreadyPendingPod = createNode('pod-unready', 'Pod', { status: 'pending', webserver: 'none', runtime: 'none' });
    ctx.updatedNodes.push(unreadyPendingPod);
    ctx.nodeIndexMap?.set('pod-unready', ctx.updatedNodes.length - 1);

    const boundRes = handleBoundPvcs([unreadyPendingPod], ctx);
    expect(boundRes.hasChanges).toBe(false);

    // 3. scheduleRecovery returns early if pod status is no longer 'crashing'
    const nonCrashingPod = createNode('pod-recovered', 'Pod', { status: 'ready' });
    const deleteNodes = vi.fn();
    const ctxRecovery = getMockCtx({
      get: vi.fn().mockReturnValue({ nodes: [baseNodes[0], nonCrashingPod], deleteNodes })
    });
    scheduleRecovery(baseNodes[0], 'pod-recovered', ctxRecovery);
    vi.advanceTimersByTime(3000);
    expect(deleteNodes).not.toHaveBeenCalled();

    // 4. handleHpaScaling with CPU ratio within 10% (cpuPercent = 52 on target 50) does not scale
    const depHpa50 = createNode('dep-hpa-50', 'Deployment', {
      replicas: 2,
      hpas: [{ minReplicas: 1, maxReplicas: 10, targetCPU: 50 }]
    });
    const ctxHpa = getMockCtx();
    ctxHpa.updatedNodes.push(depHpa50);
    ctxHpa.nodeIndexMap?.set('dep-hpa-50', ctxHpa.updatedNodes.length - 1);
    const scaled = handleHpaScaling(depHpa50, 52, ctxHpa); // ratio 52/50 = 1.04, diff <= 0.1
    expect(scaled).toBe(false);
  });

  it('ConfigMap simulation PLAY mode: Port mismatch, capacity throttling, logging, and chaos mode', () => {
    const pod = createNode('pod-cm-test', 'Pod', { status: 'ready', webserver: 'nginx' });
    const srv = createNode('srv1', 'Service', { targetPort: 80 });
    const dep = createNode('dep-cm-test', 'Deployment', {
      configMaps: [
        {
          id: 'cm1',
          name: 'app-cm',
          configData: [
            { key: 'PORT', value: '8080' },
            { key: 'MAX_CONNECTIONS', value: '100' },
            { key: 'LOG_LEVEL', value: 'DEBUG' },
            { key: 'CHAOS_MODE', value: 'disabled' }
          ]
        }
      ]
    });

    const edgeSrvDep = { id: 'e-srv-dep', source: 'srv1', target: 'dep-cm-test', data: {} } as Edge;
    const addLogMock = vi.fn();
    const ctx = getMockCtx({
      get: vi.fn().mockReturnValue({ addLog: addLogMock }),
      targetEdgeMap: new Map([['dep-cm-test', [edgeSrvDep]]]),
      nodeMap: new Map([['srv1', srv], ['dep-cm-test', dep]])
    });
    ctx.updatedNodes.push(pod, dep, srv);
    ctx.nodeIndexMap?.set('pod-cm-test', ctx.updatedNodes.length - 3);
    ctx.nodeIndexMap?.set('dep-cm-test', ctx.updatedNodes.length - 2);

    Object.defineProperty(ctx, 'childPodMap', {
      get: () => new Map([['dep-cm-test', [ctx.updatedNodes.find(n => n.id === 'pod-cm-test')!]]])
    });

    // 1. Port mismatch test (Service 80 vs ConfigMap 8080)
    const cmStatus1 = checkConfigMapSimulationStatus(dep, ctx);
    expect(cmStatus1.isBlocked).toBe(true);
    expect(edgeSrvDep.data?.validationError).toContain('Port Mismatch');

    // Resolve port mismatch
    dep.data.configMaps[0].configData[0].value = '80';
    const cmStatus2 = checkConfigMapSimulationStatus(dep, ctx);
    expect(cmStatus2.isBlocked).toBe(false);
    expect(cmStatus2.effectiveTrafficLimit).toBe(100);

    // Enable Chaos mode
    dep.data.configMaps[0].configData[3].value = 'enabled';
    const cmStatusChaos = checkConfigMapSimulationStatus(dep, ctx);
    expect(cmStatusChaos.isBlocked).toBe(true);
    expect(ctx.updatedNodes.find(n => n.id === 'pod-cm-test')?.data.status).toBe('crashing');
  });
});
