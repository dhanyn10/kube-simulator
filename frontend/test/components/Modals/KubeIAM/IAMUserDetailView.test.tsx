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
    expect(screen.getByText('(Pod)')).toBeInTheDocument();

    // Click role row
    const roleRow = screen.getByText('PodReaderRole-rb-node').closest('tr')!;
    fireEvent.click(roleRow);
    expect(onNavigateToRole).toHaveBeenCalledWith('node-pod-1', 'Web Pod');

    // Click binding ID button inside cell
    const bindingBtn = screen.getByRole('button', { name: /PodReaderRole-rb-node/i });
    fireEvent.click(bindingBtn);
    expect(onNavigateToRole).toHaveBeenCalledWith('node-pod-1', 'Web Pod');
  });

  it('renders user summary cards and role table in light mode when inactive', () => {
    render(
      <IAMUserDetailView
        {...defaultProps}
        isDark={false}
        isActive={false}
      />
    );

    expect(screen.getByText('Never / Inactive')).toBeInTheDocument();
    expect(screen.getAllByText('developer1').length).toBeGreaterThan(0);
  });

  it('handles undefined user policies and attached roles without nodeType', () => {
    const userWithoutPolicies: KubeIAMUser = {
      ...dummyUser,
      policies: undefined as any,
    };
    const rolesWithoutType = [
      {
        nodeId: 'node-pod-2',
        nodeLabel: 'Worker Pod',
        nodeType: undefined as any,
        roleId: 'role-2',
        roleName: 'WorkerRole',
        createdAt: 1700000000000,
      },
    ];

    render(
      <IAMUserDetailView
        {...defaultProps}
        user={userWithoutPolicies}
        attachedRoles={rolesWithoutType}
      />
    );

    expect(screen.getByText('Attached IAM Policies (0)')).toBeInTheDocument();
    expect(screen.getByText('Worker Pod')).toBeInTheDocument();
    expect(screen.queryByText('(Pod)')).not.toBeInTheDocument();
  });

  it('handles attached roles with undefined createdAt and single word nodeId', () => {
    const rolesWithoutCreatedAt = [
      {
        nodeId: 'singleword',
        nodeLabel: 'Single Node',
        nodeType: 'Deployment',
        roleId: 'role-3',
        roleName: 'AppRole',
        createdAt: undefined,
      },
    ];

    render(
      <IAMUserDetailView
        {...defaultProps}
        attachedRoles={rolesWithoutCreatedAt}
      />
    );

    expect(screen.getByText('AppRole-rb-singleword')).toBeInTheDocument();
    expect(screen.getByText('System Default')).toBeInTheDocument();
  });

  it('switches to editing mode, cancels edit or finishes edit with Full Access and updates active identity', () => {
    useFlowStore.setState({ activeIdentity: 'developer1' });
    const updateIamUser = vi.spyOn(useFlowStore.getState(), 'updateIamUser');
    const setActiveIdentity = vi.spyOn(useFlowStore.getState(), 'setActiveIdentity');

    const { rerender } = render(<IAMUserDetailView {...defaultProps} />);

    // Click Edit Profile button and cancel
    fireEvent.click(screen.getByRole('button', { name: /Edit Profile/i }));
    expect(screen.getByText('Edit User Profile (developer1)')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Cancel Editing/i })[0]);
    expect(screen.queryByText('Edit User Profile')).not.toBeInTheDocument();

    // Edit profile again and complete edit
    fireEvent.click(screen.getByRole('button', { name: /Edit Profile/i }));

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

  it('finishes edit with Managed Access when AdministratorAccess is not selected and activeIdentity differs', () => {
    useFlowStore.setState({ activeIdentity: 'system:admin' });
    const updateIamUser = vi.spyOn(useFlowStore.getState(), 'updateIamUser');
    const setActiveIdentity = vi.spyOn(useFlowStore.getState(), 'setActiveIdentity');

    render(<IAMUserDetailView {...defaultProps} />);

    // Click Edit Profile button
    fireEvent.click(screen.getByRole('button', { name: /Edit Profile/i }));

    // Step 1: Change username -> Next
    const usernameInput = screen.getByDisplayValue('developer1');
    fireEvent.change(usernameInput, { target: { value: 'dev_managed' } });
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    // Step 2: Keep ReadOnlyAccess (do not select AdministratorAccess) -> Next
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    // Step 3: Finish Update
    fireEvent.click(screen.getByRole('button', { name: /Update User/i }));

    expect(updateIamUser).toHaveBeenCalledWith('usr-1', {
      username: 'dev_managed',
      accessType: 'Managed Access',
      policies: expect.arrayContaining([expect.objectContaining({ name: 'ReadOnlyAccess' })]),
    });
    expect(setActiveIdentity).not.toHaveBeenCalled();
  });
});
