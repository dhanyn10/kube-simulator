import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateReachability,
  updateInternetTraffic,
  getInterpolatedProfileTraffic,
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
  processWorkloadSimulation,
  parseConfigMapSettings,
  logLogLevelStream,
  handleChaosModeSimulation,
  checkPortMismatch,
  isInternetConnectionRed
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
    createNode('d1', 'Deployment', { replicas: 1, status: 'ready', cpuLimit: '1000m', memoryLimit: '1024Mi' }),
    createNode('pod-d1', 'Pod', { parentId: 'd1', status: 'ready' }),
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
        activeSimulationEdges: ['e1'],
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
    const internetNode = ctx.nodes.find(n => n.type === 'Internet')!;
    expect(calculateReachability([internetNode], ctx.edgeMap!, active).has('d1')).toBe(expected);
  });

  it('calculateReachability accepts activeSimulationEdges as a Set', () => {
    const ctx = getMockCtx();
    const activeSet = new Set(['e1']);
    const internetNode = ctx.nodes.find(n => n.type === 'Internet')!;
    expect(calculateReachability([internetNode], ctx.edgeMap!, activeSet).has('d1')).toBe(true);
  });

  it('calculateReachability ignores edges with validationError and skips duplicate queue entries', () => {
    const edgeWithError = { id: 'e1', source: 'i1', target: 'd1', data: { validationError: 'error' } } as any;
    const edgeMap = new Map([['i1', [edgeWithError]]]);
    const internetNode = baseNodes.find(n => n.type === 'Internet')!;
    expect(calculateReachability([internetNode], edgeMap, ['e1']).has('d1')).toBe(false);

    // Test duplicate queue skipping when multiple edges target same node
    const edge1 = { id: 'e1', source: 'n1', target: 'n2' } as Edge;
    const edge2 = { id: 'e2', source: 'n1', target: 'n2' } as Edge;
    const multiEdgeMap = new Map([['n1', [edge1, edge2]]]);
    const n1 = createNode('n1', 'Service');

    const reachSet = calculateReachability([n1], multiEdgeMap, ['e1', 'e2']);
    expect(reachSet.has('n2')).toBe(true);
  });

  it('isInternetConnectionRed evaluates downstream paths, unready Deployment child pods, and validation errors', () => {
    const internet = createNode('i1', 'Internet');
    const depNode = createNode('dep1', 'Deployment', { status: 'ready' });
    const childPodUnready = createNode('pod1', 'Pod', { parentId: 'dep1', status: 'pending', type: 'Pod' });

    const edgeIntDep = { id: 'e-int-dep', source: 'i1', target: 'dep1' } as Edge;
    const ctxUnreadyChild = getMockCtx({
      nodes: [internet, depNode, childPodUnready],
      activeSimulationEdges: ['e-int-dep'],
      edgeMap: new Map([['i1', [edgeIntDep]]]),
      nodeMap: new Map([['i1', internet], ['dep1', depNode], ['pod1', childPodUnready]])
    });

    // Deployment with unready child pod makes internet connection red
    expect(isInternetConnectionRed(internet, ctxUnreadyChild)).toBe(true);

    // Multi-hop downstream path with validation error on downstream edge
    const srvNode = createNode('srv1', 'Service');
    const edgeDepSrv = { id: 'e-dep-srv', source: 'dep1', target: 'srv1', data: { validationError: 'error' } } as Edge;
    const childPodReady = createNode('pod1', 'Pod', { parentId: 'dep1', status: 'ready', type: 'Pod' });

    const ctxDownstreamErr = getMockCtx({
      nodes: [internet, depNode, childPodReady, srvNode],
      activeSimulationEdges: ['e-int-dep', 'e-dep-srv'],
      edgeMap: new Map([['i1', [edgeIntDep]], ['dep1', [edgeDepSrv]]]),
      nodeMap: new Map([['i1', internet], ['dep1', depNode], ['pod1', childPodReady], ['srv1', srvNode]])
    });

    expect(isInternetConnectionRed(internet, ctxDownstreamErr)).toBe(true);

    // ReplicaSet workload check
    const rsNode = createNode('rs1', 'ReplicaSet', { status: 'crashing' });
    const edgeIntRs = { id: 'e-int-rs', source: 'i1', target: 'rs1' } as Edge;
    const ctxRs = getMockCtx({
      nodes: [internet, rsNode],
      activeSimulationEdges: ['e-int-rs'],
      edgeMap: new Map([['i1', [edgeIntRs]]]),
      nodeMap: new Map([['i1', internet], ['rs1', rsNode]])
    });

    expect(isInternetConnectionRed(internet, ctxRs)).toBe(true);
  });

  it('internet traffic logic - increment after startup ticks delay', () => {
    const ctx = getMockCtx({ ticks: 4, activeSimulationEdges: ['e1'] });
    const internetNode = ctx.nodes.find(n => n.id === 'i1')!;
    const res = updateInternetTraffic(internetNode, ctx);
    expect(res.traffic).toBe(1000);
  });

  it('internet traffic logic - holds at 0 during initial startup ticks', () => {
    const ctx = getMockCtx({ ticks: 2, activeSimulationEdges: ['e1'] });
    const internetNode = ctx.nodes.find(n => n.id === 'i1')!;
    const res = updateInternetTraffic(internetNode, ctx);
    expect(res.traffic).toBe(0);
  });

  it('internet traffic logic - decrement', () => {
    const ctx = getMockCtx({ ticks: 4, activeSimulationEdges: ['e1'] });
    const internetNode = createNode('i1', 'Internet', { traffic: 500, currentTraffic: 1000 });
    ctx.updatedNodes = ctx.updatedNodes.map(n => n.id === 'i1' ? internetNode : n);
    const res = updateInternetTraffic(internetNode, ctx);
    expect(res.traffic).toBe(500);
  });

  it('internet traffic logic - freezes traffic when connection is red/unhealthy', () => {
    const ctx = getMockCtx({ ticks: 4 });
    const redNode = createNode('i1', 'Internet', { traffic: 1000, currentTraffic: 1000, currentHourIndex: 0, profileTicks: 0 });
    // Edge targeting missing/unready node creates red connection
    const badEdge = { id: 'e1', source: 'i1', target: 'non-existent' } as Edge;
    ctx.edgeMap = new Map([['i1', [badEdge]]]);

    const res = updateInternetTraffic(redNode, ctx);
    expect(res.traffic).toBe(0);
  });

  it('calculates linear interpolated profile traffic per minute including sub-hourly 10-minute intervals', () => {
    const profile = {
      hourly: {
        '00:00': 100,
        '00:10': 500,
        '00:20': 200,
        '01:00': 1000,
        '23:00': 500
      }
    };

    expect(getInterpolatedProfileTraffic(null, 0)).toBe(1000);
    expect(getInterpolatedProfileTraffic(profile, 0)).toBe(100);
    expect(getInterpolatedProfileTraffic(profile, 5)).toBe(300); // interpolated between 00:00 (100) and 00:10 (500)
    expect(getInterpolatedProfileTraffic(profile, 10)).toBe(500); // exact 10m sub-hourly point
    expect(getInterpolatedProfileTraffic(profile, 15)).toBe(350); // interpolated between 00:10 (500) and 00:20 (200)
    expect(getInterpolatedProfileTraffic(profile, 20)).toBe(200); // exact 20m sub-hourly point
    expect(getInterpolatedProfileTraffic(profile, 60)).toBe(1000);
  });

  it('updates internet node traffic with minute-level profile resolution', () => {
    const profileNode = createNode('i1', 'Internet', {
      currentMinuteIndex: 0,
      currentHourIndex: 0,
      profileTicks: 0,
      connectionProfile: {
        hourly: {
          '00:00': 100,
          '01:00': 200
        }
      }
    });

    const ctx = getMockCtx({ ticks: 4, activeSimulationEdges: ['e1'] });
    ctx.updatedNodes = [profileNode];
    ctx.nodeIndexMap = new Map([['i1', 0]]);

    const res = updateInternetTraffic(profileNode, ctx);
    expect(res.traffic).toBe(102); // 00:01 traffic interpolated
    expect(ctx.updatedNodes[0].data.currentMinuteIndex).toBe(1);
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
      const pod = createNode('pod1', 'Pod', { status: 'pending', image: 'nginx:latest' });
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

  it('handleOomCrashes crashes a pod and handles non-OOM / already crashing pod / empty childPods', () => {
      // Non-OOM returns false
      const ctx0 = getMockCtx();
      expect(handleOomCrashes(baseNodes[0], false, ctx0)).toBe(false);

      // Empty childPods returns false
      const ctxEmptyPods = getMockCtx();
      ctxEmptyPods.childPodMap = new Map([['d1', []]]);
      expect(handleOomCrashes(baseNodes[0], true, ctxEmptyPods)).toBe(false);

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

  it('scheduleRecovery recovers a crashing pod in-place without deleting it and catches addLog exceptions', () => {
      const pod = createNode('pod1', 'Pod', { status: 'crashing', image: 'nginx:latest' });
      const updateNodeDataMock = vi.fn();
      const ctx = getMockCtx({
          get: vi.fn().mockReturnValue({ nodes: [baseNodes[0], pod], updateNodeData: updateNodeDataMock })
      });

      scheduleRecovery(baseNodes[0], 'pod1', ctx);

      vi.advanceTimersByTime(3000);
      expect(updateNodeDataMock).toHaveBeenCalledWith('pod1', { status: 'ready', simulatedFailureCM: undefined });

      // Test catch blocks when addLog throws in scheduleRecovery
      const podNever = createNode('pod-never-err', 'Pod', { status: 'crashing', restartPolicy: 'Never' });
      const ctxErr = getMockCtx({
        get: vi.fn().mockReturnValue({
          nodes: [baseNodes[0], podNever],
          addLog: vi.fn().mockImplementation(() => { throw new Error('addLog error'); })
        })
      });

      expect(() => scheduleRecovery(baseNodes[0], 'pod-never-err', ctxErr)).not.toThrow();

      const podAlwaysErr = createNode('pod-always-err', 'Pod', { status: 'crashing', restartPolicy: 'Always', image: 'nginx:latest' });
      const ctxErr2 = getMockCtx({
        get: vi.fn().mockReturnValue({
          nodes: [baseNodes[0], podAlwaysErr],
          updateNodeData: vi.fn(),
          addLog: vi.fn().mockImplementation(() => { throw new Error('addLog error'); })
        })
      });

      expect(() => scheduleRecovery(baseNodes[0], 'pod-always-err', ctxErr2)).not.toThrow();
      vi.advanceTimersByTime(3000);
  });

  it('scheduleRecovery with restartPolicy Never skips automatic recovery', () => {
    const pod = createNode('pod-never', 'Pod', { status: 'crashing', restartPolicy: 'Never', label: 'NeverPod' });
    const updateNodeDataMock = vi.fn();
    const addLogMock = vi.fn();
    const ctx = getMockCtx({
      get: vi.fn().mockReturnValue({ nodes: [baseNodes[0], pod], updateNodeData: updateNodeDataMock, addLog: addLogMock })
    });

    scheduleRecovery(baseNodes[0], 'pod-never', ctx);

    vi.advanceTimersByTime(3000);
    expect(updateNodeDataMock).not.toHaveBeenCalled();
    expect(addLogMock).toHaveBeenCalledWith('error', expect.stringContaining('restartPolicy: Never'), 'Simulation');
  });

  it('scheduleRecovery with restartPolicy Always or OnFailure logs warning and recovers pod', () => {
    const pod = createNode('pod-always', 'Pod', { status: 'crashing', restartPolicy: 'OnFailure', label: 'OnFailPod', image: 'nginx:latest' });
    const updateNodeDataMock = vi.fn();
    const addLogMock = vi.fn();
    const ctx = getMockCtx({
      get: vi.fn().mockReturnValue({ nodes: [baseNodes[0], pod], updateNodeData: updateNodeDataMock, addLog: addLogMock })
    });

    scheduleRecovery(baseNodes[0], 'pod-always', ctx);

    expect(addLogMock).toHaveBeenCalledWith('warning', expect.stringContaining('restartPolicy: OnFailure'), 'Simulation');
    vi.advanceTimersByTime(3000);
    expect(updateNodeDataMock).toHaveBeenCalledWith('pod-always', { status: 'ready', simulatedFailureCM: undefined });
    expect(addLogMock).toHaveBeenCalledWith('info', expect.stringContaining('restarted successfully'), 'Simulation');
  });

  it('scheduleRecovery returns early if pod status is no longer crashing', () => {
      const pod = createNode('pod1', 'Pod', { status: 'ready', image: 'nginx:latest' });
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

  it('parseConfigMapSettings handles undefined/empty keys, invalid ports, and MAX_CONNECTIONS', () => {
    const configMaps = [
      {
        id: 'cm1',
        name: 'app-cm',
        configData: [
          { key: undefined, value: 'val' },
          { key: 'PORT', value: 'invalid-port' },
          { key: 'MAX_CONNECTIONS', value: 'invalid-max' },
          { key: 'SIMULATE_FAILURE', value: 'true' },
          { key: 'LOG_LEVEL', value: 'warn' }
        ]
      }
    ];

    const parsed = parseConfigMapSettings(configMaps as any);
    expect(parsed.hasSimulatedFailure).toBe(true);
    expect(parsed.cmPort).toBeNull();
    expect(parsed.maxConnections).toBeNull();
    expect(parsed.logLevel).toBe('WARN');
  });

  it('logLogLevelStream logs WARN, ERROR, and INFO levels based on ticks', () => {
    const addLogMock = vi.fn();
    const ctx = getMockCtx({
      ticks: 3,
      get: vi.fn().mockReturnValue({ addLog: addLogMock })
    });
    const dep = createNode('dep1', 'Deployment', { label: 'my-dep' });

    (safeRandom as any).mockReturnValue(0.9); // > 0.4 triggers log

    logLogLevelStream(dep, ctx, 'WARN');
    expect(addLogMock).toHaveBeenCalledWith('warning', expect.stringContaining('Connection pool threshold'), 'App');

    logLogLevelStream(dep, ctx, 'ERROR');
    expect(addLogMock).toHaveBeenCalledWith('error', expect.stringContaining('Unhandled internal exception'), 'App');

    logLogLevelStream(dep, ctx, 'INFO');
    expect(addLogMock).toHaveBeenCalledWith('info', expect.stringContaining('HTTP 200 OK'), 'App');

    // Covers addLog exception catch blocks in applyPodSimulatedFailure and recoverSinglePod
    const ctxErr = getMockCtx({
      ticks: 3,
      get: vi.fn().mockImplementation(() => { throw new Error('addLog error'); })
    });

    const failingCmName = 'failing-cm';
    const podToCrash = createNode('pod1', 'Pod', { status: 'ready', simulatedFailureCM: undefined });
    ctxErr.updatedNodes = [podToCrash];
    ctxErr.nodeIndexMap = new Map([['pod1', 0]]);

    handleChaosModeSimulation([podToCrash], ctxErr, true, failingCmName);

    const podToRecover = createNode('pod1', 'Pod', { status: 'crashing', simulatedFailureCM: failingCmName, image: 'nginx:latest' });
    ctxErr.updatedNodes = [podToRecover];
    ctxErr.nodeIndexMap = new Map([['pod1', 0]]);

    handleChaosModeSimulation([podToRecover], ctxErr, false, failingCmName);

    // Covers catch block in logLogLevelStream
    logLogLevelStream(dep, ctxErr, 'INFO');
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
      ticks: 2,
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

    // Clear initial port mismatch error log call
    addLogMock.mockClear();

    // Setup internet incoming traffic so traffic (1000) > maxConnections limit (100)
    const internetNode = createNode('i1', 'Internet', { currentTraffic: 1000 });
    ctx.internetNodes = [internetNode];
    ctx.internetReachableMap = new Map([['i1', new Set(['dep-cm-test'])]]);

    // Test traffic throttling with limit
    processWorkloadSimulation(dep, ctx);
    expect(addLogMock).toHaveBeenCalledWith('warning', expect.stringContaining('MAX_CONNECTIONS=100'), 'Simulation');

    // Enable Chaos mode
    dep.data.configMaps[0].configData[3].value = 'enabled';
    const cmStatusChaos = checkConfigMapSimulationStatus(dep, ctx);
    expect(cmStatusChaos.isBlocked).toBe(true);
    expect(ctx.updatedNodes.find(n => n.id === 'pod-cm-test')?.data.status).toBe('crashing');
  });

  it('covers error handling in logPortMismatchError and handleTrafficThrottling', () => {
    const srv = createNode('srv1', 'Service', { targetPort: 80 });
    const dep = createNode('dep-cm-test', 'Deployment', {});
    const edgeSrvDep = { id: 'e-srv-dep', source: 'srv1', target: 'dep-cm-test', data: {} } as Edge;

    const ctxErr = getMockCtx({
      ticks: 2,
      get: vi.fn().mockImplementation(() => { throw new Error('addLog error'); }),
      targetEdgeMap: new Map([['dep-cm-test', [edgeSrvDep]]]),
      nodeMap: new Map([['srv1', srv], ['dep-cm-test', dep]])
    });

    // Triggers logPortMismatchError with exception
    checkPortMismatch(dep, ctxErr, 8080);

    // Triggers handleTrafficThrottling with exception
    dep.data = {
      configMaps: [
        {
          id: 'cm1',
          name: 'app-cm',
          configData: [{ key: 'MAX_CONNECTIONS', value: '10' }]
        }
      ]
    };
    processWorkloadSimulation(dep, ctxErr);
  });

  describe('PVC Multi-Attach simulation tests', () => {
    it('detects RWO multi-attach conflict when connected replicas > 1', () => {
      const pvc = createNode('pvc-rwo', 'PVC', { accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' });
      const dep = createNode('d-multi', 'Deployment', { replicas: 3, status: 'ready' });
      const pod1 = createNode('pod-m1', 'Pod', { parentId: 'd-multi', status: 'ready' });
      const edge = { id: 'e-pvc', source: 'd-multi', target: 'pvc-rwo', data: {} } as Edge;

      const addLogMock = vi.fn();
      const ctx = getMockCtx({
        nodes: [dep, pod1, pvc],
        edges: [edge],
        get: vi.fn().mockReturnValue({ addLog: addLogMock }),
        edgeMap: new Map([['d-multi', [edge]]]),
        targetEdgeMap: new Map([['pvc-rwo', [edge]]]),
        nodeMap: new Map([['d-multi', dep], ['pod-m1', pod1], ['pvc-rwo', pvc]]),
        childPodMap: new Map([['d-multi', [pod1]]])
      });
      ctx.updatedNodes = [dep, pod1, pvc];
      ctx.nodeIndexMap = new Map([['d-multi', 0], ['pod-m1', 1], ['pvc-rwo', 2]]);

      const res = checkPvcReadiness(dep, ctx);

      expect(res.isBlocked).toBe(true);
      expect(ctx.updatedNodes[2].data.pvcStatus).toBe('Multi-Attach Error');
      expect(edge.data?.validationError).toContain('Multi-Attach Error');
      expect(ctx.updatedNodes[1].data.status).toBe('pending');
      expect(addLogMock).toHaveBeenCalledWith('error', expect.stringContaining('Multi-Attach Error'), 'Simulation');
    });

    it('resolves RWO multi-attach conflict when replicas scale down to 1', () => {
      const pvc = createNode('pvc-rwo', 'PVC', { accessMode: 'ReadWriteOnce', pvcStatus: 'Multi-Attach Error' });
      const dep = createNode('d-multi', 'Deployment', { replicas: 1, status: 'pending' });
      const pod1 = createNode('pod-m1', 'Pod', { parentId: 'd-multi', status: 'pending', image: 'nginx:latest' });
      const edge = { id: 'e-pvc', source: 'd-multi', target: 'pvc-rwo', data: { validationError: 'Multi-Attach Error' } } as Edge;

      const addLogMock = vi.fn();
      const ctx = getMockCtx({
        nodes: [dep, pod1, pvc],
        edges: [edge],
        get: vi.fn().mockReturnValue({ addLog: addLogMock }),
        edgeMap: new Map([['d-multi', [edge]]]),
        targetEdgeMap: new Map([['pvc-rwo', [edge]]]),
        nodeMap: new Map([['d-multi', dep], ['pod-m1', pod1], ['pvc-rwo', pvc]]),
        childPodMap: new Map([['d-multi', [pod1]]])
      });
      ctx.updatedNodes = [dep, pod1, pvc];
      ctx.nodeIndexMap = new Map([['d-multi', 0], ['pod-m1', 1], ['pvc-rwo', 2]]);

      const res = checkPvcReadiness(dep, ctx);

      expect(res.isBlocked).toBe(false);
      expect(ctx.updatedNodes[2].data.pvcStatus).toBe('Bound');
      expect(edge.data?.validationError).toBeUndefined();
      expect(ctx.updatedNodes[1].data.status).toBe('ready');
      expect(addLogMock).toHaveBeenCalledWith('info', expect.stringContaining('Multi-Attach conflict resolved'), 'Simulation');
    });

    it('allows ReadWriteMany (RWX) and ReadOnlyMany (ROX) with multiple replicas', () => {
      const pvcRwx = createNode('pvc-rwx', 'PVC', { accessMode: 'ReadWriteMany', pvcStatus: 'Bound' });
      const dep = createNode('d-multi', 'Deployment', { replicas: 5, status: 'ready' });
      const pod1 = createNode('pod-m1', 'Pod', { parentId: 'd-multi', status: 'pending', image: 'nginx:latest' });
      const edge = { id: 'e-pvc', source: 'd-multi', target: 'pvc-rwx', data: {} } as Edge;

      const ctx = getMockCtx({
        nodes: [dep, pod1, pvcRwx],
        edges: [edge],
        edgeMap: new Map([['d-multi', [edge]]]),
        targetEdgeMap: new Map([['pvc-rwx', [edge]]]),
        nodeMap: new Map([['d-multi', dep], ['pod-m1', pod1], ['pvc-rwx', pvcRwx]]),
        childPodMap: new Map([['d-multi', [pod1]]])
      });
      ctx.updatedNodes = [dep, pod1, pvcRwx];
      ctx.nodeIndexMap = new Map([['d-multi', 0], ['pod-m1', 1], ['pvc-rwx', 2]]);

      const res = checkPvcReadiness(dep, ctx);

      expect(res.isBlocked).toBe(false);
      expect(ctx.updatedNodes[2].data.pvcStatus).toBe('Bound');
      expect(ctx.updatedNodes[1].data.status).toBe('ready');
    });

    it('handles PVC lookup fallback, pod parentId connection, logger catch blocks, and unbound PVC binding', () => {
      // 1. PVC lookup fallback via ctx.nodes.find when nodeMap does not contain target PVC
      const pvcNode = createNode('pvc-find', 'PVC', { accessMode: 'ReadWriteOnce', pvcStatus: 'Bound' });
      const depNode = createNode('d-find', 'Deployment', { replicas: 2, status: 'ready' });
      const edge = { id: 'e-find', source: 'pvc-find', target: 'd-find', data: {} } as Edge;

      const ctxFind = getMockCtx({
        nodes: [depNode, pvcNode],
        edges: [edge],
        edgeMap: new Map([['d-find', [edge]]]),
        targetEdgeMap: new Map([['pvc-find', [edge]]]),
        nodeMap: new Map([['d-find', depNode]]) // pvc-find missing from nodeMap
      });
      ctxFind.updatedNodes = [depNode, pvcNode];
      ctxFind.nodeIndexMap = new Map([['d-find', 0], ['pvc-find', 1]]);

      expect(checkPvcReadiness(depNode, ctxFind).isBlocked).toBe(true);

      // 2. Pod parentId matching in calculateWorkloadReplicaCount
      const childPodStandalone = createNode('pod-standalone', 'Pod', { parentId: 'd-find', status: 'ready' });
      const edgePodPvc = { id: 'e-pod-pvc', source: 'pod-standalone', target: 'pvc-find', data: {} } as Edge;

      const ctxPodPvc = getMockCtx({
        nodes: [depNode, childPodStandalone, pvcNode],
        edges: [edgePodPvc],
        edgeMap: new Map([['pod-standalone', [edgePodPvc]]]),
        targetEdgeMap: new Map([['pvc-find', [edgePodPvc]]]),
        nodeMap: new Map([['d-find', depNode], ['pod-standalone', childPodStandalone], ['pvc-find', pvcNode]])
      });
      ctxPodPvc.updatedNodes = [depNode, childPodStandalone, pvcNode];
      ctxPodPvc.nodeIndexMap = new Map([['d-find', 0], ['pod-standalone', 1], ['pvc-find', 2]]);

      // Standalone pod connected to PVC, but parent d-find is NOT connected to PVC -> Pod returns replica count 1
      expect(checkPvcReadiness(childPodStandalone, ctxPodPvc).isBlocked).toBe(false);

      // 3. Catch block in handlePvcMultiAttachError and resolvePvcMultiAttachError when get() throws
      const ctxErr = getMockCtx({
        nodes: [depNode, pvcNode],
        edges: [edge],
        get: vi.fn().mockImplementation(() => { throw new Error('addLog error'); }),
        edgeMap: new Map([['d-find', [edge]]]),
        targetEdgeMap: new Map([['pvc-find', [edge]]]),
        nodeMap: new Map([['d-find', depNode], ['pvc-find', pvcNode]])
      });
      ctxErr.updatedNodes = [depNode, pvcNode];
      ctxErr.nodeIndexMap = new Map([['d-find', 0], ['pvc-find', 1]]);

      checkPvcReadiness(depNode, ctxErr);

      pvcNode.data.pvcStatus = 'Multi-Attach Error';
      depNode.data.replicas = 1;
      checkPvcReadiness(depNode, ctxErr);

      // 4. handleUnboundPvcs with safeRandom <= 0.7 does not bind PVC
      (safeRandom as any).mockReturnValue(0.5);
      const unboundPvc = createNode('pvc-unbound', 'PVC', { pvcStatus: 'Pending' });
      const podPending = createNode('pod-p1', 'Pod', { status: 'ready' });
      const ctxUnbound = getMockCtx();
      ctxUnbound.updatedNodes = [unboundPvc, podPending];
      ctxUnbound.nodeIndexMap = new Map([['pvc-unbound', 0], ['pod-p1', 1]]);

      const unboundRes = handleUnboundPvcs([unboundPvc], [podPending], ctxUnbound);
      expect(unboundRes.isBlocked).toBe(true);
      expect(unboundPvc.data.pvcStatus).toBe('Pending');
    });
  });
});
