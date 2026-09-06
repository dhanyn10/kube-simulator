import { describe, it, expect } from 'vitest';
import {
  mapProjectNodes,
  mapProjectEdges,
  generateTimestampedProjectName,
} from '../../../../src/components/UI/ResourceManager/resourceManagerHelpers';

describe('resourceManagerHelpers', () => {
  describe('mapProjectNodes', () => {
    it('maps valid nodes with and without parentId correctly', () => {
      const input = [
        { id: 101, type: 'Pod', parentId: 201, data: { label: 'pod-1' } },
        { id: 102, type: 'Service', data: { label: 'svc-1' } },
      ];
      const result = mapProjectNodes(input);
      expect(result).toEqual([
        { id: '101', type: 'Pod', parentId: '201', data: { label: 'pod-1' } },
        { id: '102', type: 'Service', parentId: undefined, data: { label: 'svc-1' } },
      ]);
    });

    it('handles falsy or empty nodes gracefully', () => {
      expect(mapProjectNodes(null as any)).toEqual([]);
      expect(mapProjectNodes(undefined as any)).toEqual([]);
      expect(mapProjectNodes([])).toEqual([]);
    });
  });

  describe('mapProjectEdges', () => {
    it('maps valid edges correctly', () => {
      const input = [
        { id: 50, source: 101, target: 102, label: 'connects' },
      ];
      const result = mapProjectEdges(input);
      expect(result).toEqual([
        { id: '50', source: '101', target: '102', label: 'connects', type: 'custom' },
      ]);
    });

    it('handles falsy or empty edges gracefully', () => {
      expect(mapProjectEdges(null as any)).toEqual([]);
      expect(mapProjectEdges(undefined as any)).toEqual([]);
      expect(mapProjectEdges([])).toEqual([]);
    });
  });

  describe('generateTimestampedProjectName', () => {
    it('generates a string starting with Project-', () => {
      const name = generateTimestampedProjectName();
      expect(name).toMatch(/^Project-\d{14}$/);
    });
  });
});
