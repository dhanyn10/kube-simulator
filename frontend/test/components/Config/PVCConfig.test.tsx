import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PVCConfig } from '@/components/Config/PVCConfig';
import { useFlowStore } from '@/store';

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
    useFlowStore.setState({ colorMode: 'dark', nodes: [], edges: [] });
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

    expect(screen.getByText('Storage Capacity')).toBeDefined();
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

  it('handles access mode selection and light mode styling', () => {
    useFlowStore.setState({ colorMode: 'light' });

    render(
      <PVCConfig
        selectedNode={{
          id: 'pvc1',
          type: 'PVC',
          data: { label: 'My PVC', storageCapacity: '', accessMode: 'ReadOnlyMany' }
        }}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const roxBtn = screen.getByText('ROX');
    fireEvent.click(roxBtn);
    expect(performUpdate).toHaveBeenCalledWith({ accessMode: 'ReadOnlyMany' });

    const rwxBtn = screen.getByText('RWX');
    fireEvent.click(rwxBtn);
    expect(performUpdate).toHaveBeenCalledWith({ accessMode: 'ReadWriteMany' });
  });

  it('disables RWO and renders English warning message when connected workload has > 1 replicas', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'pvc1', type: 'PVC', data: {}, position: { x: 0, y: 0 } },
        { id: 'dep1', type: 'Deployment', data: { replicas: 3 }, position: { x: 0, y: 0 } }
      ] as any,
      edges: [
        { id: 'e1', source: 'dep1', target: 'pvc1' }
      ] as any
    });

    render(
      <PVCConfig
        selectedNode={selectedNode}
        performUpdate={performUpdate}
        toggleVisibility={toggleVisibility}
        toggleYaml={toggleYaml}
      />
    );

    const rwoBtn = screen.getByText('RWO').closest('button');
    expect(rwoBtn?.hasAttribute('disabled')).toBe(true);

    expect(screen.getByText('RWO Disabled:')).toBeDefined();
    expect(screen.getByText(/ReadWriteOnce allows maximum 1 replica, but connected workload currently has 3 replicas/)).toBeDefined();
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
