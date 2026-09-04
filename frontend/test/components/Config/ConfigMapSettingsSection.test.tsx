import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ConfigMapSettingsSection } from '@/components/Config/ConfigMapSettingsSection';
import { useFlowStore } from '@/store';

describe('ConfigMapSettingsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      updateNodeData: vi.fn(),
      addLog: vi.fn(),
    });
  });

  it('returns null when configMaps array is empty or undefined', () => {
    const data = { label: 'my-node', configMaps: [] };
    const { container } = render(<ConfigMapSettingsSection data={data as any} nodeId="node-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders attached configmap badge with count > 1 in light mode and opens list modal', () => {
    useFlowStore.setState({ colorMode: 'light' });

    const data = {
      label: 'my-node',
      configMaps: [
        { id: 'cm1', name: 'app-config', configData: [{ key: 'K1', value: 'V1' }] },
        { id: 'cm2', name: 'db-config', configData: [{ key: 'K2', value: 'V2' }] },
      ],
    };

    render(<ConfigMapSettingsSection data={data as any} nodeId="node-1" />);

    expect(screen.getByTitle('Attached ConfigMaps (2)')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Open list modal
    const btn = screen.getByTitle('Attached ConfigMaps (2)');
    fireEvent.click(btn);

    expect(screen.getByText('Attached ConfigMaps')).toBeInTheDocument();
    expect(screen.getByText('app-config')).toBeInTheDocument();
    expect(screen.getByText('db-config')).toBeInTheDocument();

    // Close list modal
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Attached ConfigMaps')).not.toBeInTheDocument();
  });

  it('handles editing and deleting configmaps in list modal', () => {
    const updateNodeData = vi.fn();
    const addLog = vi.fn();
    useFlowStore.setState({ updateNodeData, addLog });

    const data = {
      label: 'my-node',
      configMaps: [
        { id: 'cm1', name: 'app-config', configData: [{ key: 'API_URL', value: 'http://test' }] },
      ],
    };

    render(<ConfigMapSettingsSection data={data as any} nodeId="node-1" />);

    // Open list modal
    fireEvent.click(screen.getByTitle('Attached ConfigMaps (1)'));

    // Click Delete ConfigMap button in list modal
    const deleteBtn = screen.getByTitle('Delete ConfigMap');
    fireEvent.click(deleteBtn);

    expect(updateNodeData).toHaveBeenCalledWith('node-1', { configMaps: [] });
    expect(addLog).toHaveBeenCalledWith('info', expect.stringContaining('Removed ConfigMap'), 'UI');

    // Click Edit ConfigMap button in list modal
    const editBtn = screen.getByTitle('Edit ConfigMap');
    fireEvent.click(editBtn);

    expect(screen.getByText('Edit ConfigMap')).toBeInTheDocument();

    // Save configmap in edit modal
    const saveBtn = screen.getByText('Update ConfigMap');
    fireEvent.click(saveBtn);

    expect(updateNodeData).toHaveBeenCalledWith('node-1', {
      configMaps: [expect.objectContaining({ id: 'cm1', name: 'app-config' })],
    });
    expect(addLog).toHaveBeenCalledWith('info', expect.stringContaining('Updated ConfigMap'), 'UI');
  });
});
