import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMenuBarState } from '@/activities/menubar/useMenuBarState';
import { useFlowStore } from '@/store';

describe('useMenuBarState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [],
      edges: [],
      isScenarioModalOpen: false,
      isYamlModalOpen: false,
      isSettingsModalOpen: false,
      isTerminalCommandTreeModalOpen: false,
      loadScenario: vi.fn(),
    });
  });

  it('initializes menu items, handles click callbacks and menu actions', async () => {
    window.alert = vi.fn();
    const defaultProps = {
      onExportYaml: vi.fn(),
      onImportFile: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      onOpenProjects: vi.fn(),
      onOpenScenarios: vi.fn(),
      onOpenAbout: vi.fn(),
      onOpenSettings: vi.fn(),
    };

    useFlowStore.setState({
      nodes: [{ id: 'int1', type: 'Internet', data: {} }],
      edges: [],
      currentProject: { id: 1, name: 'My Project' },
    });

    (globalThis as any).go = {
      main: {
        App: {
          UpdateProject: vi.fn().mockResolvedValue(true),
        },
      },
    };

    const { result, rerender } = renderHook(() => useMenuBarState(defaultProps));

    expect(result.current.menuItems).toHaveLength(4);
    expect(result.current.hasInternet).toBe(true);

    // Test Resource menu "Save" item for existing project
    let resourceMenu = result.current.menuItems.find((m) => m.label === 'Resource');
    let saveItem = resourceMenu?.items.find((i) => i.label === 'Save');
    await act(async () => {
      await saveItem?.onClick?.();
    });
    expect((globalThis as any).go.main.App.UpdateProject).toHaveBeenCalledWith(1, expect.any(String));

    // Test View menu items (History, Utilities, Autofocus, Terminal, Logs)
    let viewMenu = result.current.menuItems.find((m) => m.label === 'View');
    let historyItem = viewMenu?.items.find((i) => i.label === 'History');
    act(() => {
      historyItem?.onClick?.();
    });
    expect(useFlowStore.getState().isHistoryViewOpen).toBe(true);

    rerender();
    viewMenu = result.current.menuItems.find((m) => m.label === 'View');
    let utilitiesItem = viewMenu?.items.find((i) => i.label === 'Utilities');
    act(() => {
      utilitiesItem?.onClick?.();
    });
    expect(useFlowStore.getState().isHistoryViewOpen).toBe(false);

    // Test outside click to close active menu
    (result.current.menuRef as any).current = document.createElement('div');

    act(() => {
      result.current.setActiveMenu('File');
    });
    expect(result.current.activeMenu).toBe('File');

    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      document.dispatchEvent(event);
    });
    expect(result.current.activeMenu).toBeNull();
  });

  it('checks for updates in background and catches background check errors', async () => {
    (globalThis as any).window = {
      go: {
        main: {
          App: {
            GetSystemInfo: vi.fn().mockResolvedValue({ version: '1.0.0' }),
            CheckForUpdates: vi.fn().mockResolvedValue({ updateAvailable: true, latestVersion: '1.1.0' }),
          },
        },
      },
    };

    const defaultProps = {
      onExportYaml: vi.fn(),
      onImportFile: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      onOpenProjects: vi.fn(),
      onOpenScenarios: vi.fn(),
      onOpenAbout: vi.fn(),
      onOpenSettings: vi.fn(),
    };

    const { result } = renderHook(() => useMenuBarState(defaultProps));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.effectiveUpdateInfo).toEqual({
      version: '1.1.0',
      releaseUrl: 'https://github.com/dhanyn10/kube-simulator/releases',
    });
  });
});
