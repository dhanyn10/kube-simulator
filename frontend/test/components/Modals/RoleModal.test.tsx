import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { RoleModal } from '@/components/Modals/RoleModal';
import { useFlowStore } from '@/store';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    Handle: ({ type, position }: any) => <div data-testid={`handle-${type}-${position}`} />,
  };
});

describe('RoleModal component', () => {
  beforeEach(() => {
    useFlowStore.setState({
      nodes: [
        { id: 'dep-1', type: 'Deployment', data: { label: 'web-app', replicas: 2 } },
        { id: 'pod-1', type: 'Pod', parentId: 'dep-1', data: { label: 'pod-1' } },
      ],
      colorMode: 'dark',
    });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <RoleModal
        isOpen={false}
        onClose={vi.fn()}
        targetNodeId="dep-1"
        targetNodeLabel="web-app"
        onSave={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly and populates initial values for new role attachment', () => {
    render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="dep-1"
        targetNodeLabel="web-app"
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Attach RBAC Role')).toBeInTheDocument();
    expect(screen.getByText('Target card: web-app')).toBeInTheDocument();

    const roleNameInput = screen.getByLabelText('Role Name') as HTMLInputElement;
    expect(roleNameInput.value).toMatch(/^role-/);

    expect(screen.getByText('deployments')).toBeInTheDocument();
    expect(screen.getByText('pods')).toBeInTheDocument();
  });

  it('handles adding and removing rules', () => {
    render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="dep-1"
        targetNodeLabel="web-app"
        onSave={vi.fn()}
      />
    );

    const addRuleBtn = screen.getByText('Add Rule');
    fireEvent.click(addRuleBtn);

    const removeBtns = screen.getAllByTitle('Remove Rule');
    expect(removeBtns.length).toBeGreaterThan(0);
    fireEvent.click(removeBtns[0]);
  });

  it('supports editing an existing role', () => {
    const initialRole = {
      id: 'role-123',
      name: 'existing-role',
      rules: [
        {
          apiGroups: ['apps'],
          resources: ['deployments'],
          verbs: ['get', 'watch'],
        },
      ],
    };

    render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="dep-1"
        targetNodeLabel="web-app"
        initialRole={initialRole}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Edit Role')).toBeInTheDocument();
    const roleNameInput = screen.getByLabelText('Role Name') as HTMLInputElement;
    expect(roleNameInput.value).toBe('existing-role');
    expect(screen.getByText('apps')).toBeInTheDocument();
  });

  it('saves configured role when update/attach button is clicked', () => {
    const onSaveMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <RoleModal
        isOpen={true}
        onClose={onCloseMock}
        targetNodeId="dep-1"
        targetNodeLabel="web-app"
        onSave={onSaveMock}
      />
    );

    const saveBtn = screen.getByText('Attach Role');
    fireEvent.click(saveBtn);

    expect(onSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.any(String),
        rules: expect.any(Array),
      })
    );
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('instantiates missing resource card on canvas when selecting "add to canvas" suggestion', () => {
    const addNodeSpy = vi.fn();
    useFlowStore.setState({
      nodes: [{ id: 'dep-1', type: 'Deployment', data: { label: 'web-app' } }],
      addNode: addNodeSpy,
    });

    render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="dep-1"
        targetNodeLabel="web-app"
        onSave={vi.fn()}
      />
    );

    const resInput = screen.getByLabelText('Resources');

    fireEvent.focus(resInput);
    fireEvent.change(resInput, { target: { value: 'services' } });

    const addToCanvasItem = screen.getByText('services');
    fireEvent.mouseDown(addToCanvasItem);

    expect(addNodeSpy).toHaveBeenCalledWith('Service');
  });

  it('maps "Core API" and "core" typed inputs to empty string ""', () => {
    render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="dep-1"
        targetNodeLabel="web-app"
        onSave={vi.fn()}
      />
    );

    const apiInput = screen.getByLabelText('API Groups');

    fireEvent.focus(apiInput);
    fireEvent.change(apiInput, { target: { value: 'Core API' } });
    fireEvent.keyDown(apiInput, { key: 'Enter', code: 'Enter' });

    expect(screen.getAllByText('Core API').length).toBeGreaterThan(0);
  });

  it('correctly derives resources for Namespace targets and various node types', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'ns-1', type: 'Namespace', data: { label: 'default-ns' } },
        { id: 'dep-1', type: 'Deployment', parentId: 'ns-1', data: { replicas: 1 } },
        { id: 'pod-1', type: 'Pod', parentId: 'dep-1', data: {} },
        { id: 'svc-1', type: 'Service', parentId: 'ns-1', data: {} },
        { id: 'cm-1', type: 'ConfigMap', parentId: 'ns-1', data: {} },
        { id: 'sec-1', type: 'Secret', parentId: 'ns-1', data: {} },
        { id: 'pvc-1', type: 'PVC', parentId: 'ns-1', data: {} },
        { id: 'ing-1', type: 'Ingress', parentId: 'ns-1', data: {} },
        { id: 'hpa-1', type: 'HPA', parentId: 'ns-1', data: {} },
      ],
      colorMode: 'light',
    });

    render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="ns-1"
        targetNodeLabel="default-ns"
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('deployments')).toBeInTheDocument();
    expect(screen.getByText('pods')).toBeInTheDocument();
    expect(screen.getByText('services')).toBeInTheDocument();
    expect(screen.getByText('configmaps')).toBeInTheDocument();
    expect(screen.getByText('secrets')).toBeInTheDocument();
    expect(screen.getByText('persistentvolumeclaims')).toBeInTheDocument();
    expect(screen.getByText('ingresses')).toBeInTheDocument();
    expect(screen.getByText('horizontalpodautoscalers')).toBeInTheDocument();
  });

  it('handles empty Namespace and single standalone resource types correctly', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'ns-empty', type: 'Namespace', data: { label: 'empty-ns' } },
        { id: 'svc-standalone', type: 'Service', data: { label: 'my-svc' } },
        { id: 'custom-node', type: 'CustomResource', data: { label: 'custom' } },
      ],
      colorMode: 'dark',
    });

    const { unmount } = render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="ns-empty"
        targetNodeLabel="empty-ns"
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText('namespaces')).toBeInTheDocument();
    unmount();

    const { unmount: unmount2 } = render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="svc-standalone"
        targetNodeLabel="my-svc"
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText('services')).toBeInTheDocument();
    unmount2();

    render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="custom-node"
        targetNodeLabel="custom"
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText('customresources')).toBeInTheDocument();
  });

  it('handles TagInput keyboard navigation, tag removal, escape, and backspace', () => {
    render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="dep-1"
        targetNodeLabel="web-app"
        onSave={vi.fn()}
      />
    );

    const verbsInput = screen.getByLabelText('Verbs (Permissions)');

    // Open suggestions by focus
    fireEvent.focus(verbsInput);

    // Arrow keys navigation
    fireEvent.keyDown(verbsInput, { key: 'ArrowDown', code: 'ArrowDown' });
    fireEvent.keyDown(verbsInput, { key: 'ArrowUp', code: 'ArrowUp' });

    // Enter/Tab to select suggestion
    fireEvent.keyDown(verbsInput, { key: 'Tab', code: 'Tab' });

    // Keydown comma or enter on text
    fireEvent.change(verbsInput, { target: { value: 'create' } });
    fireEvent.keyDown(verbsInput, { key: ',', code: 'Comma' });

    // Keydown Escape
    fireEvent.keyDown(verbsInput, { key: 'Escape', code: 'Escape' });

    // Keydown Backspace on empty input removes last tag
    fireEvent.change(verbsInput, { target: { value: '' } });
    fireEvent.keyDown(verbsInput, { key: 'Backspace', code: 'Backspace' });

    // Click remove tag button
    const removeTagBtns = screen.getAllByRole('button').filter(btn => btn.querySelector('svg'));
    if (removeTagBtns.length > 0) {
      fireEvent.click(removeTagBtns[0]);
    }
  });

  it('derives API groups for various resources when resource tags are updated', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'dep-1', type: 'Deployment', data: { label: 'web-app' } },
        { id: 'ing-1', type: 'Ingress', data: {} },
        { id: 'hpa-1', type: 'HPA', data: {} },
      ],
    });

    const initialRole = {
      id: 'role-123',
      name: 'app-role',
      rules: [{ apiGroups: ['apps', ''], resources: ['deployments', 'pods'], verbs: ['get'] }],
    };

    render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="dep-1"
        targetNodeLabel="web-app"
        initialRole={initialRole}
        onSave={vi.fn()}
      />
    );

    const testCases = [
      { resource: 'jobs', expectedGroup: 'batch' },
      { resource: 'ingresses', expectedGroup: 'networking.k8s.io' },
      { resource: 'horizontalpodautoscalers', expectedGroup: 'autoscaling' },
      { resource: 'storageclasses', expectedGroup: 'storage.k8s.io' },
      { resource: 'roles', expectedGroup: 'rbac.authorization.k8s.io' },
    ];

    for (const { resource, expectedGroup } of testCases) {
      const currentResInput = screen.getByLabelText('Resources');
      fireEvent.focus(currentResInput);
      fireEvent.change(currentResInput, { target: { value: resource } });
      fireEvent.keyDown(currentResInput, { key: 'Enter', code: 'Enter' });

      expect(screen.getByText(expectedGroup)).toBeInTheDocument();
    }
  });
});
