import { describe, it, expect, vi } from 'vitest';
import { calculateReachability, safeRandom } from './simulation';
import { Node, Edge } from '@xyflow/react';

describe('simulation utils', () => {
  it('safeRandom returns a number between 0 and 1', () => {
    const val = safeRandom();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(1);
  });

  it('calculateReachability identifies reachable nodes', () => {
    const nodes: Node[] = [
      { id: '1', data: {}, position: { x: 0, y: 0 } },
      { id: '2', data: {}, position: { x: 0, y: 0 } },
      { id: '3', data: {}, position: { x: 0, y: 0 } },
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
      { id: '1', data: {}, position: { x: 0, y: 0 } },
      { id: '2', data: {}, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2' },
    ];
    const activeEdges: string[] = [];

    const reachable = calculateReachability([nodes[0]], edges, activeEdges);
    expect(reachable.has('1')).toBe(true);
    expect(reachable.has('2')).toBe(false);
  });
});
