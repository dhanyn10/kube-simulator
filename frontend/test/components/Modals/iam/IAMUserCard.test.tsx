import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IAMUserCard } from '@/components/Modals/iam/IAMUserCard';
import { KubeIAMUser } from '@/types';

describe('IAMUserCard', () => {
  const sampleUser: KubeIAMUser = {
    id: 'user-1',
    username: 'developer-jane',
    accessType: 'Full Access',
    policies: [
      { name: 'pod-reader', description: 'Read pods', rules: [] },
    ],
  };

  it('renders active user card in dark mode with active profile indicator', () => {
    const onSelectUser = vi.fn();
    const onSelectActive = vi.fn();
    const onDeleteUser = vi.fn();

    render(
      <IAMUserCard
        user={sampleUser}
        isActive={true}
        isDark={true}
        onSelectUser={onSelectUser}
        onSelectActive={onSelectActive}
        onDeleteUser={onDeleteUser}
      />
    );

    expect(screen.getByText('developer-jane')).toBeDefined();
    expect(screen.getByText('Full Access')).toBeDefined();
    expect(screen.getByText('Active Profile')).toBeDefined();

    const activeBtn = screen.getByTestId('use-profile-btn-developer-jane') as HTMLButtonElement;
    expect(activeBtn.disabled).toBe(true);

    // Clicking details invokes onSelectUser
    fireEvent.click(screen.getByText('developer-jane'));
    expect(onSelectUser).toHaveBeenCalledWith(sampleUser);
  });

  it('renders inactive user card with custom access in light mode and handles action buttons', () => {
    const onSelectUser = vi.fn();
    const onSelectActive = vi.fn();
    const onDeleteUser = vi.fn();

    const customUser: KubeIAMUser = {
      id: 'user-2',
      username: 'auditor-bob',
      accessType: 'Custom Access',
      policies: [],
    };

    render(
      <IAMUserCard
        user={customUser}
        isActive={false}
        isDark={false}
        onSelectUser={onSelectUser}
        onSelectActive={onSelectActive}
        onDeleteUser={onDeleteUser}
      />
    );

    expect(screen.getByText('auditor-bob')).toBeDefined();
    expect(screen.getByText('Custom Access')).toBeDefined();
    expect(screen.getByText('0 attached policy / policies • Click for details')).toBeDefined();

    // Click "Use this profile"
    const useBtn = screen.getByTestId('use-profile-btn-auditor-bob');
    fireEvent.click(useBtn);
    expect(onSelectActive).toHaveBeenCalledWith('auditor-bob');

    // Click Delete button
    const deleteBtn = screen.getByTitle('Delete User');
    fireEvent.click(deleteBtn);
    expect(onDeleteUser).toHaveBeenCalledWith('user-2');

    // Click View details chevron
    const detailsBtn = screen.getByLabelText('View details for auditor-bob');
    fireEvent.click(detailsBtn);
    expect(onSelectUser).toHaveBeenCalledWith(customUser);
  });
});
