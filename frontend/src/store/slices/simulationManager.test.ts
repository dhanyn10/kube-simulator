import { describe, it, expect } from 'vitest';
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

  it('validateHpaTargets returns false if HPA target limit < request', () => {
    const nodes: Node[] = [
      { id: 'hpa-1', type: 'HPA', data: {}, position: { x: 0, y: 0 } },
      { id: 'dep-1', type: 'Deployment', data: {
        cpuRequest: '500m',
        cpuLimit: '250m',
        memoryRequest: '512Mi',
        memoryLimit: '1Gi'
      }, position: { x: 0, y: 0 } },
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'hpa-1', target: 'dep-1' }];
    expect(validateHpaTargets(nodes, edges)).toBe(false);

    const nodes2: Node[] = [
        { id: 'hpa-1', type: 'HPA', data: {}, position: { x: 0, y: 0 } },
        { id: 'dep-1', type: 'Deployment', data: {
          cpuRequest: '500m',
          cpuLimit: '1',
          memoryRequest: '1Gi',
          memoryLimit: '512Mi'
        }, position: { x: 0, y: 0 } },
      ];
      expect(validateHpaTargets(nodes2, edges)).toBe(false);
  });
});
