import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  getYamlButtonProps,
  useWorkloadAdvancedConfig,
} from '../../../src/activity/workload/useWorkloadAdvancedConfig';
import { useFlowStore } from '../../../src/store';

describe('useWorkloadAdvancedConfig & helpers', () => {
  it('getYamlButtonProps returns correct disabled vs enabled states', () => {
    const disabledProps = getYamlButtonProps(false, false);
    expect(disabledProps.className).toContain('cursor-not-allowed');

    const activeProps = getYamlButtonProps(true, true);
    expect(activeProps.className).toContain('text-emerald-500');

    const inactiveProps = getYamlButtonProps(true, false);
    expect(inactiveProps.className).toContain('text-slate-500');
  });

  it('useWorkloadAdvancedConfig computes node resource and HPA states correctly', () => {
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [
        { id: 'hpa-1', type: 'HPA' },
        { id: 'dep-1', type: 'Deployment' },
      ],
      edges: [{ id: 'e1', source: 'hpa-1', target: 'dep-1' }],
    });

    const selectedNode = {
      id: 'dep-1',
      data: {
        cpuRequest: '100m',
        memoryRequest: '128Mi',
        cpuLimit: '200m',
        memoryLimit: '256Mi',
        yamlSettings: { resources: true },
      },
    };

    const { result } = renderHook(() => useWorkloadAdvancedConfig(selectedNode));

    expect(result.current.colorMode).toBe('dark');
    expect(result.current.isTargetedByHPA).toBe(true);
    expect(result.current.hasRequests).toBe(true);
    expect(result.current.hasResources).toBe(true);
    expect(result.current.isYamlResources).toBe(true);
    expect(result.current.isCpuError).toBe(false);
    expect(result.current.isMemError).toBe(false);
  });
});
