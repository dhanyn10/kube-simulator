import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { IAMUserEditView, IAMUserEditViewProps } from '@/components/Modals/KubeIAM/IAMUserEditView';
import { KubeIAMUser } from '@/types';

describe('IAMUserEditView', () => {
  const dummyUser: KubeIAMUser = {
    username: 'developer1',
    createdAt: Date.now(),
    policies: [
      {
        name: 'ReadOnlyAccess',
        description: 'Read-only access to K8s resources',
        statement: [{ effect: 'Allow', action: ['get', 'list'], resource: ['*'] }],
      },
    ],
  };

  const defaultProps: IAMUserEditViewProps = {
    user: dummyUser,
    isDark: true,
    onCancel: vi.fn(),
    onFinish: vi.fn(),
  };

  it('renders edit view in dark mode, displays initial username, and handles Cancel button click', () => {
    const onCancel = vi.fn();

    render(<IAMUserEditView {...defaultProps} isDark={true} onCancel={onCancel} />);

    expect(screen.getByText('Edit User Profile (developer1)')).toBeInTheDocument();

    const cancelBtn = screen.getAllByRole('button', { name: /Cancel Editing/i })[0];
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });

  it('navigates through edit steps (Step 1 -> Step 2 -> Step 3) and finishes editing', () => {
    const onFinish = vi.fn();

    render(<IAMUserEditView {...defaultProps} isDark={false} onFinish={onFinish} />);

    // Step 1: Username input
    const usernameInput = screen.getByDisplayValue('developer1');
    fireEvent.change(usernameInput, { target: { value: 'dev_updated' } });

    // Click Next
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    // Step 2: Policy selection
    expect(screen.getByPlaceholderText('Search policies...')).toBeInTheDocument();

    // Search and toggle a policy
    const searchInput = screen.getByPlaceholderText('Search policies...');
    fireEvent.change(searchInput, { target: { value: 'Admin' } });

    const adminBtn = screen.getByRole('button', { name: 'AdministratorAccess' });
    fireEvent.click(adminBtn);

    // Click Next
    const nextBtnStep2 = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtnStep2);

    // Step 3: Review profile
    const finishBtn = screen.getByRole('button', { name: /Update User/i });
    expect(finishBtn).toBeInTheDocument();

    fireEvent.click(finishBtn);

    expect(onFinish).toHaveBeenCalledWith('dev_updated', expect.any(Array));
  });

  it('handles stepping back from Step 2 to Step 1', () => {
    render(<IAMUserEditView {...defaultProps} />);

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(screen.getByPlaceholderText('Search policies...')).toBeInTheDocument();

    // Step 2 -> Step 1 via Back button
    const backBtn = screen.getByRole('button', { name: /Previous/i });
    fireEvent.click(backBtn);
    expect(screen.getByDisplayValue('developer1')).toBeInTheDocument();
  });
});
