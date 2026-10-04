import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders resource settings and separators correctly', () => {
    const { container } = render(
      <ResourceSettingsList
        data={defaultData}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );

    expect(screen.getByText('CPU Request')).toBeDefined();
    expect(screen.getByText('CPU Limit')).toBeDefined();
    expect(screen.getByText('Memory Request')).toBeDefined();
    expect(screen.getByText('Memory Limit')).toBeDefined();

    // Renders separator line between CPU and Memory
    const separator = container.querySelector('.bg-slate-700\\/30');
    expect(separator).not.toBeNull();
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

  it('auto-clamps CPU Request when selecting CPU Limit lower than current CPU Request', () => {
    render(
      <ResourceSettingsList
        data={{ cpuRequest: '1000m', cpuLimit: '2000m' }}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );

    // Click 500m for CPU Limit
    const limit500mBtn = screen.getAllByText('500m')[0];
    fireEvent.click(limit500mBtn);

    expect(mockPerformUpdate).toHaveBeenCalledWith({ cpuLimit: '500m', cpuRequest: '500m' });
  });

  it('auto-clamps Memory Request when selecting Memory Limit lower than current Memory Request', () => {
    render(
      <ResourceSettingsList
        data={{ memoryRequest: '512Mi', memoryLimit: '1024Mi' }}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );

    // Click 256 Mi for Memory Limit (first 256 Mi element)
    const limit256MiBtn = screen.getAllByText('256 Mi')[0];
    fireEvent.click(limit256MiBtn);

    expect(mockPerformUpdate).toHaveBeenCalledWith({ memoryLimit: '256Mi', memoryRequest: '256Mi' });
  });

  it('disables CPU Request and Memory Request options higher than current Limit', () => {
    render(
      <ResourceSettingsList
        data={{ cpuLimit: '250m', cpuRequest: '100m', memoryLimit: '256Mi', memoryRequest: '128Mi' }}
        colorMode="dark"
        performUpdate={mockPerformUpdate}
      />
    );

    const request2CoresBtn = screen.getAllByText('2 Cores')[1].closest('button');
    expect(request2CoresBtn).toHaveProperty('disabled', true);

    const request1GiBtn = screen.getAllByText('1 Gi')[1].closest('button');
    expect(request1GiBtn).toHaveProperty('disabled', true);
  });
});
