import { describe, it, expect, vi } from 'vitest';
import { validateHpaTargets } from '@/store/slices/simulationManager';
import { Node, Edge } from '@xyflow/react';

describe('simulationManager', () => {
  describe('validateHpaTargets', () => {
    it('returns true when no HPAs exist', () => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];
      expect(validateHpaTargets(nodes, edges)).toBe(true);
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
});
