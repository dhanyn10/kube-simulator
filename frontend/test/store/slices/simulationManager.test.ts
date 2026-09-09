import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateHpaTargets, stopSimulation, checkEmergencyStop, broadcastMetrics } from '@/store/slices/simulationManager';
import { Node, Edge } from '@xyflow/react';

describe('simulationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as any).runtime;
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

  describe('stopSimulation', () => {
    it('resets simulation state when interval is active', () => {
      const set = vi.fn();
      const get = vi.fn().mockReturnValue({
        nodes: [{ id: 'pvc1', type: 'PVC', data: { pvcStatus: 'Bound' } }]
      });
      const interval = { current: setInterval(() => {}, 1000) as any };

      stopSimulation(set, get, interval);

      expect(interval.current).toBeNull();
      expect(set).toHaveBeenCalledWith(expect.objectContaining({
        isSimulating: false,
        nodes: expect.arrayContaining([
          expect.objectContaining({ data: expect.objectContaining({ pvcStatus: 'Pending' }) })
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
  });

  describe('checkEmergencyStop', () => {
    it('returns false if ticks <= 3', () => {
      const result = checkEmergencyStop({
        ticks: 2,
        workloads: [],
        metrics: {}
      } as any);
      expect(result).toBe(false);
    });

    it('returns true and stops simulation if all pods pending with runtime EventsEmit', () => {
      const set = vi.fn();
      const mockEmit = vi.fn();
      (globalThis as any).runtime = { EventsEmit: mockEmit };

      const workloads = [{ id: 'd1', data: { label: 'web' }, position: { x: 0, y: 0 } } as unknown as Node];
      const nodes = [
        { id: 'p1', type: 'Pod', parentId: 'd1', data: { status: 'pending' }, position: { x: 0, y: 0 } } as unknown as Node
      ];
      const metrics = { 'd1': [{ cpuValue: 100 }] };
      const interval = { current: setInterval(() => {}, 1000) as any };

      const result = checkEmergencyStop({
        ticks: 5,
        workloads,
        nodes,
        metrics,
        set,
        simulationInterval: interval
      } as any);

      expect(result).toBe(true);
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ isSimulating: false }));
      expect(interval.current).toBeNull();
      expect(mockEmit).toHaveBeenCalledWith('detached-closed');
    });

    it('returns true and stops simulation when simulationInterval.current is null without runtime', () => {
      const set = vi.fn();
      const workloads = [{ id: 'd1', data: { label: 'web' }, position: { x: 0, y: 0 } } as unknown as Node];
      const nodes = [
        { id: 'p1', type: 'Pod', parentId: 'd1', data: { status: 'pending' }, position: { x: 0, y: 0 } } as unknown as Node
      ];
      const metrics = { 'd1': [{ cpuValue: 100 }] };
      const interval = { current: null };

      const result = checkEmergencyStop({
        ticks: 5,
        workloads,
        nodes,
        metrics,
        set,
        simulationInterval: interval
      } as any);

      expect(result).toBe(true);
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ isSimulating: false }));
    });
  });

  describe('broadcastMetrics', () => {
    it('calls runtime and channel', () => {
      globalThis.go = { main: { App: {} } } as any;
      const mockEmit = vi.fn();
      (globalThis as any).runtime = { EventsEmit: mockEmit };

      broadcastMetrics({ 'd1': [] }, [{ id: 'd1', data: { label: 'web' }, position: { x: 0, y: 0 } } as unknown as Node]);
      expect(mockEmit).toHaveBeenCalledWith('metrics-update', expect.any(String));
    });
  });
});
