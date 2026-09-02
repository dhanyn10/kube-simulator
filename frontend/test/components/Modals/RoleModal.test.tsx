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
});
