import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResourceBudgetControls } from '@/components/Config/ResourceBudgetControls';
import '@testing-library/jest-dom';

describe('ResourceBudgetControls', () => {
  it('renders correctly with dark theme and default fallback labels/values', () => {
    const onCpuChange = vi.fn();
    const onMemoryChange = vi.fn();

    render(
      <ResourceBudgetControls
        cpuValue=""
        memoryValue=""
        onCpuChange={onCpuChange}
        onMemoryChange={onMemoryChange}
        colorMode="dark"
      />
    );

    expect(screen.getByText('CPU Allocation / Limit')).toBeInTheDocument();
    expect(screen.getByText('Memory Allocation / Limit')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue('500m');
    expect(inputs[1]).toHaveValue('256Mi');
  });

  it('renders correctly with light theme and custom labels/values', () => {
    const onCpuChange = vi.fn();
    const onMemoryChange = vi.fn();

    render(
      <ResourceBudgetControls
        cpuValue="1000m"
        memoryValue="512Mi"
        onCpuChange={onCpuChange}
        onMemoryChange={onMemoryChange}
        colorMode="light"
        cpuLabel="Custom CPU"
        memoryLabel="Custom Memory"
      />
    );

    expect(screen.getByText('Custom CPU')).toBeInTheDocument();
    expect(screen.getByText('Custom Memory')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveValue('1000m');
    expect(inputs[1]).toHaveValue('512Mi');
  });

  it('triggers change handlers on user input', () => {
    const onCpuChange = vi.fn();
    const onMemoryChange = vi.fn();

    render(
      <ResourceBudgetControls
        cpuValue="500m"
        memoryValue="256Mi"
        onCpuChange={onCpuChange}
        onMemoryChange={onMemoryChange}
        colorMode="dark"
      />
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    expect(onCpuChange).toHaveBeenCalledWith('2');

    fireEvent.change(inputs[1], { target: { value: '1Gi' } });
    expect(onMemoryChange).toHaveBeenCalledWith('1Gi');
  });
});
