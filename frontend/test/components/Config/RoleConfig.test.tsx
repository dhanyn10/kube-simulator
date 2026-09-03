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

  it('renders empty rules state when rules is empty or missing', () => {
    const mockData = {
      label: 'test-role',
      type: 'Role' as const,
      rules: [],
    };

    render(<RoleConfig data={mockData} nodeId="role-1" />);

    expect(screen.getByText('No RBAC rules defined. Click "Add Rule" to start.')).toBeDefined();
  });

  it('allows toggling verbs on a rule and renders light mode verb button styles', () => {
    const updateNodeData = vi.fn();
    useFlowStore.setState({ updateNodeData, colorMode: 'light' });

    const mockData = {
      label: 'test-role',
      type: 'Role' as const,
      rules: [{ apiGroups: [''], resources: [], verbs: ['get'] }],
    };

    render(<RoleConfig data={mockData} nodeId="role-1" />);

    expect(screen.getByText('No target resources connected. Connect Role to a workload card on canvas.')).toBeDefined();

    // Click 'watch' to add it
    const watchVerbBtn = screen.getByText('watch');
    fireEvent.click(watchVerbBtn);
    expect(updateNodeData).toHaveBeenLastCalledWith('role-1', {
      rules: [{ apiGroups: [''], resources: [], verbs: ['get', 'watch'] }],
    });

    // Click 'get' to remove it
    const getVerbBtn = screen.getByText('get');
    fireEvent.click(getVerbBtn);
    expect(updateNodeData).toHaveBeenLastCalledWith('role-1', {
      rules: [{ apiGroups: [''], resources: [], verbs: ['watch'] }],
    });
  });

  it('handles disconnect resource for pods, deployments, secrets, and reverse edge directions', () => {
    const updateNodeData = vi.fn();
    const setEdges = vi.fn();
    useFlowStore.setState({
      updateNodeData,
      setEdges,
      nodes: [
        { id: 'role-1', type: 'Role', position: { x: 0, y: 0 }, data: {} },
        { id: 'pod-1', type: 'Pod', position: { x: 50, y: 0 }, data: {} },
        { id: 'dep-1', type: 'Deployment', position: { x: 100, y: 0 }, data: {} },
        { id: 'sec-1', type: 'Secret', position: { x: 200, y: 0 }, data: {} },
      ],
      edges: [
        { id: 'e0', source: 'role-1', target: 'pod-1' },
        { id: 'e1', source: 'role-1', target: 'dep-1' },
        { id: 'e2', source: 'sec-1', target: 'role-1' },
      ],
    });

    const mockData = {
      label: 'test-role',
      type: 'Role' as const,
      rules: [
        { apiGroups: [''], resources: ['pods'], verbs: ['get'] },
        { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get'] },
        { apiGroups: [''], resources: ['secrets'], verbs: ['get'] },
      ],
    };

    const { rerender } = render(<RoleConfig data={mockData} nodeId="role-1" />);

    // Disconnect pods
    const podsBadge = screen.getByText('pods ×');
    fireEvent.click(podsBadge);
    expect(setEdges).toHaveBeenCalledWith([
      { id: 'e2', source: 'sec-1', target: 'role-1' },
    ]);

    // Disconnect deployments
    rerender(<RoleConfig data={mockData} nodeId="role-1" />);
    const depBadge = screen.getByText('deployments ×');
    fireEvent.click(depBadge);

    expect(setEdges).toHaveBeenCalledWith([
      { id: 'e2', source: 'sec-1', target: 'role-1' },
    ]);

    // Disconnect secrets with reverse edge
    rerender(<RoleConfig data={mockData} nodeId="role-1" />);
    const secBadge = screen.getByText('secrets ×');
    fireEvent.click(secBadge);

    expect(setEdges).toHaveBeenCalledWith([
      { id: 'e0', source: 'role-1', target: 'pod-1' },
      { id: 'e1', source: 'role-1', target: 'dep-1' },
    ]);
  });

  it('handles disconnect resource fallback without connected edges', () => {
    const updateNodeData = vi.fn();
    useFlowStore.setState({
      updateNodeData,
      nodes: [{ id: 'role-1', type: 'Role', position: { x: 0, y: 0 }, data: {} }],
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

    expect(updateNodeData).toHaveBeenCalledWith('role-1', {
      rules: [{ apiGroups: [''], resources: [], verbs: ['get'] }],
    });
  });
});
