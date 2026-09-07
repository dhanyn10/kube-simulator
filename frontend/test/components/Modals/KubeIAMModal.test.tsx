import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { KubeIAMModal } from '../../../src/components/Modals/KubeIAMModal';
import { useFlowStore } from '../../../src/store';

describe('KubeIAMModal', () => {
  beforeEach(() => {
    useFlowStore.setState({
      colorMode: 'dark',
      iamUsers: [
        {
          id: 'iam-test-1',
          username: 'admin-user',
          accountId: '123456789012',
          roles: ['AdministratorAccess'],
          attachedPolicies: ['AdministratorAccess'],
          createdAt: '2025-01-01',
        },
      ],
    });
  });

  it('does not render when isOpen is false', () => {
    render(<KubeIAMModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('AWS IAM Management (Kube IAM)')).toBeNull();
  });

  it('renders correctly when open and lists active IAM users', () => {
    render(<KubeIAMModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('AWS IAM Management (Kube IAM)')).toBeDefined();
    expect(screen.getByText('admin-user')).toBeDefined();
    expect(screen.getByText('AdministratorAccess')).toBeDefined();
  });

  it('switches to Add New User tab and creates a new user', () => {
    render(<KubeIAMModal isOpen={true} onClose={vi.fn()} />);

    const addUserTabBtn = screen.getByRole('button', { name: /Add New User/i });
    fireEvent.click(addUserTabBtn);

    const usernameInput = screen.getByLabelText('User Name');
    fireEvent.change(usernameInput, { target: { value: 'dev-team-lead' } });

    const createUserBtn = screen.getByRole('button', { name: 'Create User' });
    fireEvent.click(createUserBtn);

    const state = useFlowStore.getState();
    const created = state.iamUsers.find((u) => u.username === 'dev-team-lead');
    expect(created).toBeDefined();
    expect(created?.username).toBe('dev-team-lead');
  });

  it('deletes an IAM user when delete button is clicked', () => {
    render(<KubeIAMModal isOpen={true} onClose={vi.fn()} />);

    const deleteBtn = screen.getByTitle('Delete User');
    fireEvent.click(deleteBtn);

    const state = useFlowStore.getState();
    expect(state.iamUsers.find((u) => u.id === 'iam-test-1')).toBeUndefined();
  });
});
