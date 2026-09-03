import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RoleConfig } from '@/components/Config/RoleConfig';
import { useFlowStore } from '@/store';

describe('RoleConfig', () => {
  beforeEach(() => {
    useFlowStore.setState({
      nodes: [],
      edges: [],
      colorMode: 'dark',
      updateNodeData: vi.fn(),
      setEdges: vi.fn(),
      addLog: vi.fn(),
    });
  });

  it('renders RBAC rules and allows adding/removing rules', () => {
    const updateNodeData = vi.fn();
    useFlowStore.setState({ updateNodeData });

    const mockData = {
      label: 'test-role',
      type: 'Role' as const,
      rules: [
        { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] },
        { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get'] },
      ],
    };

    render(<RoleConfig data={mockData} nodeId="role-1" />);

    expect(screen.getByText('RBAC Role Rules')).toBeDefined();
    expect(screen.getByText('Rule #1')).toBeDefined();
    expect(screen.getByText('Rule #2')).toBeDefined();

    // Test Add Rule button
    const addButton = screen.getByText('Add Rule');
    fireEvent.click(addButton);
    expect(updateNodeData).toHaveBeenCalledWith('role-1', {
      rules: expect.arrayContaining([
        expect.objectContaining({ verbs: ['get', 'list'] }),
      ]),
    });

    // Test Remove Rule button
    const trashButtons = screen.getAllByTitle('Remove rule');
    fireEvent.click(trashButtons[0]);
    expect(updateNodeData).toHaveBeenCalledWith('role-1', {
      rules: [{ apiGroups: ['apps'], resources: ['deployments'], verbs: ['get'] }],
    });
  });

  it('allows toggling verbs on a rule', () => {
    const updateNodeData = vi.fn();
    useFlowStore.setState({ updateNodeData });

    const mockData = {
      label: 'test-role',
      type: 'Role' as const,
      rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }],
    };

    render(<RoleConfig data={mockData} nodeId="role-1" />);

    // Click 'watch' to add it
    const watchVerbBtn = screen.getByText('watch');
    fireEvent.click(watchVerbBtn);
    expect(updateNodeData).toHaveBeenLastCalledWith('role-1', {
      rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get', 'watch'] }],
    });

    // Click 'get' to remove it (since array now contains ['get', 'watch'], toggling 'get' leaves ['watch'])
    const getVerbBtn = screen.getByText('get');
    fireEvent.click(getVerbBtn);
    expect(updateNodeData).toHaveBeenLastCalledWith('role-1', {
      rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['watch'] }],
    });
  });

  it('handles disconnect resource with connected edges', () => {
    const updateNodeData = vi.fn();
    const setEdges = vi.fn();
    useFlowStore.setState({
      updateNodeData,
      setEdges,
      nodes: [
        { id: 'role-1', type: 'Role', position: { x: 0, y: 0 }, data: {} },
        { id: 'pod-1', type: 'Pod', position: { x: 100, y: 0 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 'role-1', target: 'pod-1' },
      ],
    });

    const mockData = {
      label: 'test-role',
      type: 'Role' as const,
      rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }],
    };

    render(<RoleConfig data={mockData} nodeId="role-1" />);

    const resBadge = screen.getByText('pods ×');
    fireEvent.click(resBadge);

    expect(setEdges).toHaveBeenCalledWith([]);
    expect(updateNodeData).toHaveBeenCalledWith('role-1', {
      rules: [{ apiGroups: [''], resources: [], verbs: ['get'] }],
    });
  });

  it('handles disconnect resource without connected edges (line 64 fallback)', () => {
    const updateNodeData = vi.fn();
    useFlowStore.setState({
      updateNodeData,
      nodes: [
        { id: 'role-1', type: 'Role', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [],
    });

    const mockData = {
      label: 'test-role',
      type: 'Role' as const,
      rules: [{ apiGroups: [''], resources: ['services'], verbs: ['get'] }],
    };

    render(<RoleConfig data={mockData} nodeId="role-1" />);

    const resBadge = screen.getByText('services ×');
    fireEvent.click(resBadge);

    // Should trigger fallback directly updating rules in node data
    expect(updateNodeData).toHaveBeenCalledWith('role-1', {
      rules: [{ apiGroups: [''], resources: [], verbs: ['get'] }],
    });
  });
});
