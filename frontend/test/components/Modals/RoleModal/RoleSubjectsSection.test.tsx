import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleSubjectsSection } from '@/components/Modals/RoleModal/RoleSubjectsSection';
import { KubeIAMUser } from '@/types';
import '@testing-library/jest-dom';

describe('RoleSubjectsSection', () => {
  const dummyUsers: KubeIAMUser[] = [
    {
      id: 'u1',
      username: 'dev-alice',
      accessType: 'Full Access',
      policies: [],
    },
    {
      id: 'u2',
      username: 'dev-bob',
      accessType: 'Managed Access',
      policies: [{ id: 'p1', name: 'ContainerDeveloperPolicy', description: '' }],
    },
  ];

  const defaultProps = {
    colorMode: 'dark',
    assignedUsers: ['dev-alice'],
    userSearchQuery: '',
    onSearchChange: vi.fn(),
    isUserDropdownOpen: false,
    onDropdownOpenChange: vi.fn(),
    userDropdownRef: React.createRef<HTMLDivElement>(),
    filteredAvailableUsers: dummyUsers,
    onToggleAssignment: vi.fn(),
    onOpenIamModal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders assigned user badges, handles input focus/change, and user assignment clicks', () => {
    render(<RoleSubjectsSection {...defaultProps} iamUsers={dummyUsers} />);

    expect(screen.getByText('dev-alice')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Add user...');
    fireEvent.focus(input);
    expect(defaultProps.onDropdownOpenChange).toHaveBeenCalledWith(true);

    fireEvent.change(input, { target: { value: 'bob' } });
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('bob');
  });

  it('renders dropdown list when open and handles user option selection', () => {
    const props = {
      ...defaultProps,
      iamUsers: dummyUsers,
      isUserDropdownOpen: true,
      userSearchQuery: 'bob',
      filteredAvailableUsers: [dummyUsers[1]],
    };

    render(<RoleSubjectsSection {...props} />);

    const bobRow = screen.getByText('dev-bob');
    fireEvent.click(bobRow);
    expect(defaultProps.onToggleAssignment).toHaveBeenCalledWith('dev-bob');
  });

  it('renders empty list message and Kube IAM button when no users match search filter', () => {
    const props = {
      ...defaultProps,
      iamUsers: dummyUsers,
      isUserDropdownOpen: true,
      filteredAvailableUsers: [],
    };

    render(<RoleSubjectsSection {...props} />);

    expect(screen.getByText('No matching IAM users available for this card type.')).toBeInTheDocument();

    const openIamBtn = screen.getByRole('button', { name: /Manage Kube IAM Users/i });
    fireEvent.click(openIamBtn);
    expect(defaultProps.onOpenIamModal).toHaveBeenCalled();
  });
});
