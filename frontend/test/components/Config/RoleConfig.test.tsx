import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleConfig } from '@/components/Config/RoleConfig';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

describe('RoleConfig', () => {
  const dummyRoleData = {
    label: 'my-role',
    type: 'Role' as const,
    rules: [
      {
        apiGroups: [''],
        resources: ['pods', 'deployments'],
        verbs: ['get', 'list'],
      },
      {
        apiGroups: ['apps'],
        resources: [],
        verbs: ['*'],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [
        { id: 'r1', type: 'Role', data: dummyRoleData } as any,
        { id: 'p1', type: 'Pod', data: { label: 'web-pod' } } as any,
      ],
      edges: [{ id: 'e1', source: 'r1', target: 'p1' }],
    });
  });

  it('renders role rules, verbs, and handles Add Rule and Remove Rule clicks', () => {
    const updateNodeData = vi.spyOn(useFlowStore.getState(), 'updateNodeData');

    render(<RoleConfig data={dummyRoleData} nodeId="r1" />);

    expect(screen.getByText('RBAC Role Rules')).toBeInTheDocument();
    expect(screen.getByText('Rule #1')).toBeInTheDocument();
    expect(screen.getByText('Rule #2')).toBeInTheDocument();

    // Click Add Rule button
    fireEvent.click(screen.getByRole('button', { name: /Add Rule/i }));
    expect(updateNodeData).toHaveBeenCalledWith('r1', {
      rules: expect.arrayContaining([expect.objectContaining({ verbs: ['get', 'list'] })]),
    });

    // Click Remove Rule button on Rule #2
    const removeBtns = screen.getAllByTitle('Remove rule');
    fireEvent.click(removeBtns[1]);
    expect(updateNodeData).toHaveBeenCalledWith('r1', {
      rules: [dummyRoleData.rules[0]],
    });
  });

  it('handles verb toggling and resource disconnect click', () => {
    const updateNodeData = vi.spyOn(useFlowStore.getState(), 'updateNodeData');

    render(<RoleConfig data={dummyRoleData} nodeId="r1" />);

    // Disconnect 'pods' resource badge
    const podBadge = screen.getByRole('button', { name: /pods ×/i });
    fireEvent.click(podBadge);
    expect(updateNodeData).toHaveBeenCalled();

    // Toggle verb 'watch' on Rule #1
    const watchButtons = screen.getAllByRole('button', { name: /^watch$/i });
    fireEvent.click(watchButtons[0]);
    expect(updateNodeData).toHaveBeenCalled();
  });

  it('renders in light mode with no rules fallback message', () => {
    useFlowStore.setState({ colorMode: 'light' });

    render(<RoleConfig data={{ label: 'empty-role', type: 'Role', rules: [] }} nodeId="r1" />);

    expect(screen.getByText('No RBAC rules defined. Click "Add Rule" to start.')).toBeInTheDocument();
  });
});
