import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateReachability,
  isServiceSelectorMatching,
  hasValidServiceSelectorTarget,
  hasValidIngressBackend,
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
  isInternetConnectionRed,
  parseSecretSimulationSettings,
  checkSecretSimulationStatus
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

    // Unpadded hour/minute key '0:0' triggers prev.minute === next.minute on line 104
    const unpaddedProfile = { hourly: { '0:0': 500 } };
    expect(getInterpolatedProfileTraffic(unpaddedProfile, 0)).toBe(500);
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
      configMaps: [{ id: 'cm1', name: 'app-cm', configData: [{ key: 'PORT', value: '8080' }, { key: 'MAX_CONNECTIONS', value: '100' }, { key: 'LOG_LEVEL', value: 'DEBUG' }, { key: 'CHAOS_MODE', value: 'disabled' }] }]
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
    const mismatchRes = checkPortMismatch(dep, ctxErr, 8080);
    expect(mismatchRes.isBlocked).toBe(true);

    // Triggers handleTrafficThrottling with exception
    dep.data = {
      configMaps: [{ id: 'cm1', name: 'app-cm', configData: [{ key: 'MAX_CONNECTIONS', value: '10' }] }]
    };
    const processRes = processWorkloadSimulation(dep, ctxErr);
    expect(processRes).toBeDefined();
    expect(typeof processRes.hasChanges).toBe('boolean');
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

  describe('reachability helper edge cases', () => {
    it('isServiceSelectorMatching tests all matching logic and edge cases', () => {
      const svcNoSelector = createNode('s1', 'Service', {});
      const pod = createNode('p1', 'Pod', { label: 'web', baseName: 'web-base', labels: { app: 'web-app' } });

      expect(isServiceSelectorMatching(svcNoSelector, pod)).toBe(false);

      const svcEmpty = createNode('s2', 'Service', { selector: '   ' });
      expect(isServiceSelectorMatching(svcEmpty, pod)).toBe(false);

      const svcNumber = createNode('s3', 'Service', { selector: 123 as any });
      expect(isServiceSelectorMatching(svcNumber, pod)).toBe(false);

      // Matches baseName when label is missing
      const podBase = createNode('p2', 'Pod', { baseName: 'my-app' });
      const svcBase = createNode('s4', 'Service', { selector: 'my-app' });
      expect(isServiceSelectorMatching(svcBase, podBase)).toBe(true);

      // Matches labels.app
      const podApp = createNode('p3', 'Pod', { label: 'other-name', labels: { app: 'target-app' } });
      const svcApp = createNode('s5', 'Service', { selector: 'target-app' });
      expect(isServiceSelectorMatching(svcApp, podApp)).toBe(true);
    });

    it('hasValidServiceSelectorTarget checks invalid selector or empty nodes', () => {
      const svc = createNode('s1', 'Service', { selector: '' });
      expect(hasValidServiceSelectorTarget(svc, [createNode('p1', 'Pod', { label: 'web' })])).toBe(false);

      const svcValid = createNode('s2', 'Service', { selector: 'web' });
      expect(hasValidServiceSelectorTarget(svcValid, [])).toBe(false);
      expect(hasValidServiceSelectorTarget(svcValid, [createNode('p1', 'Pod', { label: 'web' })])).toBe(true);
    });

    it('hasValidIngressBackend covers outgoing edge to non-ClusterIP, serviceName fallback, selector matching', () => {
      // Outgoing edge to a ClusterIP service (line 39)
      const ingCluster = createNode('i-cluster', 'Ingress', {});
      const clusterIpSvc = createNode('s-cluster', 'Service', { serviceType: 'ClusterIP' });
      const edgeToCluster = { id: 'e-cluster', source: 'i-cluster', target: 's-cluster' } as Edge;
      const edgeMapCluster = new Map([['i-cluster', [edgeToCluster]]]);
      expect(hasValidIngressBackend(ingCluster, [clusterIpSvc], edgeMapCluster)).toBe(true);

      const ing = createNode('i1', 'Ingress', { serviceName: 'backend-svc' });

      // Outgoing edge to a NodePort service (not ClusterIP) -> falls through to name check
      const npService = createNode('s1', 'Service', { label: 'backend-svc', serviceType: 'NodePort' });
      const edgeToNp = { id: 'e1', source: 'i1', target: 's1' } as Edge;
      const edgeMapNp = new Map([['i1', [edgeToNp]]]);

      // Returns false because backend-svc is NodePort, not ClusterIP
      expect(hasValidIngressBackend(ing, [npService], edgeMapNp)).toBe(false);

      // Match via n.data.selector === backendName
      const clusterIpWithSelector = createNode('s2', 'Service', { selector: 'backend-svc', serviceType: 'ClusterIP' });
      expect(hasValidIngressBackend(ing, [clusterIpWithSelector])).toBe(true);

      // Ingress without backendServiceName or serviceName -> false
      const ingEmpty = createNode('i2', 'Ingress', {});
      expect(hasValidIngressBackend(ingEmpty, [clusterIpWithSelector])).toBe(false);
    });

    it('calculateReachability dynamic enqueuing and processing rules', () => {
      // Service with NodePort is valid for processing
      const npSvc = createNode('s1', 'Service', { serviceType: 'NodePort' });
      const edge = { id: 'e1', source: 's1', target: 'p1' } as Edge;
      const pod = createNode('p1', 'Pod', { label: 'app' });
      const edgeMap = new Map([['s1', [edge]]]);

      const reach1 = calculateReachability([npSvc], edgeMap, ['e1'], [npSvc, pod]);
      expect(reach1.has('p1')).toBe(true);

      // Service connected to Ingress target is valid for processing
      const cipSvc = createNode('s2', 'Service', { serviceType: 'ClusterIP' });
      const ingNode = createNode('i1', 'Ingress', { backendServiceName: 's2-label' });
      const edgeS2Ing = { id: 'e2', source: 's2', target: 'i1' } as Edge;
      const edgeMap2 = new Map([['s2', [edgeS2Ing]]]);

      const reach2 = calculateReachability([cipSvc], edgeMap2, ['e2'], [cipSvc, ingNode]);
      expect(reach2.has('i1')).toBe(true);

      // Ingress dynamic target enqueuing
      const ingDynamic = createNode('i2', 'Ingress', { backendServiceName: 'dynamic-svc' });
      const targetSvc = createNode('s3', 'Service', { label: 'dynamic-svc', serviceType: 'ClusterIP' });
      const reach3 = calculateReachability([ingDynamic], new Map(), [], [ingDynamic, targetSvc]);
      expect(reach3.has('s3')).toBe(true);

      // Service dynamic target enqueuing via selector matching (line 84)
      const dynamicSvc = createNode('s-dynamic', 'Service', { serviceType: 'LoadBalancer', selector: 'dynamic-app' });
      const dynamicPod = createNode('p-dynamic', 'Pod', { label: 'dynamic-app' });
      const reachDynamic = calculateReachability([dynamicSvc], new Map(), [], [dynamicSvc, dynamicPod]);
      expect(reachDynamic.has('p-dynamic')).toBe(true);

      // Ingress invalid backend fails processOutgoingEdges
      const ingInvalid = createNode('i3', 'Ingress', { backendServiceName: 'non-existent' });
      const edgeInvalid = { id: 'e3', source: 'i3', target: 'p1' } as Edge;
      const reach4 = calculateReachability([ingInvalid], new Map([['i3', [edgeInvalid]]]), ['e3'], [ingInvalid, pod]);
      expect(reach4.has('p1')).toBe(false);

      // Processing when currNode is not in allNodes
      const reach5 = calculateReachability([createNode('unknown', 'Pod')], new Map([['unknown', [{ id: 'e4', source: 'unknown', target: 'p1' } as Edge]]]), ['e4'], [pod]);
      expect(reach5.has('p1')).toBe(true);
    });

    it('isInternetConnectionRed handles empty outgoing edges, direct validation error, and unready Ingress/Service', () => {
      const internet = createNode('i1', 'Internet');

      // 1. No outgoing edges
      const ctxNoEdges = getMockCtx({
        nodes: [internet],
        edgeMap: new Map()
      });
      expect(isInternetConnectionRed(internet, ctxNoEdges)).toBe(true);

      // 2. Direct edge has validationError
      const edgeErr = { id: 'e1', source: 'i1', target: 's1', data: { validationError: 'Bad connection' } } as Edge;
      const ctxErr = getMockCtx({
        nodes: [internet],
        edgeMap: new Map([['i1', [edgeErr]]])
      });
      expect(isInternetConnectionRed(internet, ctxErr)).toBe(true);

      // 3. Downstream Service without workload target, without ingress target, and not NodePort -> unready
      const cipService = createNode('s1', 'Service', { serviceType: 'ClusterIP' });
      const edgeOk = { id: 'e2', source: 'i1', target: 's1' } as Edge;
      const ctxUnreadySvc = getMockCtx({
        nodes: [internet, cipService],
        activeSimulationEdges: ['e2'],
        edgeMap: new Map([['i1', [edgeOk]]]),
        nodeMap: new Map([['i1', internet], ['s1', cipService]])
      });
      expect(isInternetConnectionRed(internet, ctxUnreadySvc)).toBe(true);

      // 4. Downstream Ingress without valid backend -> unready
      const ingUnready = createNode('ing1', 'Ingress', { backendServiceName: 'missing' });
      const edgeIng = { id: 'e3', source: 'i1', target: 'ing1' } as Edge;
      const ctxUnreadyIng = getMockCtx({
        nodes: [internet, ingUnready],
        activeSimulationEdges: ['e3'],
        edgeMap: new Map([['i1', [edgeIng]]]),
        nodeMap: new Map([['i1', internet], ['ing1', ingUnready]])
      });
      expect(isInternetConnectionRed(internet, ctxUnreadyIng)).toBe(true);

      // 5. Valid healthy connection returns false (not red)
      const podReady = createNode('pod1', 'Pod', { status: 'ready' });
      const edgeHealthy = { id: 'e4', source: 'i1', target: 'pod1' } as Edge;
      const ctxHealthy = getMockCtx({
        nodes: [internet, podReady],
        activeSimulationEdges: ['e4'],
        edgeMap: new Map([['i1', [edgeHealthy]]]),
        nodeMap: new Map([['i1', internet], ['pod1', podReady]])
      });
      expect(isInternetConnectionRed(internet, ctxHealthy)).toBe(false);

      // 6. Downstream path edge validationError in hasUnreadyDownstreamPath
      const edgeDownErr = { id: 'e5', source: 'pod1', target: 's1', data: { validationError: 'Downstream Error' } } as Edge;
      const ctxDownErr = getMockCtx({
        nodes: [internet, podReady, cipService],
        activeSimulationEdges: ['e4', 'e5'],
        edgeMap: new Map([['i1', [edgeHealthy]], ['pod1', [edgeDownErr]]]),
        nodeMap: new Map([['i1', internet], ['pod1', podReady], ['s1', cipService]])
      });
      expect(isInternetConnectionRed(internet, ctxDownErr)).toBe(true);
    });

    it('covers simulationReachability helper functions: enqueueDynamicIngressTargets with serviceName, and isServiceValidForProcessing with empty nodes or targetNode null', () => {
      // 1. Ingress with serviceName fallback in enqueueDynamicIngressTargets and calculateReachability
      const ingWithServiceName = createNode('ing-svc-name', 'Ingress', { serviceName: 'backend-app' });
      const targetBackendSvc = createNode('backend-app-node', 'Service', { label: 'backend-app', serviceType: 'ClusterIP' });

      const reachSet = calculateReachability([ingWithServiceName], new Map(), [], [ingWithServiceName, targetBackendSvc]);
      expect(reachSet.has('backend-app-node')).toBe(true);

      // 2. isServiceValidForProcessing when nodes is undefined
      const cipSvc = createNode('s-cip', 'Service', { serviceType: 'ClusterIP', selector: 'app-web' });
      const edgeToSvc = { id: 'e-svc', source: 's-cip', target: 'other-node' } as Edge;
      const edgeMapSvc = new Map([['s-cip', [edgeToSvc]]]);

      const reachSetNoNodes = calculateReachability([cipSvc], edgeMapSvc, ['e-svc'], undefined);
      expect(reachSetNoNodes.has('s-cip')).toBe(true);

      // 3. hasValidIngressBackend when target is undefined or not Service
      const ingWithMissingTarget = createNode('ing-missing', 'Ingress', {});
      const edgeToMissing = { id: 'e-missing', source: 'ing-missing', target: 'non-existent' } as Edge;
      expect(hasValidIngressBackend(ingWithMissingTarget, [], new Map([['ing-missing', [edgeToMissing]]]))).toBe(false);
    });

    it('covers all remaining simulationReachability uncovered conditions (node undefined check, deployment childPod data.parentId, activeEdgesSet empty, visited cycle)', () => {
      const internet = createNode('i1', 'Internet');

      // 1. checkNodeUnreadyInternal when node is undefined in hasUnreadyDownstreamPath
      const edgeToUndefined = { id: 'e-undef', source: 'i1', target: 'ghost-node' } as Edge;
      const ctxGhost = getMockCtx({
        nodes: [internet],
        activeSimulationEdges: ['e-undef'],
        edgeMap: new Map([['i1', [edgeToUndefined]]]),
        nodeMap: new Map([['i1', internet]])
      });
      expect(isInternetConnectionRed(internet, ctxGhost)).toBe(true);

      // 2. Deployment child pod via data.parentId unready check
      const depNode = createNode('dep-data-parent', 'Deployment', { status: 'ready' });
      const childPodDataParent = {
        id: 'pod-dp',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: { parentId: 'dep-data-parent', status: 'pending' }
      } as Node;
      const edgeDep = { id: 'e-dep', source: 'i1', target: 'dep-data-parent' } as Edge;

      const ctxDataParent = getMockCtx({
        nodes: [internet, depNode, childPodDataParent],
        activeSimulationEdges: ['e-dep'],
        edgeMap: new Map([['i1', [edgeDep]]]),
        nodeMap: new Map([['i1', internet], ['dep-data-parent', depNode], ['pod-dp', childPodDataParent]])
      });
      expect(isInternetConnectionRed(internet, ctxDataParent)).toBe(true);

      // 3. activeEdgesSet size === 0 in hasUnreadyDownstreamPath permits downstream edge traversal
      const podReady = createNode('pod1', 'Pod', { status: 'ready' });
      const pod2Unready = createNode('pod2', 'Pod', { status: 'pending' });
      const edgePod1Pod2 = { id: 'e-p1-p2', source: 'pod1', target: 'pod2' } as Edge;

      const ctxEmptyActiveSet = getMockCtx({
        nodes: [internet, podReady, pod2Unready],
        activeSimulationEdges: [], // empty activeSimulationEdges
        edgeMap: new Map([['i1', [{ id: 'e-int', source: 'i1', target: 'pod1' } as Edge]], ['pod1', [edgePod1Pod2]]]),
        nodeMap: new Map([['i1', internet], ['pod1', podReady], ['pod2', pod2Unready]])
      });
      expect(isInternetConnectionRed(internet, ctxEmptyActiveSet)).toBe(true);

      // 4. Downstream path cycle / visited set in hasUnreadyDownstreamPath
      const nodeA = createNode('nodeA', 'Pod', { status: 'ready' });
      const edgeCycle = { id: 'e-cycle', source: 'nodeA', target: 'nodeA' } as Edge;
      const ctxCycle = getMockCtx({
        nodes: [internet, nodeA],
        activeSimulationEdges: ['e-int-a', 'e-cycle'],
        edgeMap: new Map([['i1', [{ id: 'e-int-a', source: 'i1', target: 'nodeA' } as Edge]], ['nodeA', [edgeCycle]]]),
        nodeMap: new Map([['i1', internet], ['nodeA', nodeA]])
      });
      expect(isInternetConnectionRed(internet, ctxCycle)).toBe(false);

      // 5. isInternetConnectionRed when edgeMap is missing or returns undefined
      const ctxNoEdgeMap = getMockCtx({
        nodes: [internet],
        edgeMap: undefined as any
      });
      expect(isInternetConnectionRed(internet, ctxNoEdgeMap)).toBe(true);
    });
  });

  describe('Secret simulation tests', () => {
    it('parseSecretSimulationSettings detects auth failures and returns clean status', () => {
      expect(parseSecretSimulationSettings([])).toEqual({ hasAuthFailure: false, failingSecretName: '' });
      expect(parseSecretSimulationSettings([{ id: 's1', name: 'sec1', secretData: [] }])).toEqual({ hasAuthFailure: false, failingSecretName: '' });

      const failureSecret = [
        {
          id: 's1',
          name: 'bad-secret',
          secretData: [{ key: 'SIMULATE_FAILURE', value: 'true' }]
        }
      ];
      expect(parseSecretSimulationSettings(failureSecret)).toEqual({ hasAuthFailure: true, failingSecretName: 'bad-secret' });

      const invalidCreds = [
        {
          id: 's2',
          name: 'invalid-cred-secret',
          secretData: [{ key: 'INVALID_CREDENTIALS', value: 'true' }]
        }
      ];
      expect(parseSecretSimulationSettings(invalidCreds)).toEqual({ hasAuthFailure: true, failingSecretName: 'invalid-cred-secret' });

      const failAuthSecret = [
        {
          id: 's3',
          name: 'auth-fail-sec',
          secretData: [{ key: 'FAIL_AUTH', value: 'enabled' }]
        }
      ];
      expect(parseSecretSimulationSettings(failAuthSecret)).toEqual({ hasAuthFailure: true, failingSecretName: 'auth-fail-sec' });
    });

    it('checkSecretSimulationStatus crashes child pods when secret has auth failure', () => {
      const dep = createNode('dep-sec', 'Deployment', {
        label: 'auth-workload',
        secrets: [
          {
            id: 's1',
            name: 'broken-sec',
            secretData: [{ key: 'SIMULATE_FAILURE', value: 'true' }]
          }
        ]
      });
      const pod = createNode('pod-sec-1', 'Pod', { parentId: 'dep-sec', status: 'ready', image: 'nginx:latest' });
      const addLog = vi.fn();
      const ctx = getMockCtx({
        nodes: [dep, pod],
        childPodMap: new Map([['dep-sec', [pod]]]),
        get: vi.fn().mockReturnValue({ addLog }),
        ticks: 3
      });
      ctx.updatedNodes = [dep, pod];
      ctx.nodeIndexMap = new Map([['dep-sec', 0], ['pod-sec-1', 1]]);

      const res = checkSecretSimulationStatus(dep, ctx);
      expect(res.isBlocked).toBe(true);
      expect(res.hasChanges).toBe(true);
      expect(ctx.updatedNodes[1].data.status).toBe('crashing');
      expect(ctx.updatedNodes[1].data.simulatedFailureSecret).toBe('broken-sec');
      expect(addLog).toHaveBeenCalledWith('warning', expect.stringContaining('Invalid credentials in Secret "broken-sec"'), 'Simulation');
    });

    it('checkSecretSimulationStatus crashes pods when secret is required but missing, and recovers when attached', () => {
      const dep = createNode('dep-req', 'Deployment', {
        label: 'req-workload',
        requireSecret: true,
        secrets: []
      });
      const pod = createNode('pod-req-1', 'Pod', { parentId: 'dep-req', status: 'ready', image: 'nginx:latest' });
      const addLog = vi.fn();
      const ctx = getMockCtx({
        nodes: [dep, pod],
        childPodMap: new Map([['dep-req', [pod]]]),
        get: vi.fn().mockReturnValue({ addLog }),
        ticks: 3
      });
      ctx.updatedNodes = [dep, pod];
      ctx.nodeIndexMap = new Map([['dep-req', 0], ['pod-req-1', 1]]);

      // 1. Missing secret
      const resMissing = checkSecretSimulationStatus(dep, ctx, true);
      expect(resMissing.isBlocked).toBe(true);
      expect(ctx.updatedNodes[1].data.status).toBe('crashing');
      expect(ctx.updatedNodes[1].data.simulatedFailureSecret).toBe('missing_secret');

      // 2. Attach valid secret and verify recovery
      dep.data.secrets = [{ id: 's-ok', name: 'valid-secret', secretData: [{ key: 'DB_PASS', value: 'secret' }] }];
      ctx.childPodMap = new Map([['dep-req', [ctx.updatedNodes[1]]]]);
      const resRecover = checkSecretSimulationStatus(dep, ctx, false);
      expect(resRecover.isBlocked).toBe(false);
      expect(resRecover.hasChanges).toBe(true);
      expect(ctx.updatedNodes[1].data.status).toBe('ready');
      expect(ctx.updatedNodes[1].data.simulatedFailureSecret).toBeUndefined();
    });

    it('processWorkloadSimulation blocks and unblocks via ConfigMap REQUIRE_SECRET', () => {
      const dep = createNode('dep-cm-sec', 'Deployment', {
        label: 'cm-sec-workload',
        status: 'ready',
        configMaps: [{ id: 'cm-req', name: 'cm-auth', configData: [{ key: 'REQUIRE_SECRET', value: 'true' }] }],
        secrets: []
      });
      const pod = createNode('pod-cm-sec', 'Pod', { parentId: 'dep-cm-sec', status: 'ready', image: 'nginx:latest' });
      const ctx = getMockCtx({
        nodes: [dep, pod],
        childPodMap: new Map([['dep-cm-sec', [pod]]]),
        ticks: 1
      });
      ctx.updatedNodes = [dep, pod];
      ctx.nodeIndexMap = new Map([['dep-cm-sec', 0], ['pod-cm-sec', 1]]);

      // Blocked because REQUIRE_SECRET is true and secrets is empty
      const blockedRes = processWorkloadSimulation(dep, ctx);
      expect(blockedRes.hasChanges).toBe(true);
      expect(ctx.updatedNodes[1].data.status).toBe('crashing');

      // Add secret and run again
      dep.data.secrets = [{ id: 'sec-ok', name: 'app-secret', secretData: [{ key: 'TOKEN', value: 'xyz' }] }];
      ctx.childPodMap = new Map([['dep-cm-sec', [ctx.updatedNodes[1]]]]);
      const okRes = processWorkloadSimulation(dep, ctx);
      expect(ctx.updatedNodes[1].data.status).toBe('ready');
    });

    it('covers all branch edge cases for ConfigMap & Secret simulation and recovery', () => {
      // 1. parseConfigKeyValuePair alternative keys and invalid numbers
      const cmSettings = parseConfigMapSettings([
        {
          id: 'cm-alt',
          name: 'alt-cm',
          configData: [
            { key: 'AUTH_REQUIRED', value: 'true' },
            { key: 'SIMULATE_FAILURE', value: 'true' },
            { key: 'PORT', value: 'invalid-port' },
            { key: 'MAX_CONNECTIONS', value: 'invalid-max' },
            { key: 'LOG_LEVEL', value: 'debug' },
            { key: undefined as any, value: 'val' },
          ],
        },
        { id: 'cm-no-data', name: 'no-data-cm' } as any, // cm.configData is undefined
      ]);
      expect(cmSettings.requireSecret).toBe(true);
      expect(cmSettings.hasSimulatedFailure).toBe(true);
      expect(cmSettings.cmPort).toBeNull();
      expect(cmSettings.maxConnections).toBeNull();
      expect(cmSettings.logLevel).toBe('DEBUG');

      // 2. parseSecretSimulationSettings alternative failure keys
      const secFailureSettings = parseSecretSimulationSettings([
        { id: 's-fail-1', name: 'sec-1', secretData: [{ key: 'FAIL_AUTH', value: 'enabled' }] },
        { id: 's-invalid-data', name: 'sec-null', secretData: null as any },
      ]);
      expect(secFailureSettings.hasAuthFailure).toBe(true);
      expect(secFailureSettings.failingSecretName).toBe('sec-1');

      // 3. Pod recovery without image configures status as 'pending'
      const podNoImg = createNode('pod-no-img', 'Pod', {
        status: 'crashing',
        simulatedFailureCM: 'chaos-cm',
        simulatedFailureSecret: 'sec-fail',
      });
      const ctxRecovery = getMockCtx({
        nodes: [podNoImg],
        updatedNodes: [podNoImg],
      });

      // Handle chaos mode recovery for pod with no image
      const chaosRecover = handleChaosModeSimulation([podNoImg], ctxRecovery, false, '');
      expect(chaosRecover.hasChanges).toBe(true);
      expect(ctxRecovery.updatedNodes[0].data.status).toBe('pending');

      // Handle secret recovery for pod with no image
      podNoImg.data.status = 'crashing';
      podNoImg.data.simulatedFailureSecret = 'sec-fail';
      const secretRecover = checkSecretSimulationStatus(podNoImg, ctxRecovery, false);
      expect(secretRecover.hasChanges).toBe(true);
      expect(ctxRecovery.updatedNodes[0].data.status).toBe('pending');

      // 4. Catch blocks and label fallbacks for logging
      const throwCtx = getMockCtx();
      throwCtx.get = vi.fn().mockReturnValue({
        addLog: () => {
          throw new Error('Log dispatch failed');
        },
      });

      // ConfigMap failure and recovery catch blocks with fallback to pod.id (no label)
      const podNoLabel = createNode('pod-no-label', 'Pod', { status: 'ready', image: 'nginx' });
      throwCtx.nodes = [podNoLabel];
      throwCtx.updatedNodes = [podNoLabel];
      throwCtx.nodeIndexMap = new Map([['pod-no-label', 0]]);

      const chaosFailThrow = handleChaosModeSimulation([podNoLabel], throwCtx, true, 'cm-chaos');
      expect(chaosFailThrow.hasChanges).toBe(true);

      const chaosRecoverThrow = handleChaosModeSimulation([throwCtx.updatedNodes[0]], throwCtx, false, 'cm-chaos');
      expect(chaosRecoverThrow.hasChanges).toBe(true);

      // Secret failure and recovery catch blocks with fallback to pod.id
      const secretFailThrow = checkSecretSimulationStatus(podNoLabel, throwCtx, true);
      expect(secretFailThrow.hasChanges).toBe(true);

      // Trigger recoverSinglePodFromSecret catch block (line 325)
      podNoLabel.data.status = 'crashing';
      podNoLabel.data.simulatedFailureSecret = 'auth_fail';
      const secretRecoverThrow = checkSecretSimulationStatus(podNoLabel, throwCtx, false);
      expect(secretRecoverThrow.hasChanges).toBe(true);

      // updateNodeData failure branches on applyPodSimulatedFailure (line 67), recoverSinglePod (line 102), and recoverSinglePodFromSecret (line 320)
      const unindexedPod = createNode('unindexed-pod', 'Pod', {
        status: 'crashing',
        simulatedFailureCM: 'cm-x',
        simulatedFailureSecret: 'sec-x',
      });
      const unindexedCtx = getMockCtx({
        nodes: [unindexedPod],
        updatedNodes: [], // empty updatedNodes causes updateNodeData to return false
        nodeIndexMap: new Map(),
      });
      // Line 67: applyPodSimulatedFailure returns false when updateNodeData fails
      const unindexedReadyPod = createNode('unindexed-ready', 'Pod', { status: 'ready' });
      expect(handleChaosModeSimulation([unindexedReadyPod], unindexedCtx, true, 'cm-fail').hasChanges).toBe(false);
      expect(handleChaosModeSimulation([unindexedPod], unindexedCtx, false, '').hasChanges).toBe(false);
      expect(checkSecretSimulationStatus(unindexedPod, unindexedCtx, false).hasChanges).toBe(false);

      // 5. Port mismatch logging, fallback ports, and error clear
      const srvNode = createNode('srv-1', 'Service', {
        port: 8080, // targetPort undefined, falls back to port
      });
      const srvEdge = { id: 'e-srv', source: 'srv-1', target: 'pod-no-label' } as Edge;
      const portCtx = getMockCtx({
        nodes: [srvNode, podNoLabel],
        updatedNodes: [srvNode, podNoLabel],
        nodeMap: new Map([['srv-1', srvNode], ['pod-no-label', podNoLabel]]),
        targetEdgeMap: new Map([['pod-no-label', [srvEdge]]]),
      });

      // Mismatch between cmPort 3000 and srvTargetPort 8080
      const mismatchRes = checkPortMismatch(podNoLabel, portCtx, 3000);
      expect(mismatchRes.isBlocked).toBe(true);
      expect(srvEdge.data?.validationError).toContain('Port Mismatch');

      // Edge already has matching validationError (lines 178-181 branch false)
      const repeatRes = checkPortMismatch(podNoLabel, portCtx, 3000);
      expect(repeatRes.isBlocked).toBe(true);

      // Resolve mismatch with cmPort 8080 -> clears validationError (line 185)
      const resolvedPortRes = checkPortMismatch(podNoLabel, portCtx, 8080);
      expect(resolvedPortRes.isBlocked).toBe(false);
      expect(srvEdge.data?.validationError).toBeUndefined();

      // Fallback to default port 80 when both targetPort and port are undefined
      srvNode.data = {};
      const fallbackPortRes = checkPortMismatch(podNoLabel, portCtx, 80);
      expect(fallbackPortRes.isBlocked).toBe(false);

      // Non-service source node in checkPortMismatch
      const nonSrvNode = createNode('other-source', 'Deployment');
      const nonSrvEdge = { id: 'e-other', source: 'other-source', target: 'pod-no-label' } as Edge;
      portCtx.nodeMap = new Map([['other-source', nonSrvNode]]);
      portCtx.targetEdgeMap = new Map([['pod-no-label', [nonSrvEdge]]]);
      const nonSrvRes = checkPortMismatch(podNoLabel, portCtx, 80);
      expect(nonSrvRes.isBlocked).toBe(false);

      // Port mismatch error throw block
      portCtx.get = vi.fn().mockReturnValue({
        addLog: () => {
          throw new Error('Port log failed');
        },
      });
      delete srvEdge.data?.validationError;
      portCtx.nodeMap = new Map([['srv-1', srvNode]]);
      portCtx.targetEdgeMap = new Map([['pod-no-label', [srvEdge]]]);
      srvNode.data = { targetPort: 8080 };
      expect(checkPortMismatch(podNoLabel, portCtx, 9999).isBlocked).toBe(true);

      // 6. logLogLevelStream for DEBUG, WARN, ERROR levels
      (safeRandom as any).mockReturnValue(0.9); // pass > 0.4 check
      const logCtx = getMockCtx({ ticks: 3 }); // pass % 3 === 0
      const appNode = createNode('app-node', 'Pod');
      logLogLevelStream(appNode, logCtx, 'DEBUG');
      logLogLevelStream(appNode, logCtx, 'WARN');
      logLogLevelStream(appNode, logCtx, 'ERROR');

      // logLogLevelStream catch block
      logCtx.get = vi.fn().mockReturnValue({
        addLog: () => {
          throw new Error('Stream log failed');
        },
      });
      logLogLevelStream(appNode, logCtx, 'ERROR');

      // 7. Workload simulation with PVC blockage
      const pvcBlockedDep = createNode('dep-pvc-block', 'Deployment', { status: 'ready' });
      const pvcNode = createNode('pvc-block', 'PVC', { pvcStatus: 'Pending' });
      const edgeToPvc = { id: 'e-pvc', source: 'pvc-block', target: 'dep-pvc-block' } as Edge;
      const pvcBlockCtx = getMockCtx({
        nodes: [pvcBlockedDep, pvcNode],
        updatedNodes: [pvcBlockedDep, pvcNode],
        nodeMap: new Map([['dep-pvc-block', pvcBlockedDep], ['pvc-block', pvcNode]]),
        targetEdgeMap: new Map([['dep-pvc-block', [edgeToPvc]]]),
      });
      const pvcWorkloadRes = processWorkloadSimulation(pvcBlockedDep, pvcBlockCtx);
      expect(pvcWorkloadRes.hasChanges).toBe(true);

      // 8. Traffic throttling with even and odd ticks, and catch block
      const depThrottled = createNode('dep-throttled', 'Deployment', {
        status: 'ready',
        configMaps: [{ id: 'cm-max', name: 'cm-max', configData: [{ key: 'MAX_CONNECTIONS', value: '10' }] }],
      });
      const netNode = createNode('net-1', 'Internet', { traffic: 1000, currentTraffic: 1000 });
      const inEdge = { id: 'e-throttle', source: 'net-1', target: 'dep-throttled' } as Edge;

      const throttleCtxEven = getMockCtx({
        ticks: 2,
        nodes: [depThrottled, netNode],
        nodeMap: new Map([['dep-throttled', depThrottled], ['net-1', netNode]]),
        targetEdgeMap: new Map([['dep-throttled', [inEdge]]]),
      });
      const throttleEvenRes = processWorkloadSimulation(depThrottled, throttleCtxEven);
      expect(throttleEvenRes).toBeDefined();

      // checkConfigMapSimulationStatus with dep.type !== 'Pod' and childPodMap without dep entry (line 378 fallback to [])
      const depNoChildMap = createNode('dep-no-map', 'Deployment');
      const ctxNoChildMap = getMockCtx({ childPodMap: new Map() });
      expect(checkConfigMapSimulationStatus(depNoChildMap, ctxNoChildMap)).toBeDefined();

      // Lines 84, 284, 306: applySimulatedFailures and applySecretPodFailures
      const podAlreadyCrashing = createNode('pod-already-crash', 'Pod', {
        status: 'crashing',
        simulatedFailureCM: 'cm-x',
        simulatedFailureSecret: 'sec-x',
      });
      const crashCtx = getMockCtx({
        nodes: [podAlreadyCrashing],
        updatedNodes: [podAlreadyCrashing],
      });
      expect(handleChaosModeSimulation([podAlreadyCrashing], crashCtx, true, 'cm-fail').hasChanges).toBe(false);
      expect(checkSecretSimulationStatus(podAlreadyCrashing, crashCtx, true).hasChanges).toBe(false);

      // Line 284: applySecretPodFailure updateNodeData returns false
      const readyUnindexedPod = createNode('ready-unindexed', 'Pod', { status: 'ready' });
      expect(checkSecretSimulationStatus(readyUnindexedPod, unindexedCtx, true).hasChanges).toBe(false);

      // Line 378: childPodMap is undefined
      const depUndefinedChildMap = createNode('dep-undef-map', 'Deployment');
      const ctxUndefChildMap = getMockCtx({ childPodMap: undefined });
      expect(checkConfigMapSimulationStatus(depUndefinedChildMap, ctxUndefChildMap)).toBeDefined();

      // Line 432: processWorkloadSimulation when pvcResult.isBlocked is true AND cmResult/secretResult hasChanges is true
      const depCmRecoverPvcBlock = createNode('dep-cr-pb', 'Deployment', {
        status: 'ready',
        configMaps: [{ id: 'cm-normal', name: 'cm-normal', configData: [] }],
        secrets: [{ id: 'sec-valid', name: 'sec-v', secretData: [{ key: 'K', value: 'V' }] }],
      });
      const podToRecover = createNode('pod-to-rec', 'Pod', {
        parentId: 'dep-cr-pb',
        status: 'crashing',
        simulatedFailureCM: 'old-cm',
        simulatedFailureSecret: 'old-sec',
        image: 'nginx:latest',
      });
      const pvcBlock = createNode('pvc-pending', 'PVC', { pvcStatus: 'Pending' });
      const edgeToPvcBlock = { id: 'e-pvc-b', source: 'pvc-pending', target: 'dep-cr-pb' } as Edge;

      const comboCtx = getMockCtx({
        nodes: [depCmRecoverPvcBlock, podToRecover, pvcBlock],
        updatedNodes: [depCmRecoverPvcBlock, podToRecover, pvcBlock],
        nodeMap: new Map([
          ['dep-cr-pb', depCmRecoverPvcBlock],
          ['pod-to-rec', podToRecover],
          ['pvc-pending', pvcBlock],
        ]),
        targetEdgeMap: new Map([['dep-cr-pb', [edgeToPvcBlock]]]),
        childPodMap: new Map([['dep-cr-pb', [podToRecover]]]),
      });
      comboCtx.nodeIndexMap = new Map([
        ['dep-cr-pb', 0],
        ['pod-to-rec', 1],
        ['pvc-pending', 2],
      ]);
      const comboRes = processWorkloadSimulation(depCmRecoverPvcBlock, comboCtx);
      expect(comboRes.hasChanges).toBe(true);

      // processWorkloadSimulation blocked by ConfigMap chaos mode (line 426)
      const depChaosBlock = createNode('dep-chaos-block', 'Deployment', {
        status: 'ready',
        configMaps: [{ id: 'cm-chaos-b', name: 'chaos-b', configData: [{ key: 'CHAOS_MODE', value: 'enabled' }] }],
      });
      const chaosBlockCtx = getMockCtx({
        nodes: [depChaosBlock],
        updatedNodes: [depChaosBlock],
        childPodMap: new Map(),
      });
      expect(processWorkloadSimulation(depChaosBlock, chaosBlockCtx).hasChanges).toBe(false);

      const throttleCtxOdd = getMockCtx({
        ticks: 3,
        nodes: [depThrottled, netNode],
        nodeMap: new Map([['dep-throttled', depThrottled], ['net-1', netNode]]),
        targetEdgeMap: new Map([['dep-throttled', [inEdge]]]),
        internetNodes: [netNode],
        internetReachableMap: new Map([[netNode.id, new Set([depThrottled.id])]]),
      });
      const throttleOddRes = processWorkloadSimulation(depThrottled, throttleCtxOdd);
      expect(throttleOddRes).toBeDefined();

      // Throttling catch block (line 415)
      const throttleThrowCtx = getMockCtx({
        ticks: 2,
        nodes: [depThrottled, netNode],
        nodeMap: new Map([['dep-throttled', depThrottled], ['net-1', netNode]]),
        targetEdgeMap: new Map([['dep-throttled', [inEdge]]]),
        internetNodes: [netNode],
        internetReachableMap: new Map([[netNode.id, new Set([depThrottled.id])]]),
      });
      throttleThrowCtx.get = vi.fn().mockReturnValue({
        addLog: () => {
          throw new Error('Throttling log error');
        },
      });
      const throttleThrowRes = processWorkloadSimulation(depThrottled, throttleThrowCtx);
      expect(throttleThrowRes).toBeDefined();
    });
  });
});
