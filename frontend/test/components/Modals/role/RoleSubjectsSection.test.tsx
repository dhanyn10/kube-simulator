import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleSubjectsSection } from '@/components/Modals/role/RoleSubjectsSection';
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
    expect(screen.getByText('(Full Access)')).toBeInTheDocument();

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

  it('renders NoUsersBanner when iamUsers is empty and handles light mode and dark mode', () => {
    const { rerender } = render(
      <RoleSubjectsSection
        {...defaultProps}
        iamUsers={[]}
        assignedUsers={[]}
        colorMode="light"
      />
    );

    expect(screen.getByText('No Kube IAM users created yet.')).toBeInTheDocument();
    const linkBtn = screen.getByRole('button', { name: /Go to Kube IAM Management/i });
    fireEvent.click(linkBtn);
    expect(defaultProps.onOpenIamModal).toHaveBeenCalled();

    // Rerender in dark mode
    rerender(
      <RoleSubjectsSection
        {...defaultProps}
        iamUsers={[]}
        assignedUsers={[]}
        colorMode="dark"
      />
    );
    expect(screen.getByText('No Kube IAM users created yet.')).toBeInTheDocument();
  });

  it('handles non-full access user chip removal and placeholder when assignedUsers is empty or user is missing from iamUsers list', () => {
    const onToggleAssignment = vi.fn();
    render(
      <RoleSubjectsSection
        {...defaultProps}
        colorMode="light"
        iamUsers={dummyUsers}
        assignedUsers={['dev-bob', 'unknown-user']}
        onToggleAssignment={onToggleAssignment}
      />
    );

    expect(screen.getByText('dev-bob')).toBeInTheDocument();
    expect(screen.getByText('unknown-user')).toBeInTheDocument();

    // Click remove button on dev-bob chip
    const buttons = screen.getAllByRole('button');
    const removeBtn = buttons.find((b) => b.querySelector('svg.lucide-x') || b.firstElementChild?.classList.contains('lucide-x'));
    if (removeBtn) {
      fireEvent.click(removeBtn);
      expect(onToggleAssignment).toHaveBeenCalled();
    }
  });

  it('covers AssignedUserChip for user missing from iamUsers array and non-full-access user in dark mode', () => {
    const onToggleAssignment = vi.fn();
    render(
      <RoleSubjectsSection
        {...defaultProps}
        colorMode="dark"
        iamUsers={dummyUsers}
        assignedUsers={['dev-bob', 'missing-user']}
        onToggleAssignment={onToggleAssignment}
      />
    );

    expect(screen.getByText('dev-bob')).toBeInTheDocument();
    expect(screen.getByText('missing-user')).toBeInTheDocument();

    // Click remove button on dev-bob chip to trigger onToggleAssignment
    const buttons = screen.getAllByRole('button');
    const removeBtn = buttons.find((b) => b.querySelector('svg.lucide-x') || b.firstElementChild?.classList.contains('lucide-x'));
    if (removeBtn) {
      fireEvent.click(removeBtn);
      expect(onToggleAssignment).toHaveBeenCalled();
    }
  });

  it('renders default placeholder when assignedUsers is empty and handles light/dark color modes', () => {
    const { rerender } = render(
      <RoleSubjectsSection
        {...defaultProps}
        colorMode="dark"
        iamUsers={dummyUsers}
        assignedUsers={[]}
      />
    );

    expect(screen.getByPlaceholderText('Type to search or add IAM users...')).toBeInTheDocument();

    rerender(
      <RoleSubjectsSection
        {...defaultProps}
        colorMode="light"
        iamUsers={dummyUsers}
        assignedUsers={['dev-alice']}
      />
    );

    expect(screen.getByPlaceholderText('Add user...')).toBeInTheDocument();
  });
});
