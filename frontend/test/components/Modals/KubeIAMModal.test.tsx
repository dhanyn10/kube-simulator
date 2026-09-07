import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders correctly when open with initial user list', () => {
    render(<KubeIAMModal />);

    expect(screen.getByText('Kube IAM Management')).toBeInTheDocument();
    expect(screen.getByText('Kube IAM Users (1)')).toBeInTheDocument();
    expect(screen.getByText('admin-user')).toBeInTheDocument();
    expect(screen.getByText('Full Access')).toBeInTheDocument();
  });

  it('filters users by search query', () => {
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
  });

  it('deletes user when trash icon button is clicked', () => {
    render(<KubeIAMModal />);

    const deleteBtn = screen.getByTitle('Delete User');
    fireEvent.click(deleteBtn);

    expect(useFlowStore.getState().iamUsers).toHaveLength(0);
  });

  it('navigates wizard steps and validates username in Step 1', () => {
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

    // Enter existing username -> error
    const userInput = screen.getByPlaceholderText('e.g. dev-cluster-admin');
    fireEvent.change(userInput, { target: { value: 'admin-user' } });
    fireEvent.click(nextBtn);

    expect(screen.getByText('Username already exists')).toBeInTheDocument();

    // Enter valid new username -> proceeds to Step 2
    fireEvent.change(userInput, { target: { value: 'new-dev' } });
    fireEvent.click(nextBtn);

    expect(screen.getAllByText('Set Permissions').length).toBeGreaterThan(0);
  });

  it('handles policy search and mutual policy selection rules in Step 2', () => {
    render(<KubeIAMModal />);

    // Start wizard and proceed to Step 2
    fireEvent.click(screen.getByRole('button', { name: /Create User/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. dev-cluster-admin'), {
      target: { value: 'new-dev' },
    });
    fireEvent.click(screen.getByText('Next'));

    // Step 2 is active with AdministratorAccess selected by default
    const adminCheckbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    expect(adminCheckbox).toBeChecked();

    // Other policy checkboxes should be disabled when AdministratorAccess is selected
    const readOnlyCheckbox = screen.getAllByRole('checkbox')[1] as HTMLInputElement;
    expect(readOnlyCheckbox).toBeDisabled();

    // Click AdministratorAccess row to uncheck it
    const adminRow = screen.getByText('AdministratorAccess').closest('tr')!;
    fireEvent.click(adminRow);

    expect(adminCheckbox).not.toBeChecked();
    expect(readOnlyCheckbox).not.toBeDisabled();

    // Click ReadOnlyAccess row to check it
    const readOnlyRow = screen.getByText('ReadOnlyAccess').closest('tr')!;
    fireEvent.click(readOnlyRow);

    expect(readOnlyCheckbox).toBeChecked();
    expect(adminCheckbox).toBeDisabled();

    // Test policy search filter
    const policySearchInput = screen.getByPlaceholderText('Search policies...');
    fireEvent.change(policySearchInput, { target: { value: 'Container' } });

    expect(screen.getByText('ContainerDeveloperPolicy')).toBeInTheDocument();
    expect(screen.queryByText('ReadOnlyAccess')).not.toBeInTheDocument();
  });

  it('completes user creation wizard through Step 3', () => {
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
  });
});
