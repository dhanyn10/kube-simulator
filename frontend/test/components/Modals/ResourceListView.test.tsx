import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ResourceListView,
  getInitialResourceColumnVisibility,
} from '@/components/Modals/ResourceListView';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import { Database } from 'lucide-react';

describe('ResourceListView', () => {
  const mockStorageKey = 'test_resource_cols';

  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getInitialResourceColumnVisibility', () => {
    it('returns default { profile: true, component: true } when localStorage has no entry or invalid JSON', () => {
      expect(getInitialResourceColumnVisibility(mockStorageKey)).toEqual({
        profile: true,
        component: true,
      });

      globalThis.localStorage.setItem(mockStorageKey, 'not-valid-json');
      expect(getInitialResourceColumnVisibility(mockStorageKey)).toEqual({
        profile: true,
        component: true,
      });

      globalThis.localStorage.setItem(mockStorageKey, JSON.stringify({ profile: 'not-bool' }));
      expect(getInitialResourceColumnVisibility(mockStorageKey)).toEqual({
        profile: true,
        component: true,
      });
    });

    it('returns parsed values when valid JSON is present in localStorage', () => {
      globalThis.localStorage.setItem(
        mockStorageKey,
        JSON.stringify({ profile: false, component: true })
      );
      expect(getInitialResourceColumnVisibility(mockStorageKey)).toEqual({
        profile: false,
        component: true,
      });
    });
  });

  describe('ResourceListView Component', () => {
    const sampleItems: OverviewItem[] = [
      {
        id: 'cm-item-1',
        name: 'app-config',
        profileName: 'Production Profile',
        ownerNode: {
          id: 'dep-1',
          type: 'Deployment',
          label: 'Web Backend',
        },
        data: {},
      },
      {
        id: 'cm-item-2',
        name: 'orphaned-config',
        profileName: 'Default Profile',
        ownerNode: {
          id: '',
          type: 'Cluster',
          label: '',
        },
        data: {},
      },
    ];

    it('renders empty state when items list is empty', () => {
      render(
        <ResourceListView
          resourceType="ConfigMap"
          storageKey={mockStorageKey}
          search=""
          onSearchChange={vi.fn()}
          items={[]}
          isDark={true}
          emptyIcon={Database}
          onEditItem={vi.fn()}
          onDeleteItem={vi.fn()}
        />
      );

      expect(screen.getByText(/No ConfigMaps available/i)).toBeDefined();
    });

    it('renders table with items, search input, actions, and column toggling', () => {
      const onSearchChange = vi.fn();
      const onEditItem = vi.fn();
      const onDeleteItem = vi.fn();
      const onSelectProfile = vi.fn();

      render(
        <ResourceListView
          resourceType="ConfigMap"
          storageKey={mockStorageKey}
          search="app"
          onSearchChange={onSearchChange}
          items={sampleItems}
          isDark={true}
          emptyIcon={Database}
          onEditItem={onEditItem}
          onDeleteItem={onDeleteItem}
          onSelectProfile={onSelectProfile}
          accentColor="teal"
        />
      );

      // Verify item rows
      expect(screen.getByText('app-config')).toBeDefined();
      expect(screen.getByText('orphaned-config')).toBeDefined();

      // Search input typing
      const searchInput = screen.getByPlaceholderText(/Search ConfigMap by name/i);
      fireEvent.change(searchInput, { target: { value: 'test-query' } });
      expect(onSearchChange).toHaveBeenCalledWith('test-query');

      // Edit action
      const editButtons = screen.getAllByTitle(/Edit ConfigMap/i);
      fireEvent.click(editButtons[0]);
      expect(onEditItem).toHaveBeenCalledWith(sampleItems[0]);

      // Delete action
      const deleteButtons = screen.getAllByTitle(/Delete ConfigMap/i);
      fireEvent.click(deleteButtons[0]);
      expect(onDeleteItem).toHaveBeenCalledWith(sampleItems[0]);

      // Click Profile badge
      const profileBtn = screen.getByTestId('cm-profile-cm-item-1');
      fireEvent.click(profileBtn);
      expect(onSelectProfile).toHaveBeenCalledWith('Production Profile');

      // Column visibility dropdown
      const colToggleBtn = screen.getByTestId('column-visibility-toggle-btn');
      fireEvent.click(colToggleBtn);

      const colMenu = screen.getByTestId('column-visibility-menu');
      expect(colMenu).toBeDefined();

      // Trigger outside mousedown to close dropdown
      fireEvent.mouseDown(document.body);
      expect(screen.queryByTestId('column-visibility-menu')).toBeNull();

      // Re-open dropdown
      fireEvent.click(colToggleBtn);

      // Toggle profile column off
      const toggleProfileBtn = screen.getByTestId('column-toggle-profile');
      fireEvent.click(toggleProfileBtn);

      const savedInStorage = JSON.parse(globalThis.localStorage.getItem(mockStorageKey) || '{}');
      expect(savedInStorage.profile).toBe(false);

      // Toggle component column off
      const toggleComponentBtn = screen.getByTestId('column-toggle-component');
      fireEvent.click(toggleComponentBtn);

      const updatedStorage = JSON.parse(globalThis.localStorage.getItem(mockStorageKey) || '{}');
      expect(updatedStorage.component).toBe(false);
    });

    it('renders Secret variant in light mode without onSelectProfile', () => {
      render(
        <ResourceListView
          resourceType="Secret"
          storageKey={mockStorageKey}
          search=""
          onSearchChange={vi.fn()}
          items={sampleItems}
          isDark={false}
          emptyIcon={Database}
          onEditItem={vi.fn()}
          onDeleteItem={vi.fn()}
          accentColor="rose"
        />
      );

      expect(screen.getByText('app-config')).toBeDefined();
      const profileSpan = screen.getByTestId('sec-profile-cm-item-1');
      expect(profileSpan).toBeDefined();
    });
  });
});
