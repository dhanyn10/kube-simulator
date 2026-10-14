import { describe, it, expect } from 'vitest';
import { checkShowHPAWarning } from '@/activities/nodes/deploymentNodeHelpers';

describe('deploymentNodeHelpers', () => {
  it('returns false when deployment already has both CPU and Memory requests configured', () => {
    const data = {
      cpuRequest: '250m',
      memoryRequest: '256Mi',
      hpas: [{ minReplicas: 1, maxReplicas: 5 }],
    };
    expect(checkShowHPAWarning('dep-1', data as any, [], [])).toBe(false);
  });

  it('returns true when CPU or Memory requests are missing and attached HPA exists', () => {
    const dataNoCpu = {
      memoryRequest: '256Mi',
      hpas: [{ minReplicas: 1, maxReplicas: 5 }],
    };
    expect(checkShowHPAWarning('dep-1', dataNoCpu as any, [], [])).toBe(true);

    const dataNoMem = {
      cpuRequest: '250m',
      hpas: [{ minReplicas: 1, maxReplicas: 5 }],
    };
    expect(checkShowHPAWarning('dep-1', dataNoMem as any, [], [])).toBe(true);
  });

  it('returns true when requests are missing and connected edge HPA exists on canvas', () => {
    const data = {
      label: 'my-deployment',
    };
    const edges = [
      { id: 'e1', source: 'hpa-1', target: 'dep-1' },
    ];
    const nodes = [
      { id: 'hpa-1', type: 'HPA', data: {} },
      { id: 'dep-1', type: 'Deployment', data },
    ];

    expect(checkShowHPAWarning('dep-1', data as any, edges, nodes)).toBe(true);
  });

  it('returns false when requests are missing but no attached or connected HPA exists', () => {
    const data = {
      label: 'my-deployment',
    };
    const edges = [
      { id: 'e1', source: 'svc-1', target: 'dep-1' },
    ];
    const nodes = [
      { id: 'svc-1', type: 'Service', data: {} },
      { id: 'dep-1', type: 'Deployment', data },
    ];

    expect(checkShowHPAWarning('dep-1', data as any, edges, nodes)).toBe(false);
  });
});
