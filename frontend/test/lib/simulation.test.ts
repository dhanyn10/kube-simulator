import { describe, it, expect, vi } from 'vitest';
import {
  calculateReachability,
  updateInternetTraffic,
  SimulationContext,
  calculateResourceMetrics
} from '@/lib/simulation';
import { safeRandom } from '@/lib/utils';
import { Node, Edge } from '@xyflow/react';

describe('simulation utils', () => {
  it('safeRandom returns a number between 0 and 1', () => {
    const val = safeRandom();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(1);
  });

  it('calculateReachability identifies reachable nodes', () => {
    const nodes: Node[] = [
      { id: '1', data: {}, position: { x: 0, y: 0 } } as Node,
      { id: '2', data: {}, position: { x: 0, y: 0 } } as Node,
      { id: '3', data: {}, position: { x: 0, y: 0 } } as Node,
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
    ];
    const activeEdges = ['e1-2', 'e2-3'];

    const reachable = calculateReachability([nodes[0]], edges, activeEdges);
    expect(reachable.has('1')).toBe(true);
    expect(reachable.has('2')).toBe(true);
    expect(reachable.has('3')).toBe(true);
  });

  it('calculateReachability respects active edges', () => {
     const nodes: Node[] = [
      { id: '1', data: {}, position: { x: 0, y: 0 } } as Node,
      { id: '2', data: {}, position: { x: 0, y: 0 } } as Node,
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2' },
    ];
    const activeEdges: string[] = [];

    const reachable = calculateReachability([nodes[0]], edges, activeEdges);
    expect(reachable.has('1')).toBe(true);
    expect(reachable.has('2')).toBe(false);
  });

  describe('updateInternetTraffic', () => {
    const mockCtx = (updatedNodes: Node[] = []): SimulationContext => ({
      nodes: [],
      edges: [],
      activeSimulationEdges: [],
      updatedNodes,
      newMetrics: {},
      ticks: 0,
      get: vi.fn(),
      set: vi.fn()
    });

    it('handles missing traffic and currentTraffic', () => {
      const internetNode: Node = { id: 'i1', data: {}, position: { x: 0, y: 0 } } as Node;
      const updatedNodes: Node[] = [structuredClone(internetNode)];
      const ctx = mockCtx(updatedNodes);

      const result = updateInternetTraffic(internetNode, ctx);

      expect(result.traffic).toBe(1000); // target defaults to 1000, current defaults to 0, next is 0 + 1000
      expect(result.hasChanges).toBe(true);
      expect(ctx.updatedNodes[0].data.currentTraffic).toBe(1000);
    });

    it('maintains traffic when target reached', () => {
      const internetNode: Node = { id: 'i1', data: { traffic: 2000, currentTraffic: 2000 }, position: { x: 0, y: 0 } } as Node;
      const updatedNodes: Node[] = [structuredClone(internetNode)];
      const ctx = mockCtx(updatedNodes);

      const result = updateInternetTraffic(internetNode, ctx);

      expect(result.traffic).toBe(2000);
      expect(result.hasChanges).toBe(false);
    });
  });

  describe('calculateResourceMetrics', () => {
    const mockCtx = (): SimulationContext => ({
      nodes: [],
      edges: [],
      activeSimulationEdges: [],
      updatedNodes: [],
      newMetrics: {},
      ticks: 0,
      get: vi.fn(),
      set: vi.fn()
    });

    it('calculates metrics based on traffic', () => {
      const depNode: Node = {
        id: 'd1',
        type: 'Deployment',
        data: { replicas: 1, cpuLimit: '1000m', memoryLimit: '1024Mi' },
        position: { x: 0, y: 0 }
      } as Node;
      const ctx = mockCtx();

      const result = calculateResourceMetrics(depNode, 5000, ctx);

      expect(result.cpuPercent).toBeGreaterThan(0);
      expect(ctx.newMetrics['d1']).toHaveLength(1);
      expect(ctx.newMetrics['d1'][0].cpuLimit).toBe(1000);
    });

    it('detects OOM when memory limit exceeded', () => {
       const depNode: Node = {
        id: 'd1',
        type: 'Deployment',
        data: { replicas: 1, cpuLimit: '1000m', memoryLimit: '50Mi' }, // Very low limit
        position: { x: 0, y: 0 }
      } as Node;
      const ctx = mockCtx();

      // Traffic 10000 -> memValue ~ ((10000/1000)*128/1) + 100 = 1380 Mi
      const result = calculateResourceMetrics(depNode, 10000, ctx);
      expect(result.isOOM).toBe(true);
    });
  });
});
