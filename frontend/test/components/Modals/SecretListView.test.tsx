import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  SecretListView,
  getInitialSecretColumnVisibility,
} from '@/components/Modals/SecretListView';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';

describe('SecretListView', () => {
  const mockOnSearchChange = vi.fn();
  const mockOnEditItem = vi.fn();
  const mockOnDeleteItem = vi.fn();

  const sampleItems: OverviewItem[] = [
    {
      id: 'sec-1',
      name: 'api-secret',
      profileName: 'staging-profile',
      rawItem: { id: 'sec-1', name: 'api-secret', secretData: [{ key: 'TOKEN', value: 'xyz' }] },
      ownerNode: { id: 'pod-1', label: 'api-pod', type: 'Pod' },
    },
    {
      id: 'sec-2',
      name: 'db-password',
      profileName: 'Default Profile',
      rawItem: { id: 'sec-2', name: 'db-password', secretData: [] },
      ownerNode: { id: 'cluster-storage', label: 'Cluster Storage', type: 'Node' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage.clear();
  });

  it('getInitialSecretColumnVisibility parses valid stored columns and falls back to defaults', () => {
    expect(getInitialSecretColumnVisibility()).toEqual({ profile: true, component: true });

    globalThis.localStorage.setItem(
      'k8s_secret_table_columns',
      JSON.stringify({ profile: false, component: true })
    );
    expect(getInitialSecretColumnVisibility()).toEqual({ profile: false, component: true });

    globalThis.localStorage.setItem('k8s_secret_table_columns', 'invalid-json');
    expect(getInitialSecretColumnVisibility()).toEqual({ profile: true, component: true });
  });

  it('renders table with columns, items, and search input', () => {
    render(
      <SecretListView
        search=""
        onSearchChange={mockOnSearchChange}
        items={sampleItems}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    expect(screen.getByPlaceholderText(/Search Secret by name/i)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Secret Name' })).toBeInTheDocument();
    expect(screen.getByText('api-secret')).toBeInTheDocument();
    expect(screen.getByText('db-password')).toBeInTheDocument();
    expect(screen.getByTestId('sec-resource-sec-1')).toHaveTextContent('Pod:api-pod');
    expect(screen.getByTestId('sec-resource-sec-2')).toHaveTextContent('-');
  });

  it('triggers onSearchChange when typing in search input', () => {
    render(
      <SecretListView
        search=""
        onSearchChange={mockOnSearchChange}
        items={sampleItems}
        isDark={false}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    const input = screen.getByPlaceholderText(/Search Secret by name/i);
    fireEvent.change(input, { target: { value: 'api' } });
    expect(mockOnSearchChange).toHaveBeenCalledWith('api');
  });

  it('toggles column visibility dropdown and changes column visibility', () => {
    render(
      <SecretListView
        search=""
        onSearchChange={mockOnSearchChange}
        items={sampleItems}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    // Open dropdown
    const toggleBtn = screen.getByTestId('secret-column-visibility-toggle-btn');
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId('secret-column-visibility-menu')).toBeInTheDocument();

    // Toggle profile column off
    const profileToggle = screen.getByTestId('secret-column-toggle-profile');
    fireEvent.click(profileToggle);

    // Profile table header should now be hidden
    expect(screen.queryByRole('columnheader', { name: 'Profile' })).toBeNull();

    // Toggle component column off
    const componentToggle = screen.getByTestId('secret-column-toggle-component');
    fireEvent.click(componentToggle);
    expect(screen.queryByRole('columnheader', { name: 'Component' })).toBeNull();

    // Close dropdown on outside click
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('secret-column-visibility-menu')).toBeNull();
  });

  it('triggers onEditItem and onDeleteItem when action buttons are clicked', () => {
    render(
      <SecretListView
        search=""
        onSearchChange={mockOnSearchChange}
        items={sampleItems}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    const editBtn = screen.getByTitle('Edit Secret api-secret');
    fireEvent.click(editBtn);
    expect(mockOnEditItem).toHaveBeenCalledWith(sampleItems[0]);

    const deleteBtn = screen.getByTitle('Delete Secret api-secret');
    fireEvent.click(deleteBtn);
    expect(mockOnDeleteItem).toHaveBeenCalledWith(sampleItems[0]);
  });

  it('renders empty state when items array is empty', () => {
    render(
      <SecretListView
        search=""
        onSearchChange={mockOnSearchChange}
        items={[]}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    expect(
      screen.getByText(/No Secrets available. Click "\+ Add Secret" below to create one./i)
    ).toBeInTheDocument();
  });
});
