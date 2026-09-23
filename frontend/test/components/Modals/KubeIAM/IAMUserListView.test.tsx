import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { IAMUserListView, IAMUserListViewProps } from '@/components/Modals/KubeIAM/IAMUserListView';
import { useFlowStore } from '@/store';
import { KubeIAMUser } from '@/types';

describe('IAMUserListView', () => {
  const dummyUsers: KubeIAMUser[] = [
    {
      id: 'user-1',
      username: 'dev-user-1',
      accessType: 'Managed Access',
      policies: [{ name: 'ContainerDeveloperPolicy', type: 'Default', description: 'Dev policy' }],
    },
    {
      id: 'user-2',
      username: 'dev-user-2',
      accessType: 'Full Access',
      policies: [{ name: 'AdministratorAccess', type: 'Default', description: 'Admin policy' }],
    },
  ];

  const defaultProps: IAMUserListViewProps = {
    iamUsers: dummyUsers,
    filteredUsers: dummyUsers,
    searchFilter: '',
    colorMode: 'dark',
    onSearchChange: vi.fn(),
    onStartCreate: vi.fn(),
    onSelectUser: vi.fn(),
    onDeleteUser: vi.fn(),
  };

  beforeEach(() => {
    useFlowStore.setState({ activeIdentity: 'system:admin' });
  });

  it('renders list header, search input, system:admin card, and user list in dark mode', () => {
    render(<IAMUserListView {...defaultProps} />);

    expect(screen.getByText('Kube IAM Users (2)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter users by name...')).toBeInTheDocument();
    expect(screen.getByText('system:admin')).toBeInTheDocument();
    expect(screen.getByText('dev-user-1')).toBeInTheDocument();
    expect(screen.getByText('dev-user-2')).toBeInTheDocument();
  });

  it('renders in light mode and handles search input changes', () => {
    const onSearchChange = vi.fn();

    render(
      <IAMUserListView
        {...defaultProps}
        colorMode="light"
        onSearchChange={onSearchChange}
      />
    );

    expect(screen.getByText('Kube IAM Users (2)')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Filter users by name...');
    fireEvent.change(searchInput, { target: { value: 'dev-user-1' } });
    expect(onSearchChange).toHaveBeenCalledWith('dev-user-1');
  });

  it('renders no users match filter message in dark and light modes when filteredUsers is empty with searchFilter present', () => {
    const { rerender } = render(
      <IAMUserListView
        {...defaultProps}
        filteredUsers={[]}
        searchFilter="nonexistent"
        colorMode="dark"
      />
    );

    expect(screen.getByText('No users match your filter')).toBeInTheDocument();

    rerender(
      <IAMUserListView
        {...defaultProps}
        filteredUsers={[]}
        searchFilter="nonexistent"
        colorMode="light"
      />
    );

    expect(screen.getByText('No users match your filter')).toBeInTheDocument();
  });

  it('does not render search input when iamUsers is empty', () => {
    render(
      <IAMUserListView
        {...defaultProps}
        iamUsers={[]}
        filteredUsers={[]}
        searchFilter=""
      />
    );

    expect(screen.getByText('Kube IAM Users (0)')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Filter users by name...')).not.toBeInTheDocument();
  });
});
