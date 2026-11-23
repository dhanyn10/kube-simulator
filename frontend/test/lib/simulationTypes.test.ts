import { describe, it, expect, vi } from 'vitest';
import { updateNodeData, emitSimulationLog, SimulationContext } from '@/lib/simulationTypes';
import { logger } from '@/lib/logger';

describe('simulationTypes', () => {
  describe('updateNodeData', () => {
    it('updates node data using nodeIndexMap cache and syncs to nodeMap, internetNodes, and clusterGraph', () => {
      const mockClusterGraph = {
        updateNodeData: vi.fn(),
      } as any;

      const nodeIndexMap = new Map<string, number>([['pod-1', 0]]);
      const nodeMap = new Map<string, any>();
      const initialNode = { id: 'pod-1', data: { cpu: 10 } } as any;
      const internetNode = { id: 'pod-1', data: { cpu: 10 } } as any;

      const ctx: SimulationContext = {
        nodes: [initialNode],
        edges: [],
        activeSimulationEdges: [],
        updatedNodes: [initialNode],
        newMetrics: {},
        ticks: 1,
        nodeIndexMap,
        nodeMap,
        internetNodes: [internetNode],
        clusterGraph: mockClusterGraph,
      };

      const result = updateNodeData(ctx, 'pod-1', { cpu: 50, memory: 128 });

      expect(result).toBe(true);
      expect(ctx.updatedNodes[0].data).toEqual({ cpu: 50, memory: 128 });
      expect(nodeMap.get('pod-1')?.data).toEqual({ cpu: 50, memory: 128 });
      expect(ctx.internetNodes?.[0].data).toEqual({ cpu: 50, memory: 128 });
      expect(mockClusterGraph.updateNodeData).toHaveBeenCalledWith('pod-1', { cpu: 50, memory: 128 });
    });

    it('populates nodeIndexMap cache when index is not initially cached', () => {
      const nodeIndexMap = new Map<string, number>();
      const node1 = { id: 'pod-1', data: { cpu: 10 } } as any;
      const node2 = { id: 'pod-2', data: { cpu: 20 } } as any;

      const ctx: SimulationContext = {
        nodes: [node1, node2],
        edges: [],
        activeSimulationEdges: [],
        updatedNodes: [node1, node2],
        newMetrics: {},
        ticks: 1,
        nodeIndexMap,
      };

      const result = updateNodeData(ctx, 'pod-2', { cpu: 99 });

      expect(result).toBe(true);
      expect(nodeIndexMap.get('pod-2')).toBe(1);
      expect(ctx.updatedNodes[1].data.cpu).toBe(99);
    });

    it('returns false and does not cache when node id is not found in updatedNodes', () => {
      const nodeIndexMap = new Map<string, number>();
      const ctx: SimulationContext = {
        nodes: [],
        edges: [],
        activeSimulationEdges: [],
        updatedNodes: [],
        newMetrics: {},
        ticks: 1,
        nodeIndexMap,
      };

      const result = updateNodeData(ctx, 'nonexistent-id', { cpu: 10 });

      expect(result).toBe(false);
      expect(nodeIndexMap.has('nonexistent-id')).toBe(false);
    });

    it('handles context without nodeIndexMap, nodeMap, internetNodes, or clusterGraph', () => {
      const node = { id: 'pod-1', data: { status: 'pending' } } as any;
      const ctx: SimulationContext = {
        nodes: [node],
        edges: [],
        activeSimulationEdges: [],
        updatedNodes: [node],
        newMetrics: {},
        ticks: 1,
      };

      const result = updateNodeData(ctx, 'pod-1', { status: 'running' });

      expect(result).toBe(true);
      expect(ctx.updatedNodes[0].data.status).toBe('running');
    });

    it('handles internetNodes when the updated node is not part of internetNodes', () => {
      const node = { id: 'pod-1', data: { status: 'running' } } as any;
      const otherInternet = { id: 'internet-1', data: { status: 'ready' } } as any;
      const ctx: SimulationContext = {
        nodes: [node],
        edges: [],
        activeSimulationEdges: [],
        updatedNodes: [node],
        newMetrics: {},
        ticks: 1,
        internetNodes: [otherInternet],
      };

      const result = updateNodeData(ctx, 'pod-1', { status: 'completed' });

      expect(result).toBe(true);
      expect(ctx.internetNodes?.[0].data.status).toBe('ready');
    });
  });

  describe('emitSimulationLog', () => {
    it('appends log entry to ctx.logs when provided and uses default category', () => {
      const logs: any[] = [];
      const onLog = vi.fn();
      const ctx = { logs, onLog };

      emitSimulationLog(ctx, 'info', 'Simulation started');

      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual({
        level: 'info',
        message: 'Simulation started',
        category: 'Simulation',
        timestamp: expect.any(Number),
      });
      expect(onLog).toHaveBeenCalledWith('info', 'Simulation started', 'Simulation');
    });

    it('calls ctx.eventSink.addLog when onLog is not provided', () => {
      const eventSink = {
        addLog: vi.fn(),
      };
      const ctx = { eventSink };

      emitSimulationLog(ctx, 'warn', 'High traffic', 'Network');

      expect(eventSink.addLog).toHaveBeenCalledWith('warn', 'High traffic', 'Network');
    });

    it('falls back to ctx.get().addLog when neither onLog nor eventSink are provided', () => {
      const addLog = vi.fn();
      const ctx = {
        get: () => ({ addLog }),
      };

      emitSimulationLog(ctx, 'error', 'Pod failed', 'Workload');

      expect(addLog).toHaveBeenCalledWith('error', 'Pod failed', 'Workload');
    });

    it('handles ctx.get() returning null/empty object safely', () => {
      const ctx = {
        get: () => null,
      };

      expect(() => {
        emitSimulationLog(ctx, 'debug', 'Trace details');
      }).not.toThrow();
    });

    it('handles context without any log sinks safely without error', () => {
      const ctx = {};

      expect(() => {
        emitSimulationLog(ctx, 'info', 'No sink log');
      }).not.toThrow();
    });

    it('catches sink errors and logs to logger.error when logErrorScope is provided', () => {
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const error = new Error('Sink dispatch failed');
      const ctx = {
        onLog: () => {
          throw error;
        },
      };

      emitSimulationLog(ctx, 'error', 'Message', 'Traffic', 'SimulationLogger');

      expect(loggerSpy).toHaveBeenCalledWith('SimulationLogger', error);
      loggerSpy.mockRestore();
    });

    it('catches sink errors silently when logErrorScope is omitted', () => {
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const ctx = {
        onLog: () => {
          throw new Error('Sink dispatch failed');
        },
      };

      expect(() => {
        emitSimulationLog(ctx, 'error', 'Message', 'Traffic');
      }).not.toThrow();

      expect(loggerSpy).not.toHaveBeenCalled();
      loggerSpy.mockRestore();
    });
  });
});
