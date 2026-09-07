import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KubeIAMModal } from '@/components/Modals/KubeIAMModal';
import { useFlowStore } from '@/store';

describe('KubeIAMModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      iamUsers: [
        { id: 'u1', username: 'admin-user', accessType: 'Full', createdAt: Date.now() },
        { id: 'u2', username: 'dev-user', accessType: 'Custom', createdAt: Date.now() },
      ],
    });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<KubeIAMModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Step 1 (User Details) with stepper and active users list', () => {
    render(<KubeIAMModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: /Kube IAM/i })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('User Details')).toBeInTheDocument();

    expect(screen.getByText('admin-user')).toBeInTheDocument();
    expect(screen.getByText('dev-user')).toBeInTheDocument();
  });

  it('navigates through 3-step wizard and creates new IAM user', () => {
    render(<KubeIAMModal {...defaultProps} />);

    // Step 1: Fill Username
    const usernameInput = screen.getByPlaceholderText(/e\.g\. dev-user/i);
    fireEvent.change(usernameInput, { target: { value: 'auditor-user' } });

    const nextBtn1 = screen.getByRole('button', { name: /Next: Set Permissions/i });
    fireEvent.click(nextBtn1);

    // Step 2: Policy Autocomplete - type "Admin" to view suggestion
    const policyInput = screen.getByPlaceholderText(/e\.g\. Type 'Admin'/i);
    fireEvent.change(policyInput, { target: { value: 'Admin' } });

    // Click policy suggestion
    const option = screen.getByText('AdministratorAccess');
    fireEvent.click(option);

    const nextBtn2 = screen.getByRole('button', { name: /Next: Review/i });
    fireEvent.click(nextBtn2);

    // Step 3: Review & Finalize
    expect(screen.getByText('auditor-user')).toBeInTheDocument();

    const createBtn = screen.getByRole('button', { name: /Create IAM User Account/i });
    fireEvent.click(createBtn);

    // Verify user was added to Zustand store
    const storeUsers = useFlowStore.getState().iamUsers;
    expect(storeUsers.some((u) => u.username === 'auditor-user')).toBe(true);
  });

  it('deletes an IAM user account when delete button is clicked', () => {
    render(<KubeIAMModal {...defaultProps} />);

    const deleteButtons = screen.getAllByTitle('Delete User');
    expect(deleteButtons.length).toBeGreaterThan(0);

    fireEvent.click(deleteButtons[0]);

    const storeUsers = useFlowStore.getState().iamUsers;
    expect(storeUsers.some((u) => u.username === 'admin-user')).toBe(false);
  });

  it('prevents adding duplicate username', () => {
    render(<KubeIAMModal {...defaultProps} />);

    // Step 1: Input existing username "admin-user"
    const usernameInput = screen.getByPlaceholderText(/e\.g\. dev-user/i);
    fireEvent.change(usernameInput, { target: { value: 'admin-user' } });

    fireEvent.click(screen.getByRole('button', { name: /Next: Set Permissions/i }));

    const policyInput = screen.getByPlaceholderText(/e\.g\. Type 'Admin'/i);
    fireEvent.change(policyInput, { target: { value: 'Admin' } });

    fireEvent.click(screen.getByRole('button', { name: /Next: Review/i }));

    const initialLength = useFlowStore.getState().iamUsers.length;
    fireEvent.click(screen.getByRole('button', { name: /Create IAM User Account/i }));

    expect(useFlowStore.getState().iamUsers.length).toBe(initialLength);
  });
});
