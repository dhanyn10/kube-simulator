import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFlowStore } from '@/store';
import {
  formatDateModified,
  fetchRecentFiles,
  restoreRecentFile,
  getSidebarContainerClass,
  getBackButtonClass,
  getHomeItemClass,
  getActionButtonClass,
  getSettingsButtonClass,
  getSubmenuItemClass,
  getThemeToggleClass,
  getAutosaveSwitchBgClass,
  getSaveRowBgClass,
  getHeaderProfileName,
  RecentFileItem,
} from '@/activities/layout/fileBackstageHelpers';

describe('fileBackstageHelpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      currentProject: null,
      lastSavedSnapshot: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).go;
  });

  describe('formatDateModified', () => {
    it('returns default formatted current date when val is omitted', () => {
      const result = formatDateModified();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('returns formatted string for valid timestamp or date string', () => {
      // 2026-09-11 14:30:45 UTC
      const date = new Date(2026, 8, 11, 14, 30, 45);
      const formatted = formatDateModified(date.getTime());
      expect(formatted).toBe('11/09/2026 14:30:45');
    });

    it('returns String(val) when val cannot be parsed as a date', () => {
      expect(formatDateModified('invalid-date-string')).toBe('invalid-date-string');
    });
  });

  describe('fetchRecentFiles', () => {
    it('returns empty array when globalThis.go is undefined', async () => {
      const items = await fetchRecentFiles();
      expect(items).toEqual([]);
    });

    it('fetches recent autosave item and project list from Wails backend', async () => {
      const mockGetSetting = vi.fn().mockImplementation((key: string) => {
        if (key === 'auto_saved_profile_latest') return Promise.resolve('autosave-11092026');
        if (key === 'auto_saved_profile_content')
          return Promise.resolve(JSON.stringify({ timestamp: 1770000000000, nodes: [] }));
        return Promise.resolve(null);
      });
      const mockGetProjects = vi.fn().mockResolvedValue([
        { id: 1, name: 'Project 1', updated_at: 1770000000000 },
        { id: 2, name: 'Project 2', created_at: 1770000000000 },
        { id: 3, name: 'Project 3' },
      ]);

      (globalThis as any).go = {
        main: {
          App: {
            GetSetting: mockGetSetting,
            GetProjects: mockGetProjects,
          },
        },
      };

      const items = await fetchRecentFiles();
      expect(items).toHaveLength(4);
      expect(items[0]).toEqual({
        id: 'autosave-latest',
        name: 'autosave-11092026',
        location: '~/.kube-simulator/autosaves/autosave-11092026.infra',
        fullPath: '~/.kube-simulator/autosaves/autosave-11092026.infra',
        updatedAt: expect.any(String),
        isAutosave: true,
      });
      expect(items[1].name).toBe('Project 1');
      expect(items[2].name).toBe('Project 2');
      expect(items[3].name).toBe('Project 3');
    });

    it('handles JSON parse error for autosave content gracefully', async () => {
      const mockGetSetting = vi.fn().mockImplementation((key: string) => {
        if (key === 'auto_saved_profile_latest') return Promise.resolve('autosave-bad-json');
        if (key === 'auto_saved_profile_content') return Promise.resolve('INVALID_JSON');
        return Promise.resolve(null);
      });

      (globalThis as any).go = {
        main: {
          App: {
            GetSetting: mockGetSetting,
          },
        },
      };

      const items = await fetchRecentFiles();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('autosave-bad-json');
    });
  });

  describe('restoreRecentFile', () => {
    it('returns early when app is not available', async () => {
      const onClose = vi.fn();
      const fitView = vi.fn();
      const item: RecentFileItem = {
        id: 'autosave-latest',
        name: 'autosave-1',
        location: '',
        fullPath: '',
        updatedAt: '',
        isAutosave: true,
      };

      await restoreRecentFile(item, onClose, fitView);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('restores autosave file successfully', async () => {
      const onClose = vi.fn();
      const fitView = vi.fn();
      const mockContent = JSON.stringify({
        nodes: [{ id: 'pod-1', type: 'Pod', position: { x: 0, y: 0 }, data: { label: 'pod-1' } }],
        edges: [],
      });

      (globalThis as any).go = {
        main: {
          App: {
            GetSetting: vi.fn().mockResolvedValue(mockContent),
          },
        },
      };

      const item: RecentFileItem = {
        id: 'autosave-latest',
        name: 'autosave-latest',
        location: '',
        fullPath: '',
        updatedAt: '',
        isAutosave: true,
      };

      await restoreRecentFile(item, onClose, fitView);
      expect(onClose).toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fitView).toHaveBeenCalledWith({ padding: 0.1, duration: 800 });
      expect(useFlowStore.getState().nodes).toHaveLength(1);
    });

    it('handles invalid autosave content without crashing', async () => {
      const onClose = vi.fn();
      const fitView = vi.fn();

      (globalThis as any).go = {
        main: {
          App: {
            GetSetting: vi.fn().mockResolvedValue('INVALID_JSON'),
          },
        },
      };

      const item: RecentFileItem = {
        id: 'autosave-latest',
        name: 'autosave-latest',
        location: '',
        fullPath: '',
        updatedAt: '',
        isAutosave: true,
      };

      await restoreRecentFile(item, onClose, fitView);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('restores project by number id successfully', async () => {
      const onClose = vi.fn();
      const fitView = vi.fn();
      const projectContent = JSON.stringify({
        nodes: [{ id: 'dep-1', type: 'Deployment', position: { x: 10, y: 10 }, data: { label: 'dep-1' } }],
        edges: [],
      });

      (globalThis as any).go = {
        main: {
          App: {
            LoadProject: vi.fn().mockResolvedValue({ content: projectContent }),
          },
        },
      };

      const item: RecentFileItem = {
        id: 42,
        name: 'My Custom Project',
        location: '',
        fullPath: '',
        updatedAt: '',
      };

      await restoreRecentFile(item, onClose, fitView);
      expect(onClose).toHaveBeenCalled();
      expect(useFlowStore.getState().currentProject).toEqual({ id: 42, name: 'My Custom Project' });

      vi.advanceTimersByTime(100);
      expect(fitView).toHaveBeenCalledWith({ padding: 0.1, duration: 800 });
    });
  });

  describe('style helper functions', () => {
    it('getSidebarContainerClass returns correct class for dark/light modes', () => {
      expect(getSidebarContainerClass(true)).toBe('backstage-sidebar-dark');
      expect(getSidebarContainerClass(false)).toBe('backstage-sidebar-light');
    });

    it('getBackButtonClass returns correct class for dark/light modes', () => {
      expect(getBackButtonClass(true)).toBe('backstage-btn-back-dark');
      expect(getBackButtonClass(false)).toBe('backstage-btn-back-light');
    });

    it('getHomeItemClass returns active/inactive classes for home tab and themes', () => {
      expect(getHomeItemClass('home', true)).toContain('backstage-item-active-dark');
      expect(getHomeItemClass('home', false)).toContain('backstage-item-active-light');
      expect(getHomeItemClass('settings-view', true)).toContain('backstage-item-inactive-dark');
      expect(getHomeItemClass('settings-view', false)).toContain('backstage-item-inactive-light');
    });

    it('getActionButtonClass returns correct class', () => {
      expect(getActionButtonClass(true)).toContain('backstage-item-inactive-dark');
      expect(getActionButtonClass(false)).toContain('backstage-item-inactive-light');
    });

    it('getSettingsButtonClass returns settings active/inactive classes', () => {
      expect(getSettingsButtonClass('settings-view', true)).toBe('backstage-settings-active-dark');
      expect(getSettingsButtonClass('settings-canvas', false)).toBe('backstage-settings-active-light');
      expect(getSettingsButtonClass('home', true)).toBe('backstage-settings-inactive-dark');
      expect(getSettingsButtonClass('home', false)).toBe('backstage-settings-inactive-light');
    });

    it('getSubmenuItemClass returns active/inactive submenu classes', () => {
      expect(getSubmenuItemClass(true, true)).toBe('backstage-submenu-active-dark');
      expect(getSubmenuItemClass(true, false)).toBe('backstage-submenu-active-light');
      expect(getSubmenuItemClass(false, true)).toBe('backstage-submenu-inactive-dark');
      expect(getSubmenuItemClass(false, false)).toBe('backstage-submenu-inactive-light');
    });

    it('getThemeToggleClass returns correct toggle classes', () => {
      expect(getThemeToggleClass(true)).toBe('backstage-theme-toggle-dark');
      expect(getThemeToggleClass(false)).toBe('backstage-theme-toggle-light');
    });

    it('getAutosaveSwitchBgClass returns correct background colors', () => {
      expect(getAutosaveSwitchBgClass(true, true)).toBe('bg-emerald-500');
      expect(getAutosaveSwitchBgClass(false, true)).toBe('bg-slate-700');
      expect(getAutosaveSwitchBgClass(false, false)).toBe('bg-slate-300');
    });

    it('getSaveRowBgClass returns expected row class', () => {
      expect(getSaveRowBgClass(true, true)).toBe('backstage-table-row-autosave-dark');
      expect(getSaveRowBgClass(true, false)).toBe('backstage-table-row-autosave-light');
      expect(getSaveRowBgClass(false, true)).toBe('backstage-table-row-normal-dark');
      expect(getSaveRowBgClass(false, false)).toBe('backstage-table-row-normal-light');
    });

    it('getHeaderProfileName returns current project name, new project name, or default', () => {
      expect(getHeaderProfileName({ name: 'Project A' }, 'New Name')).toBe('Project A');
      expect(getHeaderProfileName(null, 'New Name')).toBe('New Name');
      expect(getHeaderProfileName(null, '')).toBe('Auto-Saved Profile');
    });
  });
});
