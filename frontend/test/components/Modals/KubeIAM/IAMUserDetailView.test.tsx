import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { IAMUserDetailView, IAMUserDetailViewProps } from '@/components/Modals/KubeIAM/IAMUserDetailView';
import { KubeIAMUser } from '@/types';
import { useFlowStore } from '@/store';

describe('IAMUserDetailView', () => {
  const dummyUser: KubeIAMUser = {
    id: 'usr-1',
    username: 'developer1',
    accessType: 'Managed Access',
    createdAt: 1700000000000,
    policies: [
      {
        name: 'ReadOnlyAccess',
        description: 'Provides read-only access to view workloads, services, and configs.',
        statement: [{ effect: 'Allow', action: ['get'], resource: ['*'] }],
      },
    ],
  };

  const attachedRoles = [
    {
      nodeId: 'node-pod-1',
      nodeLabel: 'Web Pod',
      nodeType: 'Pod',
      roleId: 'role-1',
      roleName: 'PodReaderRole',
      createdAt: 1700000000000,
    },
  ];

  const defaultProps: IAMUserDetailViewProps = {
    user: dummyUser,
    isActive: false,
    isDark: true,
    attachedRoles,
    onBack: vi.fn(),
    onSelectActive: vi.fn(),
    onDeleteUser: vi.fn(),
    onNavigateToRole: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      activeIdentity: 'system:admin',
      iamUsers: [dummyUser],
    });
  });

  it('renders user detail view in dark mode with empty roles and policy description fallback', () => {
    const onBack = vi.fn();
    const onSelectActive = vi.fn();
    const onDeleteUser = vi.fn();

    const userWithoutDesc: KubeIAMUser = {
      ...dummyUser,
      policies: [{ name: 'ReadOnlyAccess', description: '', statement: [] }],
    };

    render(
      <IAMUserDetailView
        {...defaultProps}
        user={userWithoutDesc}
        attachedRoles={[]}
        isDark={true}
        isActive={false}
        onBack={onBack}
        onSelectActive={onSelectActive}
        onDeleteUser={onDeleteUser}
      />
    );

    expect(screen.getByText('developer1')).toBeInTheDocument();
    expect(screen.getByText('Never / Inactive')).toBeInTheDocument();
    expect(screen.getByText('Standard IAM Policy')).toBeInTheDocument();
    expect(screen.getByText('No specific RoleBindings assigned on the canvas.')).toBeInTheDocument();

    // Click Back to Users
    fireEvent.click(screen.getByRole('button', { name: /Back to Users/i }));
    expect(onBack).toHaveBeenCalled();

    // Click Set Active Profile
    const setActiveBtn = screen.getByTestId('detail-use-profile-btn-developer1');
    fireEvent.click(setActiveBtn);
    expect(onSelectActive).toHaveBeenCalledWith('developer1');

    // Click Delete User
    const deleteBtn = screen.getByTitle('Delete User');
    fireEvent.click(deleteBtn);
    expect(onDeleteUser).toHaveBeenCalledWith('usr-1');
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('renders user detail view in light mode when active and handles role navigation', () => {
    const onNavigateToRole = vi.fn();

    render(
      <IAMUserDetailView
        {...defaultProps}
        isDark={false}
        isActive={true}
        onNavigateToRole={onNavigateToRole}
      />
    );

    expect(screen.getByText('Active Session')).toBeInTheDocument();
    expect(screen.getByText('Active Context')).toBeInTheDocument();

    // Click role row or binding link
    const bindingLink = screen.getByText('PodReaderRole-rb-node');
    fireEvent.click(bindingLink);
    expect(onNavigateToRole).toHaveBeenCalledWith('node-pod-1', 'Web Pod');
  });

  it('switches to editing mode, finishes edit with Full Access, and updates active identity if user is active', () => {
    useFlowStore.setState({ activeIdentity: 'developer1' });
    const updateIamUser = vi.spyOn(useFlowStore.getState(), 'updateIamUser');
    const setActiveIdentity = vi.spyOn(useFlowStore.getState(), 'setActiveIdentity');

    render(<IAMUserDetailView {...defaultProps} />);

    // Click Edit Profile button
    const editBtn = screen.getByRole('button', { name: /Edit Profile/i });
    fireEvent.click(editBtn);

    expect(screen.getByText('Edit User Profile (developer1)')).toBeInTheDocument();

    // Step 1: Change username -> Next
    const usernameInput = screen.getByDisplayValue('developer1');
    fireEvent.change(usernameInput, { target: { value: 'dev_admin' } });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    // Step 2: Deselect ReadOnlyAccess by clicking description cell, then select AdministratorAccess by clicking description cell
    fireEvent.click(screen.getByText('Provides read-only access to view workloads, services, and configs.'));
    fireEvent.click(screen.getByText('Provides full access to Kube resources and cluster management.'));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    // Step 3: Finish Update
    fireEvent.click(screen.getByRole('button', { name: /Update User/i }));

    expect(updateIamUser).toHaveBeenCalledWith('usr-1', {
      username: 'dev_admin',
      accessType: 'Full Access',
      policies: expect.arrayContaining([expect.objectContaining({ name: 'AdministratorAccess' })]),
    });
    expect(setActiveIdentity).toHaveBeenCalledWith('dev_admin');

    // Editing mode closed
    expect(screen.queryByText('Edit User Profile')).not.toBeInTheDocument();
  });
});
