import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { RoleSettingsSection } from '@/components/Config/RoleSettingsSection';
import { useFlowStore } from '@/store';

describe('RoleSettingsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      updateNodeData: vi.fn(),
      addLog: vi.fn(),
    });
  });

  it('returns null when roles array is empty or undefined', () => {
    const data = { label: 'my-node', roles: [] };
    const { container } = render(<RoleSettingsSection data={data as any} nodeId="node-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders attached role badge with count > 1 in light mode and opens list modal', () => {
    useFlowStore.setState({ colorMode: 'light' });

    const data = {
      label: 'my-node',
      roles: [
        { id: 'r1', name: 'reader-role', rules: [] },
        { id: 'r2', name: 'writer-role', rules: [] },
      ],
    };

    render(<RoleSettingsSection data={data as any} nodeId="node-1" />);

    expect(screen.getByTitle('Attached Roles (2)')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Open list modal
    const btn = screen.getByTitle('Attached Roles (2)');
    fireEvent.click(btn);

    expect(screen.getByText('Attached RBAC Roles')).toBeInTheDocument();
    expect(screen.getByText('reader-role')).toBeInTheDocument();
    expect(screen.getByText('writer-role')).toBeInTheDocument();

    // Close list modal
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Attached RBAC Roles')).not.toBeInTheDocument();
  });

  it('handles editing and deleting roles from list modal', () => {
    const updateNodeData = vi.fn();
    const addLog = vi.fn();
    useFlowStore.setState({ updateNodeData, addLog });

    const data = {
      label: 'my-node',
      roles: [
        { id: 'r1', name: 'reader-role', rules: [] },
      ],
    };

    render(<RoleSettingsSection data={data as any} nodeId="node-1" />);

    // Open list modal
    fireEvent.click(screen.getByTitle('Attached Roles (1)'));

    // Click Delete Role button in list modal
    const deleteBtn = screen.getByTitle('Delete Role');
    fireEvent.click(deleteBtn);

    expect(updateNodeData).toHaveBeenCalledWith('node-1', { roles: [] });
    expect(addLog).toHaveBeenCalledWith('info', expect.stringContaining('Removed role'), 'UI');

    // Click Edit Role button in list modal
    const editBtn = screen.getByTitle('Edit Role');
    fireEvent.click(editBtn);

    expect(screen.getByText('Edit Role')).toBeInTheDocument();

    // Save role in edit modal
    const saveBtn = screen.getByText('Update Role');
    fireEvent.click(saveBtn);

    expect(updateNodeData).toHaveBeenCalledWith('node-1', {
      roles: [expect.objectContaining({ id: 'r1', name: 'reader-role' })],
    });
    expect(addLog).toHaveBeenCalledWith('info', expect.stringContaining('Updated role'), 'UI');
  });

  it('handles handleSaveRole updating or adding roles in modal', () => {
    const updateNodeData = vi.fn();
    useFlowStore.setState({ updateNodeData });

    const data = {
      label: 'my-node',
      roles: [
        { id: 'r1', name: 'reader-role', rules: [] },
      ],
    };

    render(<RoleSettingsSection data={data as any} nodeId="node-1" />);

    // Open list modal
    fireEvent.click(screen.getByTitle('Attached Roles (1)'));

    // Open edit modal for r1
    fireEvent.click(screen.getByTitle('Edit Role'));

    // Change role name and click update
    const nameInput = screen.getByDisplayValue('reader-role');
    fireEvent.change(nameInput, { target: { value: 'updated-reader-role' } });

    fireEvent.click(screen.getByText('Update Role'));

    expect(updateNodeData).toHaveBeenCalledWith('node-1', {
      roles: [expect.objectContaining({ id: 'r1', name: 'updated-reader-role' })],
    });
  });
});
