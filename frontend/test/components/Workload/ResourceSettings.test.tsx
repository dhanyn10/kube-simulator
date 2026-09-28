import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceSettingsList } from '@/components/Workload/ResourceSettings';

describe('ResourceSettingsList', () => {
  const mockPerformUpdate = vi.fn();
  const defaultData = {
    cpuRequest: '100m',
    cpuLimit: '250m',
    memoryRequest: '128Mi',
    memoryLimit: '256Mi',
  };

  it('renders resource settings correctly', () => {
    render(
      <ResourceSettingsList
        data={defaultData}
        colorMode="dark"
        isCpuError={false}
        isMemError={false}
        performUpdate={mockPerformUpdate}
      />
    );

    expect(screen.getByText('CPU Request')).toBeDefined();
    expect(screen.getByText('CPU Limit')).toBeDefined();
    expect(screen.getByText('Memory Request')).toBeDefined();
    expect(screen.getByText('Memory Limit')).toBeDefined();
  });

  it('calls performUpdate when a resource option is selected', () => {
    render(
      <ResourceSettingsList
        data={defaultData}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );

    const option500m = screen.getAllByText('500m')[0];
    fireEvent.click(option500m);

    expect(mockPerformUpdate).toHaveBeenCalledWith({ cpuLimit: '500m' });
  });

  it('disables CPU Request options higher than current CPU Limit', () => {
    render(
      <ResourceSettingsList
        data={{ cpuLimit: '250m', cpuRequest: '100m' }}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );

    const request2CoresBtn = screen.getAllByText('2 Cores')[1].closest('button');
    expect(request2CoresBtn).toHaveProperty('disabled', true);
  });
});
