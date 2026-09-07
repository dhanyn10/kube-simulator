import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      ],
      iamUsers: [
        { id: 'u1', username: 'admin-user', accessType: 'Full', createdAt: Date.now() },
        { id: 'u2', username: 'dev-user', accessType: 'Read-Only', createdAt: Date.now() },
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

    const roleNameInput = screen.getByLabelText(/Role Name/i) as HTMLInputElement;
    expect(roleNameInput.value).toMatch(/^role-/);

    expect(screen.getByText('admin-user')).toBeInTheDocument();
    expect(screen.getByText('dev-user')).toBeInTheDocument();
  });

  it('handles toggling IAM user selection', () => {
    const onSaveMock = vi.fn();
    render(
      <RoleModal
        isOpen={true}
        onClose={vi.fn()}
        targetNodeId="dep-1"
        targetNodeLabel="web-app"
        onSave={onSaveMock}
      />
    );

    const devUserBadge = screen.getByText('dev-user');
    fireEvent.click(devUserBadge);

    const saveBtn = screen.getByRole('button', { name: 'Attach Role' });
    fireEvent.click(saveBtn);

    expect(onSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedUser: expect.any(String),
        assignedUsers: expect.arrayContaining(['dev-user']),
      })
    );
  });

  it('supports editing an existing role', () => {
    const initialRole = {
      id: 'role-123',
      name: 'existing-role',
      assignedUser: 'dev-user',
      assignedUsers: ['dev-user'],
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
    const roleNameInput = screen.getByLabelText(/Role Name/i) as HTMLInputElement;
    expect(roleNameInput.value).toBe('existing-role');
    expect(screen.getByText('dev-user')).toBeInTheDocument();
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

    const saveBtn = screen.getByRole('button', { name: 'Attach Role' });
    fireEvent.click(saveBtn);

    expect(onSaveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.any(String),
        assignedUser: expect.any(String),
      })
    );
    expect(onCloseMock).toHaveBeenCalled();
  });
});
