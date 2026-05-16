import { describe, it, expect } from 'vitest';
import { validateHpaTargets } from '@/store/slices/simulationManager';
import { Node, Edge } from '@xyflow/react';

describe('simulationManager', () => {
  it('validateHpaTargets returns true if no HPA nodes', () => {
    const nodes: Node[] = [{ id: '1', type: 'Deployment', data: {}, position: { x: 0, y: 0 } } as Node];
    const edges: Edge[] = [];
    expect(validateHpaTargets(nodes, edges)).toBe(true);
  });

  it('validateHpaTargets returns false if HPA target lacks resource limits', () => {
    const nodes: Node[] = [
      { id: 'hpa-1', type: 'HPA', data: {}, position: { x: 0, y: 0 } } as Node,
      { id: 'dep-1', type: 'Deployment', data: { cpuLimit: '500m' }, position: { x: 0, y: 0 } } as Node, // missing memoryLimit
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'hpa-1', target: 'dep-1' }];
    expect(validateHpaTargets(nodes, edges)).toBe(false);
  });
});
