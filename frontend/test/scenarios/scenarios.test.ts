import { describe, it, expect } from 'vitest';
import { scenarios } from '@/scenarios';

describe('Scenarios', () => {
  it('should have scenarios defined', () => {
    expect(scenarios.length).toBeGreaterThan(0);
  });

  it('should be sorted by level weight', () => {
    const levelWeight = {
      'Basic': 0,
      'Intermediate': 1,
      'Advanced': 2
    };

    for (let i = 0; i < scenarios.length - 1; i++) {
      const currentLevel = scenarios[i].level;
      const nextLevel = scenarios[i+1].level;
      expect(levelWeight[currentLevel]).toBeLessThanOrEqual(levelWeight[nextLevel]);
    }
  });

  it('should have required properties for each scenario', () => {
    scenarios.forEach(scenario => {
      expect(scenario.id).toBeDefined();
      expect(scenario.name).toBeDefined();
      expect(scenario.level).toBeDefined();
      expect(scenario.description).toBeDefined();
      expect(scenario.data).toBeDefined();
      expect(Array.isArray(scenario.data.nodes)).toBe(true);
      expect(Array.isArray(scenario.data.edges)).toBe(true);
    });
  });

  it('should not contain legacy runtime or webserver fields and should specify images on workloads', () => {
    scenarios.forEach(scenario => {
      scenario.data.nodes.forEach(node => {
        const nodeType = node.type || node.data?.type;
        const data = node.data || {};

        if (['Pod', 'Deployment', 'ReplicaSet'].includes(nodeType)) {
          expect(data.runtime).toBeUndefined();
          expect(data.webserver).toBeUndefined();
          expect(typeof data.image).toBe('string');
          expect(data.image.trim().length).toBeGreaterThan(0);
        }
      });
    });
  });
});
