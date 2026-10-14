import { describe, it, expect } from 'vitest';
import { checkShowHPAWarning } from '@/activities/nodes/deploymentNodeHelpers';

describe('deploymentNodeHelpers', () => {
  it('returns false when deployment already has both CPU and Memory requests configured', () => {
    const configuredDeploymentData = { cpuRequest: '250m', memoryRequest: '256Mi', hpas: [{ minReplicas: 1, maxReplicas: 5 }] };
    expect(checkShowHPAWarning('dep-1', configuredDeploymentData as any, [], [])).toBe(false);
  });

  it('returns true when CPU or Memory requests are missing and attached HPA exists', () => {
    const deploymentDataNoCpu = { memoryRequest: '256Mi', hpas: [{ minReplicas: 1, maxReplicas: 5 }] };
    expect(checkShowHPAWarning('dep-1', deploymentDataNoCpu as any, [], [])).toBe(true);

    const deploymentDataNoMem = { cpuRequest: '250m', hpas: [{ minReplicas: 1, maxReplicas: 5 }] };
    expect(checkShowHPAWarning('dep-1', deploymentDataNoMem as any, [], [])).toBe(true);
  });

  it('returns true when requests are missing and connected edge HPA exists on canvas', () => {
    const deploymentData = { label: 'my-deployment' };
    const connectedEdges = [{ id: 'e1', source: 'hpa-1', target: 'dep-1' }];
    const canvasNodes = [{ id: 'hpa-1', type: 'HPA', data: {} }, { id: 'dep-1', type: 'Deployment', data: deploymentData }];

    expect(checkShowHPAWarning('dep-1', deploymentData as any, connectedEdges, canvasNodes)).toBe(true);
  });

  it('returns false when requests are missing but no attached or connected HPA exists', () => {
    const deploymentData = { label: 'my-deployment' };
    const connectedEdges = [{ id: 'e1', source: 'svc-1', target: 'dep-1' }];
    const canvasNodes = [{ id: 'svc-1', type: 'Service', data: {} }, { id: 'dep-1', type: 'Deployment', data: deploymentData }];

    expect(checkShowHPAWarning('dep-1', deploymentData as any, connectedEdges, canvasNodes)).toBe(false);
  });
});
