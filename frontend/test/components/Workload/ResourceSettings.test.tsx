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
        isCpuError={false}
        isMemError={false}
        performUpdate={mockPerformUpdate}
      />
    );

    // Find a CPU request option that isn't already selected, e.g. 250m
    const option250m = screen.getAllByText('250m')[0];
    fireEvent.click(option250m);

    expect(mockPerformUpdate).toHaveBeenCalledWith({ cpuRequest: '250m' });
  });

  it('shows error warning when isCpuError is true', () => {
    render(
      <ResourceSettingsList
        data={defaultData}
        colorMode="dark"
        isCpuError={true}
        isMemError={false}
        performUpdate={mockPerformUpdate}
      />
    );

    expect(screen.getByText('Limit must be greater than or equal to Request')).toBeDefined();
  });

  it('shows error warning when isMemError is true', () => {
    render(
      <ResourceSettingsList
        data={defaultData}
        colorMode="dark"
        isCpuError={false}
        isMemError={true}
        performUpdate={mockPerformUpdate}
      />
    );

    expect(screen.getByText('Limit must be greater than or equal to Request')).toBeDefined();
  });
});
