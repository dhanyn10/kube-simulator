import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  pauseSimulation,
  stopSimulation,
  resetSimulationNodes,
  hasMonitorError,
  broadcastMetrics,
  validateHpaTargets,
  getMetricsChannel,
  setMetricsChannel,
} from '@/store/slices/simulationManager';
import { Node, Edge } from '@xyflow/react';

describe('simulationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).runtime;
  });

  describe('validateHpaTargets', () => {
    it('returns true when no HPAs exist', () => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];
      expect(validateHpaTargets(nodes, edges)).toBe(true);
    });

    it('returns false if attached HPA target in data.hpas is missing resource limits', () => {
      const nodes: Node[] = [
        {
          id: 'dep1',
          type: 'Deployment',
          data: { label: 'web', hpas: [{ id: 'hpa1', name: 'app-hpa' }] },
          position: { x: 0, y: 0 }
        } as Node,
      ];
      const edges: Edge[] = [];

      expect(validateHpaTargets(nodes, edges)).toBe(false);
    });

    it('returns false if HPA target is missing resource limits', () => {
      const nodes: Node[] = [
        { id: 'hpa1', type: 'HPA', data: {}, position: { x: 0, y: 0 } } as Node,
        { id: 'dep1', type: 'Deployment', data: { label: 'web' }, position: { x: 0, y: 0 } } as Node,
      ];
      const edges: Edge[] = [
        { id: 'e1', source: 'hpa1', target: 'dep1' } as Edge,
      ];

      expect(validateHpaTargets(nodes, edges)).toBe(false);
    });

    it('returns true if HPA target has resource limits', () => {
      const nodes: Node[] = [
        { id: 'hpa1', type: 'HPA', data: {}, position: { x: 0, y: 0 } } as Node,
        { id: 'dep1', type: 'Deployment', data: { label: 'web', cpuLimit: '500m', memoryLimit: '512Mi' }, position: { x: 0, y: 0 } } as Node,
      ];
      const edges: Edge[] = [
        { id: 'e1', source: 'hpa1', target: 'dep1' } as Edge,
      ];

      expect(validateHpaTargets(nodes, edges)).toBe(true);
    });

    it('validates ReplicaSet targets as well as Deployments and StatefulSets', () => {
      const withLimits: Node[] = [
        { id: 'hpa1', type: 'HPA', data: {}, position: { x: 0, y: 0 } } as Node,
        {
          id: 'rs1',
          type: 'ReplicaSet',
          data: { label: 'web', cpuLimit: '500m', memoryLimit: '512Mi' },
          position: { x: 0, y: 0 },
        } as Node,
      ];
      const edge: Edge[] = [{ id: 'e1', source: 'hpa1', target: 'rs1' } as Edge];

      expect(validateHpaTargets(withLimits, edge)).toBe(true);

      const withoutLimits: Node[] = [
        { ...withLimits[0] },
        { ...withLimits[1], data: { label: 'web' } } as Node,
      ];
      expect(validateHpaTargets(withoutLimits, edge)).toBe(false);
    });

    it('returns false if limit < request', () => {
      const nodes: Node[] = [
        { id: 'hpa1', type: 'HPA', data: {}, position: { x: 0, y: 0 } } as Node,
        { id: 'dep1', type: 'Deployment', data: {
            label: 'web',
            cpuRequest: '500m', cpuLimit: '200m',
            memoryLimit: '512Mi'
          }, position: { x: 0, y: 0 } } as Node,
      ];
      const edges: Edge[] = [
        { id: 'e1', source: 'hpa1', target: 'dep1' } as Edge,
      ];

      expect(validateHpaTargets(nodes, edges)).toBe(false);
    });
  });

  describe('pauseSimulation', () => {
    it('pauses simulation and clears interval', () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      const intervalRef = { current: setTimeout(() => {}, 1000) as any };
      const setFn = vi.fn();

      pauseSimulation(setFn, intervalRef);
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(intervalRef.current).toBeNull();
      expect(setFn).toHaveBeenCalledWith({ isSimulating: false, isPaused: true });
    });
  });

  describe('stopSimulation', () => {
    it('resets simulation state when interval is active', () => {
      const set = vi.fn();
      const get = vi.fn().mockReturnValue({
        nodes: [
          { id: 'pvc1', type: 'PVC', data: { pvcStatus: 'Bound' } },
          { id: 'net1', type: 'Internet', data: { currentHourIndex: 5, profileTicks: 10 } }
        ]
      });
      const interval = { current: setInterval(() => {}, 1000) as any };

      stopSimulation(set, get, interval);

      expect(interval.current).toBeNull();
      expect(set).toHaveBeenCalledWith(expect.objectContaining({
        isSimulating: false,
        nodes: expect.arrayContaining([
          expect.objectContaining({ data: expect.objectContaining({ pvcStatus: 'Pending' }) }),
          expect.objectContaining({ data: expect.objectContaining({ currentHourIndex: 0, profileTicks: 0 }) })
        ])
      }));
    });

    it('handles stopSimulation when simulationInterval.current is already null', () => {
      const set = vi.fn();
      const get = vi.fn().mockReturnValue({ nodes: [] });
      const interval = { current: null };

      stopSimulation(set, get, interval);

      expect(set).toHaveBeenCalledWith(expect.objectContaining({ isSimulating: false }));
    });

    it('resets crashing pods back to initial status and clears simulated failure flags', () => {
      const set = vi.fn();
      const get = vi.fn().mockReturnValue({
        nodes: [
          {
            id: 'pod-1',
            type: 'Pod',
            data: {
              image: 'nginx:latest',
              status: 'crashing',
              simulatedFailureCM: 'chaos-cm',
              simulatedFailureSecret: 'missing-secret',
            },
          },
          {
            id: 'pod-2',
            type: 'Pod',
            data: {
              image: '',
              status: 'crashing',
            },
          },
        ],
      });
      const interval = { current: null };

      stopSimulation(set, get, interval);

      expect(set).toHaveBeenCalledWith(expect.objectContaining({
        isSimulating: false,
        isPaused: false,
        nodes: [
          expect.objectContaining({
            id: 'pod-1',
            data: expect.objectContaining({
              status: 'ready',
              simulatedFailureCM: undefined,
              simulatedFailureSecret: undefined,
            }),
          }),
          expect.objectContaining({
            id: 'pod-2',
            data: expect.objectContaining({
              status: 'pending',
            }),
          }),
        ],
      }));
    });

    it('resetSimulationNodes correctly handles Pods, PVCs, Internet, HPA counters, and pass-through nodes', () => {
      const nodes: any[] = [
        { id: 'p1', type: 'Pod', data: { image: 'alpine', status: 'crashing' } },
        { id: 'pvc1', type: 'PVC', data: { pvcStatus: 'Bound' } },
        { id: 'net1', type: 'Internet', data: { currentHourIndex: 3, currentMinuteIndex: 2, profileTicks: 99 } },
        { id: 'svc1', type: 'Service', data: { label: 'my-svc' } },
        { id: 'dep1', type: 'Deployment', data: { replicas: 3, lowCpuTicks: 4 } },
      ];
      const result = resetSimulationNodes(nodes);
      expect(result[0].data.status).toBe('ready');
      expect(result[1].data.pvcStatus).toBe('Pending');
      expect(result[2].data.profileTicks).toBe(0);
      expect(result[3].data.label).toBe('my-svc');
      expect(result[4].data.lowCpuTicks).toBe(0);
      expect(result[4].data.replicas).toBe(3);
    });
  });

  describe('hasMonitorError', () => {
    const healthyMetrics = {
      d1: [{ cpuValue: 10, cpuPercent: 5, memoryValue: 20, memoryPercent: 10, reqsPerSec: 1 }],
    };
    const readyNodes: Node[] = [
      { id: 'p1', type: 'Pod', parentId: 'd1', position: { x: 0, y: 0 }, data: { status: 'ready' } } as Node,
    ];

    it('returns false when metrics and pods are healthy', () => {
      expect(hasMonitorError({ metrics: healthyMetrics, nodes: readyNodes })).toBe(false);
      expect(hasMonitorError({ metrics: {}, nodes: [] })).toBe(false);
    });

    it('detects OOM immediately from the latest metric point', () => {
      const metrics = { d1: [{ ...healthyMetrics.d1[0], isOOM: true }] };
      expect(hasMonitorError({ metrics, nodes: readyNodes })).toBe(true);
    });

    it('detects CPU throttling immediately from the latest metric point', () => {
      const metrics = { d1: [{ ...healthyMetrics.d1[0], isThrottled: true }] };
      expect(hasMonitorError({ metrics, nodes: readyNodes })).toBe(true);
    });

    it('detects failed pods even when metrics are still healthy', () => {
      for (const status of ['crashing', 'CrashLoopBackOff', 'error']) {
        const nodes: Node[] = [{ id: 'p1', type: 'Pod', position: { x: 0, y: 0 }, data: { status } } as Node];
        expect(hasMonitorError({ metrics: healthyMetrics, nodes })).toBe(true);
      }
    });

    it('ignores an old error point when the latest point is healthy', () => {
      const metrics = {
        d1: [
          { ...healthyMetrics.d1[0], isOOM: true },
          { ...healthyMetrics.d1[0] },
        ],
      };
      expect(hasMonitorError({ metrics, nodes: readyNodes })).toBe(false);
    });

    it('ignores stale error metrics from workloads no longer on the canvas', () => {
      const metrics = {
        ...healthyMetrics,
        'old-dep': [{ ...healthyMetrics.d1[0], isOOM: true }],
      };
      expect(hasMonitorError({ metrics, nodes: readyNodes })).toBe(false);
    });
  });

  describe('broadcastMetrics', () => {
    it('calls runtime and channel', () => {
      (window as any).go = { main: { App: {} } } as any;
      const mockEmit = vi.fn();
      (window as any).runtime = { EventsEmit: mockEmit };

      broadcastMetrics({ 'd1': [] }, [{ id: 'd1', data: { label: 'web' }, position: { x: 0, y: 0 } } as unknown as Node]);
      expect(mockEmit).toHaveBeenCalledWith('metrics-update', expect.any(String));
    });

    it('handles broadcastMetrics when metricsChannel is null', () => {
      const originalChannel = getMetricsChannel();
      setMetricsChannel(null);
      try {
        expect(() => {
          broadcastMetrics({ 'd1': [] }, [{ id: 'd1', data: { label: 'web' }, position: { x: 0, y: 0 } } as unknown as Node]);
        }).not.toThrow();
      } finally {
        setMetricsChannel(originalChannel);
      }
    });

    it('calls channel postMessage when metricsChannel is present', () => {
      const channel = getMetricsChannel();
      const postMessageSpy = vi.spyOn(channel!, 'postMessage');

      broadcastMetrics({ 'd1': [] }, [{ id: 'd1', data: { label: 'web' }, position: { x: 0, y: 0 } } as unknown as Node]);
      expect(postMessageSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'METRICS_UPDATE' }));
    });

    it('handles workload without replicas property falling back to 1', () => {
      const mockEmit = vi.fn();
      (window as any).runtime = { EventsEmit: mockEmit };

      const workloadNoReplicas = { id: 'd-noreps', data: { label: 'noreps' }, position: { x: 0, y: 0 } } as unknown as Node;
      broadcastMetrics({ 'd-noreps': [] }, [workloadNoReplicas]);

      expect(mockEmit).toHaveBeenCalledWith(
        'metrics-update',
        expect.stringContaining('"replicas":1')
      );
    });
  });

  describe('uncovered fallback branches', () => {
    it('handles pauseSimulation and stopSimulation when interval ref is null', () => {
      const setFn = vi.fn();
      const intervalRef = { current: null };

      pauseSimulation(setFn, intervalRef);
      expect(setFn).toHaveBeenCalledWith({ isSimulating: false, isPaused: true });

      const getFn = vi.fn().mockReturnValue({ nodes: [{ id: 'other', type: 'Pod', data: {} }] });
      stopSimulation(setFn, getFn, intervalRef);
      expect(setFn).toHaveBeenCalledWith(expect.objectContaining({ isSimulating: false }));
    });

    it('validateHpaTargets returns false when cpuLimit is present but memoryLimit is missing', () => {
      const nodes: Node[] = [
        { id: 'hpa1', type: 'HPA', data: {}, position: { x: 0, y: 0 } } as Node,
        { id: 'dep1', type: 'Deployment', data: { label: 'web', cpuLimit: '500m' }, position: { x: 0, y: 0 } } as Node, // memoryLimit missing
      ];
      const edges: Edge[] = [
        { id: 'e1', source: 'hpa1', target: 'dep1' } as Edge,
      ];

      expect(validateHpaTargets(nodes, edges)).toBe(false);
    });

    it('covers all remaining branches in validateHpaTargets, hasMonitorError, and getMetricsChannel', () => {
      // 1. getMetricsChannel returns the channel instance or null
      expect(getMetricsChannel()).toBeDefined();

      // 2. validateHpaTargets: workload without any attached or connected HPA (hasAttachedHpa || hasConnectedHpa is false)
      const plainDeployment: Node = {
        id: 'dep-plain',
        type: 'Deployment',
        data: { label: 'plain-app' }, // no limits, no hpa -> should not fail
        position: { x: 0, y: 0 }
      };
      // Also include a child Pod with parentId to cover (n.type === 'Pod' && !n.parentId) false branch
      const childPod: Node = {
        id: 'pod-child',
        type: 'Pod',
        parentId: 'dep-plain',
        data: {},
        position: { x: 0, y: 0 }
      };
      // Workload with edge pointing from non-existent node (nodes.find(...)?.type evaluates to undefined)
      const edgeWithGhostSource: Edge = {
        id: 'e-ghost',
        source: 'non-existent-source-id',
        target: 'dep-plain'
      };
      expect(validateHpaTargets([plainDeployment, childPod], [edgeWithGhostSource])).toBe(true);

      // 3. validateHpaTargets: data.hpas is empty array (Array.isArray is true, data.hpas.length > 0 is false)
      const depEmptyHpas: Node = {
        id: 'dep-empty-hpas',
        type: 'Deployment',
        data: { label: 'empty-hpas', hpas: [] },
        position: { x: 0, y: 0 }
      };
      expect(validateHpaTargets([depEmptyHpas], [])).toBe(true);

      // 4. validateHpaTargets: standalone Pod with HPA connected and valid limits
      const hpaNode: Node = { id: 'hpa-node', type: 'HPA', data: {}, position: { x: 0, y: 0 } };
      const standalonePodWithLimits: Node = {
        id: 'pod-standalone-limits',
        type: 'Pod',
        parentId: undefined,
        data: { cpuLimit: '500m', memoryLimit: '512Mi' },
        position: { x: 0, y: 0 }
      };
      const hpaEdge: Edge = { id: 'e-hpa', source: 'hpa-node', target: 'pod-standalone-limits' };
      expect(validateHpaTargets([hpaNode, standalonePodWithLimits], [hpaEdge])).toBe(true);

      // 5. hasMonitorError: pending pods are not an error, crashed pods are
      const pendingNodes: Node[] = [
        { id: 'p-pending', type: 'Pod', parentId: 'dep-plain', position: { x: 0, y: 0 }, data: { status: 'pending' } },
      ];
      const crashedNodes: Node[] = [
        { id: 'p-crashed', type: 'Pod', parentId: 'dep-plain', position: { x: 0, y: 0 }, data: { status: 'crashing' } },
      ];
      expect(hasMonitorError({ metrics: {}, nodes: pendingNodes })).toBe(false);
      expect(hasMonitorError({ metrics: {}, nodes: crashedNodes })).toBe(true);
    });
  });
});
