import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PVCConfig } from '../../../src/components/Config/PVCConfig';
import { useFlowStore } from '../../../src/store';

describe('PVCConfig', () => {
  const performUpdate = vi.fn();
  const toggleVisibility = vi.fn();
  const toggleYaml = vi.fn();

  const selectedNode = {
    id: 'pvc1',
    type: 'PVC',
    data: {
      label: 'My PVC',
      storageCapacity: '5Gi',
      accessMode: 'ReadWriteOnce',
      storageClass: 'standard',
      displaySettings: { storageClass: true },
      yamlSettings: { storageClass: true }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('renders correctly', () => {
    render(
      <PVCConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    expect(screen.getByText('Kapasitas (Storage)')).toBeDefined();
    expect(screen.getByDisplayValue('5Gi')).toBeDefined();
    expect(screen.getByText('RWO')).toBeDefined();
  });

  it('handles storage capacity updates', () => {
    render(
      <PVCConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const input = screen.getByDisplayValue('5Gi');
    fireEvent.change(input, { target: { value: '10Gi' } });
    expect(performUpdate).toHaveBeenCalledWith({ storageCapacity: '10Gi' });

    const sizeBtn = screen.getByText('1Gi');
    fireEvent.click(sizeBtn);
    expect(performUpdate).toHaveBeenCalledWith({ storageCapacity: '1Gi' });
  });

  it('handles access mode selection', () => {
    render(
      <PVCConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const roxBtn = screen.getByText('ROX');
    fireEvent.click(roxBtn);
    expect(performUpdate).toHaveBeenCalledWith({ accessMode: 'ReadOnlyMany' });
  });

  it('handles storage class updates', () => {
    render(
      <PVCConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    fireEvent.click(screen.getByText('Advanced Options'));
    const select = screen.getByDisplayValue('Standard (HDD)');
    fireEvent.change(select, { target: { value: 'ssd' } });
    expect(performUpdate).toHaveBeenCalledWith({ storageClass: 'ssd' });
  });
});
