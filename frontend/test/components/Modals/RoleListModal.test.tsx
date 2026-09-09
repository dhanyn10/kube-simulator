import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { RoleListModal } from '@/components/Modals/RoleListModal';
import { useFlowStore } from '@/store';
import { K8sRoleItem } from '@/types';

describe('RoleListModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    targetNodeLabel: 'api-deployment',
    roles: [] as K8sRoleItem[],
    onEditRole: vi.fn(),
    onDeleteRole: vi.fn(),
    onAddNewRole: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({ colorMode: 'dark' });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<RoleListModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders empty message when no roles are attached', () => {
    render(<RoleListModal {...defaultProps} roles={[]} />);
    expect(screen.getByText('No roles attached to this node.')).toBeInTheDocument();
  });

  it('renders subtitle default fallback when targetNodeLabel is omitted', () => {
    render(<RoleListModal {...defaultProps} targetNodeLabel={undefined} />);
    expect(screen.getByText('Manage attached roles & RoleBindings')).toBeInTheDocument();
  });

  it('renders role without rules as "No rules defined"', () => {
    const roles: K8sRoleItem[] = [
      {
        id: 'r-1',
        name: 'empty-role',
        rules: [],
      },
    ];

    render(<RoleListModal {...defaultProps} roles={roles} />);
    expect(screen.getByText('empty-role')).toBeInTheDocument();
    expect(screen.getByText('No rules defined')).toBeInTheDocument();
  });

  it('renders role with single rule and multiple rules correctly, as well as bound subjects', () => {
    const roles: K8sRoleItem[] = [
      {
        id: 'r-1',
        name: 'single-rule-role',
        rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }],
        assignedUsers: ['user1'],
      },
      {
        id: 'r-2',
        name: 'multi-rule-role',
        rules: [
          { apiGroups: [''], resources: ['pods'], verbs: ['get'] },
          { apiGroups: [''], resources: ['services'], verbs: ['get'] },
        ],
        assignedUsers: ['user1', 'user2'],
      },
    ];

    render(<RoleListModal {...defaultProps} roles={roles} />);

    expect(screen.getByText('single-rule-role')).toBeInTheDocument();
    expect(screen.getByText(/1 rule \(pods\)/)).toBeInTheDocument();
    expect(screen.getByText('Bound Subjects (RoleBinding): user1')).toBeInTheDocument();

    expect(screen.getByText('multi-rule-role')).toBeInTheDocument();
    expect(screen.getByText(/2 rules \(pods; services\)/)).toBeInTheDocument();
    expect(screen.getByText('Bound Subjects (RoleBinding): user1, user2')).toBeInTheDocument();
  });

  it('triggers edit, delete, and add new actions', () => {
    const roles: K8sRoleItem[] = [
      {
        id: 'r-1',
        name: 'app-role',
        rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['*'] }],
      },
    ];

    render(<RoleListModal {...defaultProps} roles={roles} />);

    // Trigger edit
    const editBtn = screen.getByTitle('Edit Role');
    fireEvent.click(editBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onEditRole).toHaveBeenCalledWith(roles[0]);

    // Trigger delete
    const deleteBtn = screen.getByTitle('Delete Role');
    fireEvent.click(deleteBtn);
    expect(defaultProps.onDeleteRole).toHaveBeenCalledWith('r-1', 'app-role');

    // Trigger add new Role from footer
    const addBtn = screen.getByRole('button', { name: 'Add Role' });
    fireEvent.click(addBtn);
    expect(defaultProps.onAddNewRole).toHaveBeenCalled();
  });

  it('renders in light mode correctly', () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<RoleListModal {...defaultProps} />);
    expect(screen.getByText('Attached RBAC Roles & RoleBindings')).toBeInTheDocument();
  });
});
