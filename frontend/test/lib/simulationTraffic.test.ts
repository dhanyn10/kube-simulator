import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Node } from '@xyflow/react';
import {
  calculateIncomingTraffic,
  getInterpolatedProfileTraffic,
  updateInternetTraffic,
  calculateResourceMetrics,
  handleHpaScaling,
  calculateDesiredReplicas,
} from '@/lib/simulationTraffic';
import { SimulationContext } from '@/lib/simulationTypes';
import { K8sNodeData } from '@/types';

describe('simulationTraffic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('returns false when no traffic changes and node is red with 0 traffic', () => {
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
      expect(res.hasChanges).toBe(false);
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
      expect(ctx.newMetrics['dep-1']).toHaveLength(1);
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

      const ctx: SimulationContext = {
        updatedNodes: [dep],
        nodeIndexMap: new Map([['dep-hpa', 0]]),
        get: () => ({}) as any,
      } as any;

      // targetCPU defaults to 50. At cpuPercent = 90, scale up occurs
      const scaled = handleHpaScaling(dep, 90, ctx);
      expect(scaled).toBe(true);
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
  });

  describe('calculateDesiredReplicas', () => {
    it('falls back to default targetCPU (50), minReplicas (1), and maxReplicas (10) when missing', () => {
      // ratio = 50 / 50 = 1, within 0.1 ratio diff => returns replicas unchanged
      expect(calculateDesiredReplicas(2, 50, {})).toBe(2);
      // ratio = 100 / 50 = 2 => scales up to 2, min/max fallback to 1 and 10
      expect(calculateDesiredReplicas(1, 100, {})).toBe(2);
    });
  });
});
