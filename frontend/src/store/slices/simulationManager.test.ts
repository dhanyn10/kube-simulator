import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateHpaTargets } from './simulationManager';
import { Node, Edge } from '@xyflow/react';

describe('simulationManager', () => {
  it('validateHpaTargets returns true if no HPA nodes', () => {
    const nodes: Node[] = [{ id: '1', type: 'Deployment', data: {}, position: { x: 0, y: 0 } }];
    const edges: Edge[] = [];
    expect(validateHpaTargets(nodes, edges)).toBe(true);
  });

  it('validateHpaTargets returns false if HPA target lacks resource limits', () => {
    const nodes: Node[] = [
      { id: 'hpa-1', type: 'HPA', data: {}, position: { x: 0, y: 0 } },
      { id: 'dep-1', type: 'Deployment', data: { cpuLimit: '500m' }, position: { x: 0, y: 0 } }, // missing memoryLimit
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'hpa-1', target: 'dep-1' }];
    expect(validateHpaTargets(nodes, edges)).toBe(false);
  });

  it('validateHpaTargets returns true if HPA target has both resource limits', () => {
    const nodes: Node[] = [
      { id: 'hpa-1', type: 'HPA', data: {}, position: { x: 0, y: 0 } },
      { id: 'dep-1', type: 'Deployment', data: { cpuLimit: '500m', memoryLimit: '512Mi' }, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'hpa-1', target: 'dep-1' }];
    expect(validateHpaTargets(nodes, edges)).toBe(true);
  });
});
