import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scheduleRecovery, handleOomCrashes } from '@/lib/simulationRecovery';
import { SimulationContext } from '@/lib/simulationTypes';
import { Node } from '@xyflow/react';
import * as utils from '@/lib/utils';
import { logger } from '@/lib/logger';

describe('simulationRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('scheduleRecovery', () => {
    it('handles restartPolicy: Never and logs warning/error with label or podId', () => {
      const addLog = vi.fn();
      const ctx: SimulationContext = {
        get: () => ({
          nodes: [
            {
              id: 'pod-never',
              type: 'Pod',
              position: { x: 0, y: 0 },
              data: { restartPolicy: 'Never', label: 'Never-Pod' },
            },
            {
              id: 'pod-never-no-label',
              type: 'Pod',
              position: { x: 0, y: 0 },
              data: { restartPolicy: 'Never' },
            },
          ],
          addLog,
        } as any),
        childPodMap: new Map(),
      };

      const dep = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as Node;

      scheduleRecovery(dep, 'pod-never', ctx);
      expect(addLog).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Pod "Never-Pod" crashed! Automatic restart disabled'),
        'Simulation'
      );

      // Label fallback to podId
      scheduleRecovery(dep, 'pod-never-no-label', ctx);
      expect(addLog).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Pod "pod-never-no-label" crashed! Automatic restart disabled'),
        'Simulation'
      );
    });

    it('catches and logs error when addLog throws in scheduleRecovery', () => {
      const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const ctx: SimulationContext = {
        get: () => ({
          nodes: [
            {
              id: 'pod-err',
              type: 'Pod',
              position: { x: 0, y: 0 },
              data: { restartPolicy: 'Never' },
            },
          ],
          addLog: () => {
            throw new Error('Log error');
          },
        } as any),
        childPodMap: new Map(),
      };

      const dep = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as Node;
      scheduleRecovery(dep, 'pod-err', ctx);
      expect(loggerErrorSpy).toHaveBeenCalledWith('[Simulation Recovery] Failed to add log', expect.any(Error));

      // Test addLog throw for non-Never policy
      const ctx2: SimulationContext = {
        get: () => ({
          nodes: [
            {
              id: 'pod-err2',
              type: 'Pod',
              position: { x: 0, y: 0 },
              data: { restartPolicy: 'Always' },
            },
          ],
          addLog: () => {
            throw new Error('Log error 2');
          },
        } as any),
        childPodMap: new Map(),
      };
      scheduleRecovery(dep, 'pod-err2', ctx2);
      expect(loggerErrorSpy).toHaveBeenCalledWith('[Simulation Recovery] Failed to add log', expect.any(Error));
    });

    it('recovers crashing pod after delay based on simulationSpeed and sets status ready when image exists', () => {
      const addLog = vi.fn();
      const updateNodeData = vi.fn();
      const nodeData = { status: 'crashing', image: 'nginx:latest', label: 'web-pod' };
      const ctx: SimulationContext = {
        get: () => ({
          nodes: [
            { id: 'pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: nodeData },
          ],
          simulationSpeed: 2,
          addLog,
          updateNodeData,
        } as any),
        childPodMap: new Map(),
      };

      const dep = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as Node;
      scheduleRecovery(dep, 'pod-1', ctx);

      expect(addLog).toHaveBeenCalledWith(
        'warning',
        expect.stringContaining('Restarting container (restartPolicy: Always)'),
        'Simulation'
      );

      // Fast-forward timer: 3000 / 2 = 1500ms
      vi.advanceTimersByTime(1500);

      expect(updateNodeData).toHaveBeenCalledWith('pod-1', {
        status: 'ready',
        simulatedFailureCM: undefined,
      });
      expect(addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('Pod "web-pod" container restarted successfully. Status: ready.'),
        'Simulation'
      );
    });

    it('recovers crashing pod to pending when image is missing and falls back to podId if label is missing', () => {
      const addLog = vi.fn();
      const updateNodeData = vi.fn();
      const nodeData = { status: 'crashing' }; // no image, no label
      const ctx: SimulationContext = {
        get: () => ({
          nodes: [
            { id: 'pod-no-img', type: 'Pod', position: { x: 0, y: 0 }, data: nodeData },
          ],
          addLog,
          updateNodeData,
        } as any),
        childPodMap: new Map(),
      };

      const dep = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as Node;
      scheduleRecovery(dep, 'pod-no-img', ctx);

      vi.advanceTimersByTime(3000);

      expect(updateNodeData).toHaveBeenCalledWith('pod-no-img', {
        status: 'pending',
        simulatedFailureCM: undefined,
      });
      expect(addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('Pod "pod-no-img" container restarted successfully. Status: pending.'),
        'Simulation'
      );
    });

    it('aborts recovery inside timeout if pod is no longer crashing or node was deleted', () => {
      const updateNodeData = vi.fn();
      let status = 'crashing';
      const ctx: SimulationContext = {
        get: () => ({
          nodes: [
            { id: 'pod-recovered-early', type: 'Pod', position: { x: 0, y: 0 }, data: { status } },
          ],
          updateNodeData,
        } as any),
        childPodMap: new Map(),
      };

      const dep = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as Node;
      scheduleRecovery(dep, 'pod-recovered-early', ctx);

      // Pod status transitions to ready before timer expires
      status = 'ready';
      vi.advanceTimersByTime(3000);

      expect(updateNodeData).not.toHaveBeenCalled();
    });

    it('catches and logs error if addLog throws inside timeout', () => {
      const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const ctx: SimulationContext = {
        get: () => ({
          nodes: [
            { id: 'pod-timeout-err', type: 'Pod', position: { x: 0, y: 0 }, data: { status: 'crashing' } },
          ],
          addLog: (level: string) => {
            if (level === 'info') throw new Error('Timeout log error');
          },
          updateNodeData: vi.fn(),
        } as any),
        childPodMap: new Map(),
      };

      const dep = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as Node;
      scheduleRecovery(dep, 'pod-timeout-err', ctx);
      vi.advanceTimersByTime(3000);

      expect(loggerErrorSpy).toHaveBeenCalledWith('[Simulation Recovery] Failed to add log', expect.any(Error));
    });
  });

  describe('handleOomCrashes', () => {
    it('returns false when isOOM is false or safeRandom <= 0.5', () => {
      const ctx: SimulationContext = {
        get: () => ({ nodes: [] } as any),
        childPodMap: new Map(),
      };
      const dep = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as Node;

      expect(handleOomCrashes(dep, false, ctx)).toBe(false);

      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.4);
      expect(handleOomCrashes(dep, true, ctx)).toBe(false);
    });

    it('returns false when childPods is empty', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.8);
      const ctx: SimulationContext = {
        get: () => ({ nodes: [] } as any),
        childPodMap: new Map(), // empty
      };
      const dep = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as Node;

      expect(handleOomCrashes(dep, true, ctx)).toBe(false);
    });

    it('handles Pod resource node directly as childPod', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.8);
      const podNode = {
        id: 'standalone-pod',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: { status: 'ready' },
      } as Node;

      const ctx: SimulationContext = {
        get: () => ({
          nodes: [podNode],
          addLog: vi.fn(),
        } as any),
        updatedNodes: [{ ...podNode }],
        nodeIndexMap: new Map(),
        childPodMap: new Map(),
      };

      const result = handleOomCrashes(podNode, true, ctx);
      expect(result).toBe(true);
      expect(ctx.updatedNodes[0].data.status).toBe('crashing');
    });

    it('returns false if chosen pod is already crashing', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.8);
      const crashingPod = {
        id: 'crashing-pod',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: { status: 'crashing' },
      } as Node;

      const ctx: SimulationContext = {
        get: () => ({ nodes: [crashingPod] } as any),
        updatedNodes: [{ ...crashingPod }],
        nodeIndexMap: new Map(),
        childPodMap: new Map([['dep-1', [crashingPod]]]),
      };
      const dep = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as Node;

      expect(handleOomCrashes(dep, true, ctx)).toBe(false);
    });

    it('crashes pod and schedules recovery when updateNodeData succeeds, or does not schedule if changed is false', () => {
      vi.spyOn(utils, 'safeRandom').mockReturnValue(0.8);
      const healthyPod = {
        id: 'healthy-pod',
        type: 'Pod',
        position: { x: 0, y: 0 },
        data: { status: 'ready' },
      } as Node;

      // 1. updateNodeData returns false (e.g. node not present in updatedNodes)
      const ctxNoUpdate: SimulationContext = {
        get: () => ({
          nodes: [healthyPod],
        } as any),
        updatedNodes: [], // empty -> node not found -> returns false
        nodeIndexMap: new Map(),
        childPodMap: new Map([['dep-1', [healthyPod]]]),
      };
      const dep = { id: 'dep-1', type: 'Deployment', position: { x: 0, y: 0 }, data: {} } as Node;
      expect(handleOomCrashes(dep, true, ctxNoUpdate)).toBe(false);

      // 2. updateNodeData returns true
      const ctxSuccess: SimulationContext = {
        get: () => ({
          nodes: [healthyPod],
          addLog: vi.fn(),
        } as any),
        updatedNodes: [{ ...healthyPod }],
        nodeIndexMap: new Map(),
        childPodMap: new Map([['dep-1', [healthyPod]]]),
      };
      expect(handleOomCrashes(dep, true, ctxSuccess)).toBe(true);
      expect(ctxSuccess.updatedNodes[0].data.status).toBe('crashing');
    });
  });
});
