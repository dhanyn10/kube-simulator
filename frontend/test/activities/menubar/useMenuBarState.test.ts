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
    act(() => {
      useFlowStore.setState({ isRightSidebarVisible: false, isTerminalOpen: false });
    });
    rerender();

    let viewMenu = result.current.menuItems.find((m) => m.label === 'View');
    let historyItem = viewMenu?.items.find((i) => i.label === 'History');
    act(() => {
      historyItem?.onClick?.();
    });
    expect(useFlowStore.getState().isHistoryViewOpen).toBe(true);
    expect(useFlowStore.getState().isRightSidebarVisible).toBe(true);

    rerender();
    viewMenu = result.current.menuItems.find((m) => m.label === 'View');
    let utilitiesItem = viewMenu?.items.find((i) => i.label === 'Utilities');
    act(() => {
      utilitiesItem?.onClick?.();
    });
    expect(useFlowStore.getState().isHistoryViewOpen).toBe(false);

    // Click Utilities when isHistoryViewOpen is false (toggles right sidebar visibility)
    act(() => {
      utilitiesItem?.onClick?.();
    });
    expect(useFlowStore.getState().isRightSidebarVisible).toBe(false);

    let monitoringItem = viewMenu?.items.find((i) => i.label.includes('Monitoring'));
    let componentsItem = viewMenu?.items.find((i) => i.label === 'Components');
    let autofocusItem = viewMenu?.items.find((i) => i.label === 'Autofocus');
    let logsItem = viewMenu?.items.find((i) => i.label === 'Logs');
    let terminalItem = viewMenu?.items.find((i) => i.label === 'Terminal');

    act(() => {
      monitoringItem?.onClick?.();
      componentsItem?.onClick?.();
      autofocusItem?.onClick?.();
      logsItem?.onClick?.();
      terminalItem?.onClick?.();
    });
    expect(useFlowStore.getState().isLogModalOpen).toBe(true);
    expect(useFlowStore.getState().isTerminalOpen).toBe(true);

    // Test clicking monitoring menu item when isMonitoringDetached is true
    act(() => {
      useFlowStore.setState({ isMonitoringDetached: true });
    });
    rerender();
    viewMenu = result.current.menuItems.find((m) => m.label === 'View');
    monitoringItem = viewMenu?.items.find((i) => i.label.includes('Monitoring'));
    act(() => {
      monitoringItem?.onClick?.();
    });

    // Test Help menu items (Take a Tour, About)
    let helpMenu = result.current.menuItems.find((m) => m.label === 'Help');
    let tourItem = helpMenu?.items.find((i) => i.label === 'Take a Tour');
    let aboutItem = helpMenu?.items.find((i) => i.label === 'About');

    act(() => {
      tourItem?.onClick?.();
      aboutItem?.onClick?.();
    });
    expect(defaultProps.onOpenAbout).toHaveBeenCalled();

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
            GetSystemInfo: vi.fn().mockResolvedValue({ version: '' }),
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

  it('handles update check returning updateAvailable false or null sysInfo version', async () => {
    (globalThis as any).window = {
      go: {
        main: {
          App: {
            GetSystemInfo: vi.fn().mockResolvedValue(null),
            CheckForUpdates: vi.fn().mockResolvedValue({ updateAvailable: false }),
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

    expect(result.current.effectiveUpdateInfo).toBeNull();
  });

  it('handles Resource Save for new/unsaved project (onOpenProjects fallback) and UpdateProject returning false', async () => {
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

    useFlowStore.setState({ currentProject: null });

    const { result, rerender } = renderHook(() => useMenuBarState(defaultProps));

    let resourceMenu = result.current.menuItems.find((m) => m.label === 'Resource');
    let saveItem = resourceMenu?.items.find((i) => i.label === 'Save');

    await act(async () => {
      await saveItem?.onClick?.();
    });
    expect(defaultProps.onOpenProjects).toHaveBeenCalled();

    // Test when currentProject.id === -1
    useFlowStore.setState({ currentProject: { id: -1, name: 'Unsaved Project' } });
    rerender();

    resourceMenu = result.current.menuItems.find((m) => m.label === 'Resource');
    saveItem = resourceMenu?.items.find((i) => i.label === 'Save');

    await act(async () => {
      await saveItem?.onClick?.();
    });
    expect(defaultProps.onOpenProjects).toHaveBeenCalled();

    // Test when UpdateProject fails (returns false)
    useFlowStore.setState({ currentProject: { id: 2, name: 'Project 2' } });
    (globalThis as any).go = {
      main: {
        App: {
          UpdateProject: vi.fn().mockResolvedValue(false),
        },
      },
    };
    rerender();

    resourceMenu = result.current.menuItems.find((m) => m.label === 'Resource');
    saveItem = resourceMenu?.items.find((i) => i.label === 'Save');

    await act(async () => {
      await saveItem?.onClick?.();
    });
    expect((globalThis as any).go.main.App.UpdateProject).toHaveBeenCalledWith(2, expect.any(String));
  });

  it('handles simulatedUpdateInfo override and background update error catch', async () => {
    (globalThis as any).window = {
      go: {
        main: {
          App: {
            GetSystemInfo: vi.fn().mockRejectedValue(new Error('Network error')),
          },
        },
      },
    };

    useFlowStore.setState({
      simulatedUpdateInfo: { latestVersion: '2.0.0', releaseUrl: 'https://example.com' },
    });

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

    expect(result.current.effectiveUpdateInfo).toEqual({
      version: '2.0.0',
      releaseUrl: 'https://example.com',
    });
  });

  it('covers Close Simulation monitoring label when isMonitoringOpen is true and History item when right sidebar is already visible', () => {
    useFlowStore.setState({
      isMonitoringOpen: true,
      isMonitoringDetached: false,
      isRightSidebarVisible: true,
    });

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

    const viewMenu = result.current.menuItems.find((m) => m.label === 'View');
    const monitoringItem = viewMenu?.items.find((i) => i.label === 'Close Simulation');
    expect(monitoringItem).toBeDefined();

    const historyItem = viewMenu?.items.find((i) => i.label === 'History');
    act(() => {
      historyItem?.onClick?.();
    });
    expect(useFlowStore.getState().isHistoryViewOpen).toBe(true);
  });
});
