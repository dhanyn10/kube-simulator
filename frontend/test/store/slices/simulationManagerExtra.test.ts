import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  pauseSimulation,
  stopSimulation,
  broadcastMetrics,
  checkEmergencyStop,
  validateHpaTargets,
} from '@/store/slices/simulationManager';
import { Node, Edge } from '@xyflow/react';

describe('simulationManager extra uncovered conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pauseSimulation and stopSimulation clear interval when interval ref is present', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const intervalRef = { current: setTimeout(() => {}, 1000) as any };
    const setFn = vi.fn();

    pauseSimulation(setFn, intervalRef);
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(intervalRef.current).toBeNull();
    expect(setFn).toHaveBeenCalledWith({ isSimulating: false });

    const intervalRef2 = { current: setTimeout(() => {}, 1000) as any };
    const getFn = vi.fn().mockReturnValue({ nodes: [] });
    stopSimulation(setFn, getFn as any, intervalRef2);
    expect(intervalRef2.current).toBeNull();
  });

  it('broadcastMetrics emits events via runtime when available', () => {
    const emitSpy = vi.fn();
    (globalThis as any).runtime = { EventsEmit: emitSpy };

    broadcastMetrics({}, []);
    expect(emitSpy).toHaveBeenCalledWith('metrics-update', expect.any(String));

    delete (globalThis as any).runtime;
  });

  it('checkEmergencyStop stops interval and returns false when ready pods exist', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const intervalRef = { current: setTimeout(() => {}, 1000) as any };
    const setFn = vi.fn();

    const workloads: Node[] = [{ id: 'w1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'w1' } }];
    const nodes: Node[] = [
      { id: 'p1', type: 'Pod', parentId: 'w1', position: { x: 0, y: 0 }, data: { status: 'ready' } },
    ];
    const metrics = { w1: [{ cpuValue: 10, cpuPercent: 5, memoryValue: 20, memoryPercent: 10, reqsPerSec: 1 }] };

    const stopped = checkEmergencyStop({
      ticks: 5,
      workloads,
      nodes,
      metrics,
      set: setFn,
      simulationInterval: intervalRef,
    });

    expect(stopped).toBe(false);

    // Now test emergency stop trigger when readyPods is empty
    const pendingNodes: Node[] = [
      { id: 'p1', type: 'Pod', parentId: 'w1', position: { x: 0, y: 0 }, data: { status: 'pending' } },
    ];

    const emergencyStopped = checkEmergencyStop({
      ticks: 5,
      workloads,
      nodes: pendingNodes,
      metrics,
      set: setFn,
      simulationInterval: intervalRef,
    });

    expect(emergencyStopped).toBe(true);
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('validateHpaTargets validates connected HPA edges', () => {
    const nodes: Node[] = [
      { id: 'w1', type: 'Deployment', position: { x: 0, y: 0 }, data: { label: 'w1' } },
      { id: 'hpa1', type: 'HPA', position: { x: 0, y: 0 }, data: { label: 'hpa1' } },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'hpa1', target: 'w1' },
    ];

    // Missing limit -> returns false
    expect(validateHpaTargets(nodes, edges)).toBe(false);

    // Valid limits -> returns true
    nodes[0].data = { label: 'w1', cpuLimit: '250m', memoryLimit: '256Mi', cpuRequest: '100m', memoryRequest: '128Mi' };
    expect(validateHpaTargets(nodes, edges)).toBe(true);
  });
});
