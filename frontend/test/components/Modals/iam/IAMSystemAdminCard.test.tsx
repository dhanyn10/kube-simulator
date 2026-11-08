import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IAMSystemAdminCard } from '@/components/Modals/iam/IAMSystemAdminCard';

describe('IAMSystemAdminCard', () => {
  it('renders active system admin card with disabled active indicator', () => {
    const onSelectActive = vi.fn();

    render(
      <IAMSystemAdminCard
        isActive={true}
        isDark={true}
        onSelectActive={onSelectActive}
      />
    );

    expect(screen.getByText('system:admin')).toBeDefined();
    expect(screen.getByText('Cluster Admin')).toBeDefined();
    expect(screen.getByText('Active Profile')).toBeDefined();

    const btn = screen.getByTestId('use-profile-btn-system-admin') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('renders inactive system admin card in light mode and handles activation click', () => {
    const onSelectActive = vi.fn();

    render(
      <IAMSystemAdminCard
        isActive={false}
        isDark={false}
        onSelectActive={onSelectActive}
      />
    );

    expect(screen.getByText('Use this profile')).toBeDefined();

    const btn = screen.getByTestId('use-profile-btn-system-admin');
    fireEvent.click(btn);
    expect(onSelectActive).toHaveBeenCalledWith('system:admin');
  });
});
