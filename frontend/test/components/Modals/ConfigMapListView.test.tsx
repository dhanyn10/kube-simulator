import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ConfigMapListView, getInitialColumnVisibility } from '@/components/Modals/ConfigMapListView';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';

describe('ConfigMapListView', () => {
  const mockOnSearchChange = vi.fn();
  const mockOnEditItem = vi.fn();
  const mockOnDeleteItem = vi.fn();

  const mockItems: OverviewItem[] = [
    { id: 'cm-1', name: 'app-config', rawItem: { id: 'cm-1', name: 'app-config', configData: [] }, ownerNode: { id: 'pod-1', label: 'frontend-pod', type: 'Pod' }, profileName: 'autosave-session-1' },
    { id: 'cm-2', name: 'db-config', rawItem: { id: 'cm-2', name: 'db-config', configData: [] }, ownerNode: { id: 'deploy-1', label: 'database-deployment', type: 'Deployment' }, profileName: 'autosave-session-1' },
    { id: 'cm-3', name: 'global-config', rawItem: { id: 'cm-3', name: 'global-config', configData: [] }, ownerNode: { id: 'cluster-storage', label: 'Cluster Storage', type: 'ConfigMap' }, profileName: 'autosave-session-1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage.clear();
  });

  it('renders table headers and rows with Profile and Component columns by default', () => {
    render(
      <ConfigMapListView
        search=""
        onSearchChange={mockOnSearchChange}
        items={mockItems}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    // Headers
    expect(screen.getByText('ConfigMap Name')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Component' })).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Rows
    expect(screen.getByText('app-config')).toBeInTheDocument();
    expect(screen.getByText('frontend-pod')).toBeInTheDocument();
    expect(screen.getByText('db-config')).toBeInTheDocument();
    expect(screen.getByText('database-deployment')).toBeInTheDocument();
    expect(screen.getByTestId('cm-resource-cm-3')).toHaveTextContent('-');
    expect(screen.queryByText('Cluster Storage')).not.toBeInTheDocument();
  });

  it('toggles column dropdown and hides/shows Profile and Component columns with checkmark buttons', () => {
    render(
      <ConfigMapListView
        search=""
        onSearchChange={mockOnSearchChange}
        items={mockItems}
        isDark={false}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    const toggleBtn = screen.getByTestId('column-visibility-toggle-btn');
    fireEvent.click(toggleBtn);

    // Dropdown should be open without "Visible Columns" header
    expect(screen.getByTestId('column-visibility-menu')).toBeInTheDocument();
    expect(screen.queryByText('Visible Columns')).not.toBeInTheDocument();

    const profileToggle = screen.getByTestId('column-toggle-profile');
    const componentToggle = screen.getByTestId('column-toggle-component');
    expect(profileToggle).toHaveAttribute('aria-checked', 'true');
    expect(componentToggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('check-profile')).toBeInTheDocument();
    expect(screen.getByTestId('check-component')).toBeInTheDocument();

    // Toggle off Profile
    fireEvent.click(profileToggle);
    expect(profileToggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByTestId('check-profile')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Profile' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('cm-profile-cm-1')).not.toBeInTheDocument();

    // Toggle off Component
    fireEvent.click(componentToggle);
    expect(componentToggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByTestId('check-component')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Component' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('cm-resource-cm-1')).not.toBeInTheDocument();

    // Re-check Profile
    fireEvent.click(profileToggle);
    expect(profileToggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('check-profile')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByTestId('cm-profile-cm-1')).toBeInTheDocument();
  });

  it('closes column dropdown when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside-element">Outside</div>
        <ConfigMapListView
          search=""
          onSearchChange={mockOnSearchChange}
          items={mockItems}
          isDark={true}
          onEditItem={mockOnEditItem}
          onDeleteItem={mockOnDeleteItem}
        />
      </div>
    );

    const toggleBtn = screen.getByTestId('column-visibility-toggle-btn');
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('column-visibility-menu')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside-element'));
    expect(screen.queryByTestId('column-visibility-menu')).not.toBeInTheDocument();
  });

  it('handles search input and action buttons (edit and delete)', () => {
    render(
      <ConfigMapListView
        search="test"
        onSearchChange={mockOnSearchChange}
        items={mockItems}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search ConfigMap/i);
    fireEvent.change(searchInput, { target: { value: 'app' } });
    expect(mockOnSearchChange).toHaveBeenCalledWith('app');

    const editBtn = screen.getByTitle('Edit ConfigMap app-config');
    fireEvent.click(editBtn);
    expect(mockOnEditItem).toHaveBeenCalledWith(mockItems[0]);

    const deleteBtn = screen.getByTitle('Delete ConfigMap app-config');
    fireEvent.click(deleteBtn);
    expect(mockOnDeleteItem).toHaveBeenCalledWith(mockItems[0]);
  });

  it('renders empty state with appropriate message when no items match', () => {
    render(
      <ConfigMapListView
        search=""
        onSearchChange={mockOnSearchChange}
        items={[]}
        isDark={false}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
      />
    );

    expect(
      screen.getByText('No ConfigMaps available. Click "+ Add ConfigMap" below to create one.')
    ).toBeInTheDocument();
  });

  it('tests getInitialColumnVisibility helper with valid and invalid localStorage data', () => {
    // Default
    expect(getInitialColumnVisibility()).toEqual({ profile: true, component: true });

    // Valid saved
    globalThis.localStorage.setItem('k8s_configmap_table_columns', JSON.stringify({ profile: false, component: true }));
    expect(getInitialColumnVisibility()).toEqual({ profile: false, component: true });

    // Invalid JSON
    globalThis.localStorage.setItem('k8s_configmap_table_columns', 'invalid-json');
    expect(getInitialColumnVisibility()).toEqual({ profile: true, component: true });
  });

  it('calls onSelectProfile when clicking profile badge button', () => {
    const mockOnSelectProfile = vi.fn();
    render(
      <ConfigMapListView
        search=""
        onSearchChange={mockOnSearchChange}
        items={mockItems}
        isDark={true}
        onEditItem={mockOnEditItem}
        onDeleteItem={mockOnDeleteItem}
        onSelectProfile={mockOnSelectProfile}
      />
    );

    const profileBadgeBtn = screen.getByTestId('cm-profile-cm-1');
    expect(profileBadgeBtn).toBeInTheDocument();
    fireEvent.click(profileBadgeBtn);

    expect(mockOnSelectProfile).toHaveBeenCalledWith('autosave-session-1');
  });
});
