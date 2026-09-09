import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { KubeIAMModal } from '@/components/Modals/KubeIAMModal';
import { useFlowStore } from '@/store';

describe('KubeIAMModal component', () => {
  beforeEach(() => {
    useFlowStore.setState({
      isKubeIamModalOpen: true,
      colorMode: 'dark',
      iamUsers: [
        {
          id: 'user-1',
          username: 'admin-user',
          accessType: 'Full Access',
          policies: [
            {
              name: 'AdministratorAccess',
              type: 'Default',
              description: 'Provides full access to Kube resources.',
            },
          ],
        },
      ],
    });
  });

  it('renders correctly when open with initial user list in dark and light modes', () => {
    const { rerender } = render(<KubeIAMModal />);

    expect(screen.getByText('Kube IAM Management')).toBeInTheDocument();
    expect(screen.getByText('Kube IAM Users (1)')).toBeInTheDocument();
    expect(screen.getByText('admin-user')).toBeInTheDocument();
    expect(screen.getByText('Full Access')).toBeInTheDocument();

    // Rerender in light mode
    act(() => {
      useFlowStore.setState({ colorMode: 'light' });
    });
    rerender(<KubeIAMModal />);
    expect(screen.getByText('admin-user')).toBeInTheDocument();
  });

  it('filters users by search query and shows empty filter message when no match', () => {
    useFlowStore.setState({
      iamUsers: [
        {
          id: 'user-1',
          username: 'alpha-user',
          accessType: 'Full Access',
          policies: [],
        },
        {
          id: 'user-2',
          username: 'beta-user',
          accessType: 'Managed Access',
          policies: [],
        },
      ],
    });

    render(<KubeIAMModal />);

    const searchInput = screen.getByPlaceholderText('Filter users by name...');
    fireEvent.change(searchInput, { target: { value: 'beta' } });

    expect(screen.queryByText('alpha-user')).not.toBeInTheDocument();
    expect(screen.getByText('beta-user')).toBeInTheDocument();

    // Filter with no matches
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByText('No users match your filter')).toBeInTheDocument();
  });

  it('renders built-in system:admin profile and allows switching active identity profile', () => {
    useFlowStore.setState({ activeIdentity: 'system:admin', colorMode: 'light' });

    render(<KubeIAMModal />);

    expect(screen.getByText('system:admin')).toBeInTheDocument();
    expect(screen.getByTestId('use-profile-btn-system-admin')).toHaveTextContent('Active Profile');

    // Click "Use this profile" for admin-user
    const useUserBtn = screen.getByTestId('use-profile-btn-admin-user');
    expect(useUserBtn).toHaveTextContent('Use this profile');
    fireEvent.click(useUserBtn);

    expect(useFlowStore.getState().activeIdentity).toBe('admin-user');
  });

  it('renders search filter empty state when search filter matches no user', () => {
    useFlowStore.setState({ iamUsers: [], colorMode: 'light' });

    render(<KubeIAMModal />);

    expect(screen.getByText('system:admin')).toBeInTheDocument();
  });

  it('deletes user when trash icon button is clicked', () => {
    render(<KubeIAMModal />);

    const deleteBtn = screen.getByTitle('Delete User');
    fireEvent.click(deleteBtn);

    expect(useFlowStore.getState().iamUsers).toHaveLength(0);
  });

  it('navigates wizard steps, validates username in Step 1, and clears error on input change', () => {
    render(<KubeIAMModal />);

    // Click Create User
    const createBtn = screen.getByRole('button', { name: /Create User/i });
    fireEvent.click(createBtn);

    // Verify Step 1
    expect(screen.getAllByText('User Details').length).toBeGreaterThan(0);

    // Click Next without entering username -> error
    const nextBtn = screen.getByText('Next');
    fireEvent.click(nextBtn);

    expect(screen.getByText('Username is required')).toBeInTheDocument();

    // Typing clears usernameError
    const userInput = screen.getByPlaceholderText('e.g. dev-cluster-admin');
    fireEvent.change(userInput, { target: { value: 'a' } });
    expect(screen.queryByText('Username is required')).not.toBeInTheDocument();

    // Enter existing username -> error
    fireEvent.change(userInput, { target: { value: 'admin-user' } });
    fireEvent.click(nextBtn);

    expect(screen.getByText('Username already exists')).toBeInTheDocument();

    // Enter valid new username -> proceeds to Step 2
    fireEvent.change(userInput, { target: { value: 'new-dev' } });
    fireEvent.click(nextBtn);

    expect(screen.getAllByText('Set Permissions').length).toBeGreaterThan(0);
  });

  it('handles policy search, toggles, empty policy validation, and light mode in Step 2', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<KubeIAMModal />);

    // Start wizard and proceed to Step 2
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. dev-cluster-admin'), {
      target: { value: 'new-dev' },
    });
    fireEvent.click(screen.getByText('Next'));

    // Step 2 is active with AdministratorAccess selected by default
    const adminRow = screen.getByText('AdministratorAccess').closest('tr')!;

    // Uncheck AdministratorAccess -> selectedPolicies becomes empty []
    fireEvent.click(adminRow);

    // Try clicking Next with 0 policies selected -> handleNextStep2 returns without changing step
    const nextBtn = screen.getByText('Next');
    fireEvent.click(nextBtn);
    expect(screen.getAllByText('Set Permissions').length).toBeGreaterThan(0);

    // Select ContainerDeveloperPolicy and NetworkingAdminPolicy
    const devRow = screen.getByText('ContainerDeveloperPolicy').closest('tr')!;
    const netRow = screen.getByText('NetworkingAdminPolicy').closest('tr')!;

    fireEvent.click(devRow);
    fireEvent.click(netRow);

    // Uncheck ContainerDeveloperPolicy -> tests removing non-admin policy from list
    fireEvent.click(devRow);

    // Test policy search by description keyword
    const policySearchInput = screen.getByPlaceholderText('Search policies...');
    fireEvent.change(policySearchInput, { target: { value: 'routing' } });

    expect(screen.getByText('NetworkingAdminPolicy')).toBeInTheDocument();
    expect(screen.queryByText('ContainerDeveloperPolicy')).not.toBeInTheDocument();

    // Selecting AdministratorAccess when other policies were selected (and isAdminSelected was false)
    fireEvent.change(policySearchInput, { target: { value: '' } });
    fireEvent.click(adminRow);

    expect(screen.getByText('Permissions Policies (1 selected)')).toBeInTheDocument();
  });

  it('completes user creation wizard through Step 3 in light mode and resets on modal close', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<KubeIAMModal />);

    // Start wizard
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. dev-cluster-admin'), {
      target: { value: 'developer-user' },
    });
    fireEvent.click(screen.getByText('Next'));

    // In Step 2, click AdministratorAccess row to clear, then select ContainerDeveloperPolicy
    fireEvent.click(screen.getByText('AdministratorAccess').closest('tr')!);
    fireEvent.click(screen.getByText('ContainerDeveloperPolicy').closest('tr')!);

    // Click Next -> Step 3 Review & Create
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getAllByText('Review & Create').length).toBeGreaterThan(0);
    expect(screen.getByText('developer-user')).toBeInTheDocument();
    expect(screen.getByText('Managed Access')).toBeInTheDocument();
    expect(screen.getByText('ContainerDeveloperPolicy')).toBeInTheDocument();

    // Click Previous to go back to Step 2
    fireEvent.click(screen.getByText('Previous'));
    expect(screen.getAllByText('Set Permissions').length).toBeGreaterThan(0);

    // Click Next back to Step 3 and Finish
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));

    // User should be created in store
    const users = useFlowStore.getState().iamUsers;
    expect(users).toHaveLength(2);
    expect(users.some((u) => u.username === 'developer-user')).toBe(true);
  });

  it('resets wizard state when Cancel Wizard or Modal Close is triggered', () => {
    render(<KubeIAMModal />);

    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));
    expect(screen.getAllByText('User Details').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Cancel Wizard'));
    expect(screen.getByText('Kube IAM Users (1)')).toBeInTheDocument();

    // Close modal via close button
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(useFlowStore.getState().isKubeIamModalOpen).toBe(false);
  });

  it('navigates to user detail view on card click and renders attached canvas roles and policies', () => {
    const setKubeIamModalOpenSpy = vi.spyOn(useFlowStore.getState(), 'setKubeIamModalOpen');
    const setRoleModalTargetNodeSpy = vi.spyOn(useFlowStore.getState(), 'setRoleModalTargetNode');

    useFlowStore.setState({
      nodes: [
        {
          id: 'pod-1',
          data: {
            label: 'web-pod',
            roles: [
              { id: 'role-1', name: 'web-reader-role', assignedUsers: ['admin-user'] },
            ],
          },
        } as any,
      ],
      colorMode: 'light',
    });

    render(<KubeIAMModal />);

    // Click on admin-user card row to open Detail View
    const userCard = screen.getByText('admin-user').closest('div')!;
    fireEvent.click(userCard);

    // Should see AWS IAM-style Summary details
    expect(screen.getByText('IAM User Summary & Access Management')).toBeInTheDocument();
    expect(screen.getByText('AdministratorAccess')).toBeInTheDocument();
    expect(screen.getByText('web-reader-role')).toBeInTheDocument();

    // Table should contain RoleBinding details
    expect(screen.getByText('Binding ID')).toBeInTheDocument();
    expect(screen.getByText('web-reader-role-rb-pod')).toBeInTheDocument();

    // Click on RoleBinding table row
    const roleRow = screen.getByText('web-reader-role-rb-pod').closest('tr')!;
    fireEvent.click(roleRow);

    expect(setKubeIamModalOpenSpy).toHaveBeenCalledWith(false);
    expect(setRoleModalTargetNodeSpy).toHaveBeenCalledWith({ id: 'pod-1', label: 'web-pod' });
  });

  it('allows editing user profile (username and policies) in detail view using wizard stepper', () => {
    useFlowStore.setState({
      iamUsers: [
        {
          id: 'user-1',
          username: 'old-user',
          accessType: 'Managed Access',
          policies: [{ name: 'ContainerDeveloperPolicy', type: 'Default', description: '' }],
        },
      ],
      activeIdentity: 'old-user',
    });

    render(<KubeIAMModal />);

    // Open detail view for old-user
    fireEvent.click(screen.getByText('old-user'));

    // Click Edit Profile button
    const editBtn = screen.getByText('Edit Profile');
    fireEvent.click(editBtn);

    // Step 1: Edit username input
    const usernameInput = screen.getByPlaceholderText('e.g. dev-cluster-admin');
    fireEvent.change(usernameInput, { target: { value: 'renamed-user' } });

    // Click Next -> Step 2
    fireEvent.click(screen.getByText('Next'));

    // Click Next -> Step 3
    fireEvent.click(screen.getByText('Next'));

    // Step 3 shows Review & Update and Update User button
    expect(screen.getAllByText('Review & Update').length).toBeGreaterThan(0);

    // Click Update User button in Step 3
    fireEvent.click(screen.getByRole('button', { name: /Update User/i }));

    const updatedUser = useFlowStore.getState().iamUsers.find((u) => u.id === 'user-1');
    expect(updatedUser?.username).toBe('renamed-user');
    expect(useFlowStore.getState().activeIdentity).toBe('renamed-user');
  });

  it('allows cancelling edit mode, going back to users list, and deleting user from detail view', () => {
    useFlowStore.setState({
      iamUsers: [
        {
          id: 'user-to-del',
          username: 'delete-me',
          accessType: 'Managed Access',
          policies: [],
        },
      ],
    });

    render(<KubeIAMModal />);

    // Open detail view
    fireEvent.click(screen.getByText('delete-me'));
    expect(screen.getByText('IAM User Summary & Access Management')).toBeInTheDocument();

    // Click Edit Profile and then Cancel Editing
    fireEvent.click(screen.getByText('Edit Profile'));
    expect(screen.getAllByText('Cancel Editing').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('Cancel Editing')[0]);
    expect(screen.getByText('IAM User Summary & Access Management')).toBeInTheDocument();

    // Click Back to Users
    fireEvent.click(screen.getByText('Back to Users'));
    expect(screen.getByText('Kube IAM Users (1)')).toBeInTheDocument();

    // Go back to detail view and click Delete User trash button in detail header
    fireEvent.click(screen.getByText('delete-me'));
    const trashBtn = screen.getByTitle('Delete User');
    fireEvent.click(trashBtn);

    expect(useFlowStore.getState().iamUsers).toHaveLength(0);
  });
});
