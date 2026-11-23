import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Node } from '@xyflow/react';
import {
  calculateIncomingTraffic,
  getReachableWorkloadCount,
  isSimulationWorkload,
  getInterpolatedProfileTraffic,
  updateInternetTraffic,
  calculateResourceMetrics,
  calculateResponseLatencyMs,
  HPA_SCALE_DOWN_STABILIZATION_TICKS,
  handleHpaScaling,
  calculateDesiredReplicas,
} from '@/lib/simulationTraffic';
import { SimulationContext } from '@/lib/simulationTypes';
import { K8sNodeData } from '@/types';

describe('simulationTraffic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isSimulationWorkload', () => {
    it('correctly identifies workload node types', () => {
      expect(isSimulationWorkload({ id: 'd1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} })).toBe(true);
      expect(isSimulationWorkload({ id: 'ss1', type: 'StatefulSet', position: { x: 0, y: 0 }, data: {} })).toBe(true);
      expect(isSimulationWorkload({ id: 'rs1', type: 'ReplicaSet', position: { x: 0, y: 0 }, data: {} })).toBe(true);
      expect(isSimulationWorkload({ id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: {} })).toBe(true);

      // Child pods and infrastructure nodes are not top-level workloads
      expect(isSimulationWorkload({ id: 'p2', type: 'Pod', parentId: 'd1', position: { x: 0, y: 0 }, data: {} })).toBe(false);
      expect(isSimulationWorkload({ id: 'p3', type: 'Pod', position: { x: 0, y: 0 }, data: { parentId: 'd1' } })).toBe(false);
      expect(isSimulationWorkload({ id: 'svc1', type: 'Service', position: { x: 0, y: 0 }, data: {} })).toBe(false);
      expect(isSimulationWorkload({ id: 'ing1', type: 'Ingress', position: { x: 0, y: 0 }, data: {} })).toBe(false);
    });
  });

  describe('calculateIncomingTraffic', () => {
    it('returns 0 when internetNodes or internetReachableMap are missing', () => {
      const dep: Node = { id: 'dep-1', position: { x: 0, y: 0 }, data: {} };
      expect(calculateIncomingTraffic(dep, {} as SimulationContext)).toEqual({ traffic: 0, hasChanges: false });
      expect(calculateIncomingTraffic(dep, { internetNodes: [] } as any)).toEqual({ traffic: 0, hasChanges: false });
    });

    it('handles unreachable internet node or internet node without reachable set or traffic', () => {
      const dep: Node = { id: 'dep-1', position: { x: 0, y: 0 }, data: {} };
      const netNode1: Node = { id: 'net-1', position: { x: 0, y: 0 }, data: { currentTraffic: 500 } };
      const netNode2: Node = { id: 'net-2', position: { x: 0, y: 0 }, data: {} }; // no currentTraffic
      const netNode3: Node = { id: 'net-3', position: { x: 0, y: 0 }, data: { currentTraffic: 300 } }; // not in reachable map

      const internetReachableMap = new Map<string, Set<string>>();
      internetReachableMap.set('net-1', new Set(['dep-1']));
      internetReachableMap.set('net-2', new Set(['dep-1']));

      const ctx: SimulationContext = {
        internetNodes: [netNode1, netNode2, netNode3],
        internetReachableMap,
        childPodMap: new Map(),
      } as any;

      const res = calculateIncomingTraffic(dep, ctx);
      // netNode1 (500) + netNode2 (fallback 0) + netNode3 (unreachable 0) = 500
      expect(res.traffic).toBe(500);
    });

    it('distributes incoming traffic evenly across multiple reachable workloads (Load Balancing)', () => {
      const dep1: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const dep2: Node = { id: 'dep-2', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const statefulSet: Node = { id: 'sts-1', type: 'StatefulSet', position: { x: 0, y: 0 }, data: {} };
      const netNode: Node = { id: 'net-1', type: 'Internet', position: { x: 0, y: 0 }, data: { currentTraffic: 6000 } };

      const internetReachableMap = new Map<string, Set<string>>();
      internetReachableMap.set('net-1', new Set(['dep-1', 'dep-2', 'sts-1']));

      const ctx: SimulationContext = {
        nodes: [netNode, dep1, dep2, statefulSet],
        internetNodes: [netNode],
        internetReachableMap,
        childPodMap: new Map(),
      } as any;

      // 6000 req/min divided equally among 3 reachable workloads = 2000 each
      expect(calculateIncomingTraffic(dep1, ctx).traffic).toBe(2000);
      expect(calculateIncomingTraffic(dep2, ctx).traffic).toBe(2000);
      expect(calculateIncomingTraffic(statefulSet, ctx).traffic).toBe(2000);
    });

    it('considers reachable workloads via child pods when calculating load balance distribution', () => {
      const dep1: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const dep2: Node = { id: 'dep-2', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const childPod1: Node = { id: 'pod-dep-1', type: 'Pod', parentId: 'dep-1', position: { x: 0, y: 0 }, data: {} };
      const childPod2: Node = { id: 'pod-dep-2', type: 'Pod', parentId: 'dep-2', position: { x: 0, y: 0 }, data: {} };
      const netNode: Node = { id: 'net-1', type: 'Internet', position: { x: 0, y: 0 }, data: { currentTraffic: 4000 } };

      // Reachability only contains the child pods, not the parent deployment IDs directly
      const internetReachableMap = new Map<string, Set<string>>();
      internetReachableMap.set('net-1', new Set(['pod-dep-1', 'pod-dep-2']));

      const childPodMap = new Map<string, Node[]>([
        ['dep-1', [childPod1]],
        ['dep-2', [childPod2]],
      ]);

      const ctx: SimulationContext = {
        nodes: [netNode, dep1, dep2, childPod1, childPod2],
        internetNodes: [netNode],
        internetReachableMap,
        childPodMap,
      } as any;

      expect(calculateIncomingTraffic(dep1, ctx).traffic).toBe(2000);
      expect(calculateIncomingTraffic(dep2, ctx).traffic).toBe(2000);
    });

    it('covers getReachableWorkloadCount fallbacks and unreachable workloads in calculateIncomingTraffic', () => {
      const dep1: Node = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const depUnreachable: Node = { id: 'dep-unreach', type: 'Deployment', position: { x: 0, y: 0 }, data: {} };
      const netNode: Node = { id: 'net-1', type: 'Internet', position: { x: 0, y: 0 }, data: { currentTraffic: 1000 } };

      // 1. Empty reachable set returns 1
      const emptyMap = new Map<string, Set<string>>([['net-empty', new Set()]]);
      expect(getReachableWorkloadCount('net-missing', { internetReachableMap: emptyMap } as any)).toBe(1);
      expect(getReachableWorkloadCount('net-empty', { internetReachableMap: emptyMap } as any)).toBe(1);

      // 2. Uses updatedNodes when nodes is empty, and ignores unreachable workloads (without childPodMap)
      const reachMap = new Map<string, Set<string>>([['net-1', new Set(['dep-1'])]]);
      const ctxWithUpdated: SimulationContext = {
        nodes: [],
        updatedNodes: [dep1, depUnreachable],
        internetNodes: [netNode],
        internetReachableMap: reachMap,
      } as any;

      expect(getReachableWorkloadCount('net-1', ctxWithUpdated)).toBe(1);
      // depUnreachable is not in reachable set -> getInternetNodeTraffic returns 0
      expect(calculateIncomingTraffic(depUnreachable, ctxWithUpdated).traffic).toBe(0);
    });
  });

  describe('getInterpolatedProfileTraffic', () => {
    it('returns default 1000 when profile is null or hourly/daily map is empty', () => {
      expect(getInterpolatedProfileTraffic(null, 100)).toBe(1000);
      expect(getInterpolatedProfileTraffic({}, 100)).toBe(1000);
      expect(getInterpolatedProfileTraffic({ hourly: {} }, 100)).toBe(1000);
    });

    it('interpolates traffic using daily map when hourly is missing', () => {
      const profile = {
        daily: { '00:00': 200, '12:00': 800, '24:00': 200 },
      };
      // Minute 360 is 06:00 (midway between 00:00 (200) and 12:00 (800)) => 500
      const traffic = getInterpolatedProfileTraffic(profile, 360);
      expect(traffic).toBe(500);
    });

    it('handles points not having minute 0 or 1440 and falls back to first point', () => {
      // Profile without 00:00 or 24:00
      const profile = {
        hourly: { '06:00': 600, '18:00': 1200 },
      };
      // minute 100 is between interpolated 00:00 (value of 06:00 = 600) and 06:00 (600) => 600
      const traffic = getInterpolatedProfileTraffic(profile, 100);
      expect(traffic).toBe(600);
    });

    it('returns exact match when minute key exists in hourly profile', () => {
      const profile = {
        hourly: { '08:30': 1500 },
      };
      // 8 * 60 + 30 = 510
      expect(getInterpolatedProfileTraffic(profile, 510)).toBe(1500);
    });
  });

  describe('updateInternetTraffic', () => {
    it('handles currentTraffic equal to targetTraffic and leaves traffic unchanged', () => {
      const internetNode: Node = {
        id: 'net-1',
        position: { x: 0, y: 0 },
        data: {
          traffic: 2000,
          currentTraffic: 2000,
          currentHourIndex: 0,
          currentMinuteIndex: 10,
          profileTicks: 5,
        },
      };

      const edge = { id: 'e1', source: 'net-1', target: 'svc-1', data: {} } as any;
      const svcNode = { id: 'svc-1', type: 'Service', data: { serviceType: 'NodePort' } } as any;
      const edgeMap = new Map([['net-1', [edge]]]);

      const ctx: SimulationContext = {
        ticks: 10,
        nodes: [internetNode, svcNode],
        updatedNodes: [internetNode],
        nodeMap: new Map([['net-1', internetNode], ['svc-1', svcNode]]),
        edgeMap,
        nodeIndexMap: new Map([['net-1', 0]]),
        get: () => ({ simulationSpeed: 1 }) as any,
      } as any;

      const res = updateInternetTraffic(internetNode, ctx);
      expect(res.traffic).toBe(2000);
    });

    it('decreases traffic when currentTraffic exceeds targetTraffic', () => {
      const internetNode: Node = {
        id: 'net-1',
        position: { x: 0, y: 0 },
        data: {
          traffic: 1000,
          currentTraffic: 5000,
        },
      };

      const edge = { id: 'e1', source: 'net-1', target: 'svc-1', data: {} } as any;
      const svcNode = { id: 'svc-1', type: 'Service', data: { serviceType: 'NodePort' } } as any;
      const edgeMap = new Map([['net-1', [edge]]]);

      const ctx: SimulationContext = {
        ticks: 10,
        nodes: [internetNode, svcNode],
        updatedNodes: [internetNode],
        nodeMap: new Map([['net-1', internetNode], ['svc-1', svcNode]]),
        edgeMap,
        nodeIndexMap: new Map([['net-1', 0]]),
        get: () => ({ simulationSpeed: 1 }) as any,
      } as any;

      const res = updateInternetTraffic(internetNode, ctx);
      expect(res.traffic).toBeLessThan(5000);
    });

    it('keeps the profile clock advancing while a red connection delivers zero traffic', () => {
      const internetNode: Node = {
        id: 'net-red',
        position: { x: 0, y: 0 },
        data: {
          currentTraffic: 0,
          currentHourIndex: 0,
          currentMinuteIndex: 0,
          profileTicks: 0,
        },
      };

      // edgeMap with no edges => isRed = true
      const ctx: SimulationContext = {
        ticks: 10,
        updatedNodes: [internetNode],
        edgeMap: new Map(),
        get: () => ({ simulationSpeed: 1 }) as any,
      } as any;

      const res = updateInternetTraffic(internetNode, ctx);
      expect(res.traffic).toBe(0);
      // Demand keeps moving with simulation time even though nothing is delivered.
      expect(res.hasChanges).toBe(true);
      expect(ctx.updatedNodes[0].data.currentMinuteIndex).toBe(1);
    });

    it('ramps up traffic when currentTraffic is below targetTraffic and handles connectionProfile when active', () => {
      const edge = { id: 'e1', source: 'net-1', target: 'svc-1', data: {} } as any;
      const svcNode = { id: 'svc-1', type: 'Service', data: { serviceType: 'NodePort' } } as any;
      const edgeMap = new Map([['net-1', [edge]]]);

      // 1. Ramping up from undefined currentTraffic (0) towards default traffic (1000) with default simulationSpeed (1)
      const rampNode: Node = {
        id: 'net-1',
        position: { x: 0, y: 0 },
        data: {},
      };
      const rampCtx: SimulationContext = {
        ticks: 10,
        nodes: [rampNode, svcNode],
        updatedNodes: [rampNode],
        nodeMap: new Map([['net-1', rampNode], ['svc-1', svcNode]]),
        edgeMap,
        nodeIndexMap: new Map([['net-1', 0]]),
      } as any;

      const rampRes = updateInternetTraffic(rampNode, rampCtx);
      expect(rampRes.traffic).toBe(1000);

      // 2. Using connectionProfile when ticks > 3 and not red
      const profileNode: Node = {
        id: 'net-1',
        position: { x: 0, y: 0 },
        data: {
          currentMinuteIndex: 0,
          connectionProfile: { hourly: { '00:01': 2500 } },
        },
      };
      const profileCtx: SimulationContext = {
        ticks: 10,
        nodes: [profileNode, svcNode],
        updatedNodes: [profileNode],
        nodeMap: new Map([['net-1', profileNode], ['svc-1', svcNode]]),
        edgeMap,
        nodeIndexMap: new Map([['net-1', 0]]),
      } as any;

      const profileRes = updateInternetTraffic(profileNode, profileCtx);
      expect(profileRes.traffic).toBe(2500);
    });
  });

  describe('calculateResourceMetrics', () => {
    it('calculates metrics with fallback when replicas is undefined or missing', () => {
      const dep: Node = {
        id: 'dep-1',
        position: { x: 0, y: 0 },
        data: {
          image: 'nginx:latest',
        },
      };

      const ctx: SimulationContext = {
        ticks: 5,
        newMetrics: {},
        childPodMap: new Map(),
      } as any;

      const metrics = calculateResourceMetrics(dep, 1000, ctx);
      expect(metrics.cpuPercent).toBeGreaterThan(0);
      expect(metrics.memoryPercent).toBeGreaterThan(0);
      expect(ctx.newMetrics['dep-1']).toHaveLength(1);
      expect(ctx.newMetrics['dep-1'][0].trafficRpm).toBe(1000);
      expect(ctx.newMetrics['dep-1'][0].latencyMs).toBeGreaterThan(0);

      // Same minuteIndex (ticks = 5) replaces in place rather than duplicating
      calculateResourceMetrics(dep, 1200, ctx);
      expect(ctx.newMetrics['dep-1']).toHaveLength(1);

      // Next minuteIndex (ticks = 6) appends a new point
      ctx.ticks = 6;
      calculateResourceMetrics(dep, 1200, ctx);
      expect(ctx.newMetrics['dep-1']).toHaveLength(2);
    });

    it('uses the global tick clock for metric minuteIndex with multiple Internet nodes', () => {
      const dep: Node = {
        id: 'dep-multi',
        position: { x: 0, y: 0 },
        data: { image: 'nginx:latest' },
      };
      const firstInternet: Node = {
        id: 'net-1',
        position: { x: 0, y: 0 },
        data: { currentMinuteIndex: 720 },
      };
      const secondInternet: Node = {
        id: 'net-2',
        position: { x: 0, y: 0 },
        data: { currentMinuteIndex: 30 },
      };
      const ctx: SimulationContext = {
        ticks: 95,
        newMetrics: {},
        childPodMap: new Map(),
        internetNodes: [firstInternet, secondInternet],
      } as any;

      calculateResourceMetrics(dep, 1000, ctx);

      expect(ctx.newMetrics['dep-multi'][0].minuteIndex).toBe(95);

      // Also test fallback image ('nginx:latest') and ticks fallback (0)
      const bareDep: Node = { id: 'dep-bare', position: { x: 0, y: 0 }, data: {} };
      const zeroTickCtx: SimulationContext = {
        ticks: 0,
        newMetrics: {},
      } as any;
      calculateResourceMetrics(bareDep, 500, zeroTickCtx);
      expect(zeroTickCtx.newMetrics['dep-bare'][0].minuteIndex).toBe(0);
    });
  });

  describe('calculateResponseLatencyMs', () => {
    it('returns zero when there is no traffic to measure and falls back to utilization 1 when safeCapacityRpm <= 0', () => {
      expect(calculateResponseLatencyMs(0, 0, 1000, true, true)).toBe(0);
      expect(calculateResponseLatencyMs(100, 100, 0, false, false)).toBe(25);
    });

    it('stays low under capacity and grows sharply past capacity', () => {
      const low = calculateResponseLatencyMs(100, 100, 1000, false, false);
      const high = calculateResponseLatencyMs(2000, 2000, 1000, false, false);

      expect(low).toBe(5);
      expect(high).toBeGreaterThan(100);
    });

    it('adds throttle and OOM penalties and caps extreme latency', () => {
      const plain = calculateResponseLatencyMs(100, 100, 1000, false, false);
      const throttled = calculateResponseLatencyMs(100, 100, 1000, true, false);
      const oom = calculateResponseLatencyMs(100, 100, 1000, false, true);
      const extreme = calculateResponseLatencyMs(1_000_000, 1_000_000, 100, true, true);

      expect(throttled).toBe(plain + 80);
      expect(oom).toBe(plain + 150);
      expect(extreme).toBe(1000);
    });
  });

  describe('handleHpaScaling', () => {
    it('handles direct attached HPA with missing minReplicas, maxReplicas, and targetCPU fallbacks', () => {
      const dep: Node = {
        id: 'dep-hpa',
        position: { x: 0, y: 0 },
        data: {
          // replicas undefined to test fallback to 1 (Branch 67)
          hpas: [{ id: 'hpa-1', name: 'my-hpa' }],
        },
      };

      const addActivityLog = vi.fn();
      const ctx: SimulationContext = {
        updatedNodes: [dep],
        nodeIndexMap: new Map([['dep-hpa', 0]]),
        get: () => ({ addActivityLog }) as any,
      } as any;

      // targetCPU defaults to 50. At cpuPercent = 90, scale up occurs
      const scaled = handleHpaScaling(dep, 90, ctx);
      expect(scaled).toBe(true);
      expect(addActivityLog).toHaveBeenCalledWith(expect.stringContaining('[HPA Autoscaler] Scaled up'));
    });

    it('uses targetMemory from an attached HPA to decide scaling', () => {
      const dep: Node = {
        id: 'dep-memory',
        position: { x: 0, y: 0 },
        data: {
          replicas: 4,
          hpas: [{
            id: 'hpa-memory',
            name: 'memory-aware-hpa',
            minReplicas: 1,
            maxReplicas: 10,
            targetCPU: 80,
            targetMemory: 50,
          }],
        },
      };
      const makeCtx = () => ({
        updatedNodes: [{ ...dep, data: { ...dep.data } }],
        nodeIndexMap: new Map([['dep-memory', 0]]),
        get: () => ({ addActivityLog: vi.fn() }) as any,
      } as any);

      // CPU wants 2, memory is inside its deadband -> 4, so no scale-down
      // is even considered and the stabilization counter stays idle.
      const blocked = makeCtx();
      expect(handleHpaScaling(dep, 40, blocked, 45)).toBe(false);
      expect(blocked.updatedNodes[0].data.replicas).toBe(4);
      expect(blocked.updatedNodes[0].data.lowCpuTicks ?? 0).toBe(0);

      // Memory is the bottleneck -> 8 replicas.
      const scaledUp = makeCtx();
      expect(handleHpaScaling(dep, 60, scaledUp, 90)).toBe(true);
      expect(scaledUp.updatedNodes[0].data.replicas).toBe(8);
    });

    it('handles connected HPA node with missing minReplicas, maxReplicas, and targetCPU fallbacks', () => {
      const dep: Node = {
        id: 'dep-conn',
        position: { x: 0, y: 0 },
        data: { replicas: 1 },
      };
      const hpaNode: Node = {
        id: 'hpa-node-1',
        type: 'HPA',
        position: { x: 0, y: 0 },
        data: {}, // no minReplicas, maxReplicas, targetCPU
      };
      const edge = { id: 'e1', source: 'hpa-node-1', target: 'dep-conn' };

      const ctx: SimulationContext = {
        updatedNodes: [dep, hpaNode],
        nodeIndexMap: new Map([['dep-conn', 0], ['hpa-node-1', 1]]),
        nodeMap: new Map([['dep-conn', dep], ['hpa-node-1', hpaNode]]),
        targetEdgeMap: new Map([['dep-conn', [edge]]]),
        get: () => ({}) as any,
      } as any;

      const scaled = handleHpaScaling(dep, 90, ctx);
      expect(scaled).toBe(true);
    });

    it('handles node-bound HPA config with targetCPU fallback', () => {
      const dep: Node = {
        id: 'dep-bound',
        position: { x: 0, y: 0 },
        data: {
          replicas: 1,
          minReplicas: 1,
          maxReplicas: 5,
          // targetCPU missing (defaults to 50)
        },
      };

      const ctx: SimulationContext = {
        updatedNodes: [dep],
        nodeIndexMap: new Map([['dep-bound', 0]]),
        get: () => ({}) as any,
      } as any;

      const scaled = handleHpaScaling(dep, 90, ctx);
      expect(scaled).toBe(true);
    });

    it('handles scaleDeploymentReplicas when nodeIndexMap is missing and when dep is not found in updatedNodes', () => {
      const dep: Node = {
        id: 'dep-ghost',
        position: { x: 0, y: 0 },
        data: {
          replicas: 1,
          hpas: [{ id: 'h1', minReplicas: 1, maxReplicas: 5, targetCPU: 50 }],
        },
      };

      // 1. ctx has no nodeIndexMap, dep is not in updatedNodes -> returns false
      const ctxMissing: SimulationContext = {
        updatedNodes: [],
        get: () => ({}) as any,
      } as any;

      const res = handleHpaScaling(dep, 90, ctxMissing);
      expect(res).toBe(false);

      // 2. ctx has no nodeIndexMap, but dep is present in updatedNodes -> finds index via findIndex
      const ctxPresent: SimulationContext = {
        updatedNodes: [{ ...dep }],
        get: () => ({}) as any,
      } as any;

      const resPresent = handleHpaScaling(dep, 90, ctxPresent);
      expect(resPresent).toBe(true);
    });

    it('returns false when no HPA is configured and handles non-HPA incoming edges, syncDeployment, and child pod scaling', () => {
      // 1. No HPA configured (minReplicas set without maxReplicas, and non-HPA incoming edge)
      const plainDep: Node = {
        id: 'dep-plain',
        position: { x: 0, y: 0 },
        data: { replicas: 1, minReplicas: 1 },
      };
      const svcNode: Node = { id: 'svc-1', type: 'Service', position: { x: 0, y: 0 }, data: {} };
      const ctxNoHpa: SimulationContext = {
        updatedNodes: [plainDep, svcNode],
        nodeMap: new Map([['dep-plain', plainDep], ['svc-1', svcNode]]),
        targetEdgeMap: new Map([['dep-plain', [{ id: 'e1', source: 'svc-1', target: 'dep-plain' }]]]),
      } as any;
      expect(handleHpaScaling(plainDep, 90, ctxNoHpa)).toBe(false);

      // 2. Uses ctx.syncDeployment when provided
      const syncDep: Node = {
        id: 'dep-sync',
        position: { x: 0, y: 0 },
        data: {
          label: 'sync-app',
          replicas: 1,
          hpas: [{ id: 'h1', minReplicas: 1, maxReplicas: 5, targetCPU: 50 }],
        },
      };
      const oldChildPod: Node = { id: 'dep-sync-pod-0', type: 'Pod', parentId: 'dep-sync', position: { x: 0, y: 0 }, data: {} };
      const unrelatedNode: Node = { id: 'other-node', type: 'Service', position: { x: 0, y: 0 }, data: {} };
      const syncDeployment = vi.fn().mockReturnValue({
        updatedDeployment: { ...syncDep, data: { ...syncDep.data, replicas: 2 } },
        laidOut: [oldChildPod],
      });
      const ctxSync: SimulationContext = {
        updatedNodes: [syncDep, oldChildPod, unrelatedNode],
        nodeIndexMap: new Map([['dep-sync', 0]]),
        syncDeployment,
        get: () => ({ addActivityLog: vi.fn() }) as any,
      } as any;
      expect(handleHpaScaling(syncDep, 100, ctxSync)).toBe(true);
      expect(syncDeployment).toHaveBeenCalled();

      // 3. Standalone child pod template cloning on scale-up (with and without templatePod.data.label)
      const depWithChild: Node = {
        id: 'dep-children',
        position: { x: 0, y: 0 },
        data: {
          replicas: 1,
          hpas: [{ id: 'h1', minReplicas: 1, maxReplicas: 5, targetCPU: 50 }],
        },
      };
      const childWithLabel: Node = {
        id: 'dep-children-pod-0',
        type: 'Pod',
        parentId: 'dep-children',
        position: { x: 0, y: 0 },
        data: { label: 'web' },
      };
      const ctxChildLabel: SimulationContext = {
        updatedNodes: [depWithChild, childWithLabel, unrelatedNode],
        nodeIndexMap: new Map([['dep-children', 0]]),
        get: () => ({}) as any,
      } as any;
      expect(handleHpaScaling(depWithChild, 100, ctxChildLabel)).toBe(true);
      expect(ctxChildLabel.updatedNodes.filter(n => n.type === 'Pod')).toHaveLength(2);

      // Child pod matched via data.parentId and without data.label
      const childViaDataParent: Node = {
        id: 'dep-children-pod-0',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: { parentId: 'dep-children' },
      };
      const ctxChildNoLabel: SimulationContext = {
        updatedNodes: [depWithChild, childViaDataParent],
        nodeIndexMap: new Map([['dep-children', 0]]),
        get: () => ({}) as any,
      } as any;
      expect(handleHpaScaling(depWithChild, 100, ctxChildNoLabel)).toBe(true);
      const createdPods = ctxChildNoLabel.updatedNodes.filter(n => n.type === 'Pod');
      expect(createdPods).toHaveLength(2);
      expect(createdPods[1].data.label).toBe('pod-1');
    });
  });

  describe('calculateDesiredReplicas', () => {
    it('falls back to default targetCPU (50), minReplicas (1), and maxReplicas (10) when missing', () => {
      // ratio = 50 / 50 = 1, within 0.1 ratio diff => returns replicas unchanged
      expect(calculateDesiredReplicas(2, 50, {})).toBe(2);
      // ratio = 100 / 50 = 2 => scales up to 2, min/max fallback to 1 and 10
      expect(calculateDesiredReplicas(1, 100, {})).toBe(2);
      // negative targetCPU returns current replicas unchanged
      expect(calculateDesiredReplicas(3, 100, { targetCPU: -10 })).toBe(3);
    });

    it('returns the lower replica count directly without any randomness', () => {
      const config = { minReplicas: 1, maxReplicas: 8, targetCPU: 50 };
      // ratio = 10 / 50 = 0.2 -> ceil(4 * 0.2) = 1
      expect(calculateDesiredReplicas(4, 10, config)).toBe(1);
      expect(calculateDesiredReplicas(4, 10, config)).toBe(1);
    });

    it('ignores memory when targetMemory is not configured', () => {
      const config = { minReplicas: 1, maxReplicas: 10, targetCPU: 50 };
      expect(calculateDesiredReplicas(4, 10, config, 100)).toBe(1);
    });

    it('ignores memory when memoryPercent is not supplied', () => {
      const config = { minReplicas: 1, maxReplicas: 10, targetCPU: 50, targetMemory: 50 };
      expect(calculateDesiredReplicas(4, 10, config)).toBe(1);
    });

    it('takes the larger CPU and memory recommendation', () => {
      const config = { minReplicas: 1, maxReplicas: 10, targetCPU: 80, targetMemory: 50 };
      // CPU 40/80 = 0.5 -> 2; memory 45/50 = 0.9 is inside the 10% deadband -> 4
      expect(calculateDesiredReplicas(4, 40, config, 45)).toBe(4);
      // CPU 60/80 = 0.75 -> 3; memory 90/50 = 1.8 -> 8
      expect(calculateDesiredReplicas(4, 60, config, 90)).toBe(8);
    });

    it('does not scale down unless every configured metric agrees', () => {
      const config = { minReplicas: 1, maxReplicas: 10, targetCPU: 50, targetMemory: 50 };
      expect(calculateDesiredReplicas(4, 10, config, 50)).toBe(4);
      expect(calculateDesiredReplicas(4, 10, config, 20)).toBe(2);
    });

    it('clamps the memory recommendation to min and max replicas', () => {
      const config = { minReplicas: 2, maxReplicas: 5, targetCPU: 50, targetMemory: 50 };
      expect(calculateDesiredReplicas(3, 10, config, 200)).toBe(5);
      expect(calculateDesiredReplicas(3, 10, config, 10)).toBe(2);
    });
  });

  describe('HPA scale-down stabilization', () => {
    const makeScalingCtx = (dep: Node) => ({
      updatedNodes: [{ ...dep, data: { ...dep.data } }],
      nodeIndexMap: new Map([[dep.id, 0]]),
      get: () => ({ addActivityLog: vi.fn() }) as any,
    } as any);

    it('waits for consecutive low-CPU ticks before removing replicas', () => {
      const initial: Node = {
        id: 'dep-stabilize',
        position: { x: 0, y: 0 },
        data: {
          replicas: 4,
          hpas: [{ minReplicas: 1, maxReplicas: 8, targetCPU: 50 }],
        },
      };
      const ctx = makeScalingCtx(initial);
      let current = initial;

      for (let tick = 1; tick < HPA_SCALE_DOWN_STABILIZATION_TICKS; tick++) {
        handleHpaScaling(current, 10, ctx);
        const updated = ctx.updatedNodes[0].data;
        expect(updated.replicas).toBe(4);
        expect(updated.lowCpuTicks).toBe(tick);
        current = ctx.updatedNodes[0];
      }

      handleHpaScaling(current, 10, ctx);
      expect(ctx.updatedNodes[0].data.lowCpuTicks).toBe(HPA_SCALE_DOWN_STABILIZATION_TICKS);
      expect(ctx.updatedNodes[0].data.replicas).toBe(1);
    });

    it('resets the counter as soon as CPU returns to the target range', () => {
      const initial: Node = {
        id: 'dep-reset',
        position: { x: 0, y: 0 },
        data: {
          replicas: 4,
          lowCpuTicks: 3,
          hpas: [{ minReplicas: 1, maxReplicas: 8, targetCPU: 50 }],
        },
      };
      const ctx = makeScalingCtx(initial);

      handleHpaScaling(initial, 50, ctx);

      expect(ctx.updatedNodes[0].data.lowCpuTicks).toBe(0);
      expect(ctx.updatedNodes[0].data.replicas).toBe(4);
    });

    it('does not delay scale-up', () => {
      const initial: Node = {
        id: 'dep-up',
        position: { x: 0, y: 0 },
        data: {
          replicas: 2,
          hpas: [{ minReplicas: 1, maxReplicas: 8, targetCPU: 50 }],
        },
      };
      const ctx = makeScalingCtx(initial);

      handleHpaScaling(initial, 100, ctx);

      expect(ctx.updatedNodes[0].data.replicas).toBe(4);
      expect(ctx.updatedNodes[0].data.lowCpuTicks ?? 0).toBe(0);
    });
  });
});
