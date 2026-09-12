import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { RoleUserOptionRow, RoleUserOptionRowProps } from '@/components/Modals/RoleModal/RoleUserOptionRow';
import { KubeIAMUser } from '@/types';

describe('RoleUserOptionRow', () => {
  const dummyUser: KubeIAMUser = {
    username: 'developer1',
    createdAt: Date.now(),
    policies: [
      { name: 'ReadOnlyAccess', description: 'Read only', statement: [] },
      { name: 'PodAdmin', description: 'Pod Admin', statement: [] },
    ],
  };

  const defaultProps: RoleUserOptionRowProps = {
    user: dummyUser,
    isChecked: false,
    isFullAccess: false,
    colorMode: 'dark',
    onToggle: vi.fn(),
  };

  it('renders unchecked row in dark mode without full access and displays policies', () => {
    const onToggle = vi.fn();

    render(
      <RoleUserOptionRow
        {...defaultProps}
        isChecked={false}
        isFullAccess={false}
        colorMode="dark"
        onToggle={onToggle}
      />
    );

    expect(screen.getByText('developer1')).toBeInTheDocument();
    expect(screen.getByText('ReadOnlyAccess')).toBeInTheDocument();
    expect(screen.getByText('PodAdmin')).toBeInTheDocument();
    expect(screen.queryByText('Full Access')).not.toBeInTheDocument();

    const button = screen.getByRole('button');
    fireEvent.mouseDown(button);
    expect(onToggle).toHaveBeenCalledWith('developer1');

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith('developer1');
  });

  it('renders checked row in light mode with full access badge', () => {
    const onToggle = vi.fn();

    render(
      <RoleUserOptionRow
        {...defaultProps}
        isChecked={true}
        isFullAccess={true}
        colorMode="light"
        onToggle={onToggle}
      />
    );

    expect(screen.getByText('developer1')).toBeInTheDocument();
    expect(screen.getByText('Full Access')).toBeInTheDocument();
    expect(screen.queryByText('ReadOnlyAccess')).not.toBeInTheDocument();

    const checkbox = screen.getByLabelText('Select developer1') as HTMLInputElement;
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
  });
});
