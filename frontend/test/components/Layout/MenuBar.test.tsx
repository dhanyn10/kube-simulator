import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MenuBar } from '../../../src/components/Layout/MenuBar';
import { useFlowStore } from '../../../src/store';
import '@testing-library/jest-dom';

vi.mock('@wailsjs/runtime', () => ({
  BrowserOpenURL: vi.fn(),
}));

vi.mock('../../../src/lib/tour', () => ({
  startTour: vi.fn(),
}));

describe('MenuBar', () => {
  const defaultProps = {
    onExportYaml: vi.fn(),
    onImportFile: vi.fn(),
    onSaveFile: vi.fn(),
    onOpenProjects: vi.fn(),
    onOpenScenarios: vi.fn(),
    onOpenAbout: vi.fn(),
    onOpenSettings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).BrowserOpenURL = vi.fn();
    useFlowStore.setState({
      colorMode: 'dark',
      isAutosaveEnabled: false,
      nodes: [],
      edges: [],
      isSimulating: false,
      isMonitoringOpen: false,
      isMonitoringDetached: false,
      isSidebarVisible: true,
      isRightSidebarVisible: true,
      isHistoryViewOpen: false,
      isAutofocusEnabled: true,
      isTerminalOpen: false,
      currentProject: null,
      simulatedUpdateInfo: null,
      logs: [],
    });
    (globalThis as any).go = {
      main: {
        App: {
          GetSystemInfo: vi.fn().mockResolvedValue({ version: '1.0.0' }),
          CheckForUpdates: vi.fn().mockResolvedValue({
            updateAvailable: true,
            latestVersion: '1.1.0',
            releaseUrl: 'https://github.com/dhanyn10/kube-simulator/releases/v1.1.0',
          }),
          UpdateProject: vi.fn().mockResolvedValue(true),
        },
      },
    };
  });

  it('renders correctly and hides identity badge when user is system:admin', () => {
    useFlowStore.setState({ activeIdentity: 'system:admin' });
    render(<MenuBar {...defaultProps} />);
    expect(screen.getByText('File')).toBeDefined();
    expect(screen.getByText('Resource')).toBeDefined();
    expect(screen.getByText('View')).toBeDefined();
    expect(screen.getByText('Help')).toBeDefined();
    expect(screen.getByTestId('app-title')).toBeDefined();
    expect(screen.queryByTestId('menubar-identity-passport-btn')).toBeNull();
  });

  it('renders identity badge when user switched to a Kube IAM identity', () => {
    useFlowStore.setState({ activeIdentity: 'budi' });
    render(<MenuBar {...defaultProps} />);
    expect(screen.getByTestId('menubar-identity-passport-btn')).toBeInTheDocument();
    expect(screen.getByText('budi')).toBeInTheDocument();
  });

  it('checks for updates on mount and displays update button', async () => {
    render(<MenuBar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('menubar-update-btn')).toBeInTheDocument();
      expect(screen.getByText('Update v1.1.0')).toBeInTheDocument();
    });

    const updateBtn = screen.getByTestId('menubar-update-btn');
    fireEvent.click(updateBtn);
    expect(defaultProps.onOpenAbout).toHaveBeenCalled();
  });

  it('opens release URL when update button clicked and BrowserOpenURL is available', async () => {
    const mockBrowserOpen = vi.fn();
    (window as any).runtime = { BrowserOpenURL: mockBrowserOpen };
    useFlowStore.setState({
      simulatedUpdateInfo: { latestVersion: '2.0.0', releaseUrl: 'https://example.com/v2' },
    });

    render(<MenuBar {...defaultProps} />);

    const updateBtn = screen.getByTestId('menubar-update-btn');
    fireEvent.click(updateBtn);
    expect(mockBrowserOpen).toHaveBeenCalledWith('https://example.com/v2');
    delete (window as any).runtime;
  });

  it('falls back to onOpenAbout when update button clicked without releaseUrl or runtime', async () => {
    useFlowStore.setState({
      simulatedUpdateInfo: { latestVersion: '2.0.0', releaseUrl: '' },
    });

    render(<MenuBar {...defaultProps} />);

    const updateBtn = screen.getByTestId('menubar-update-btn');
    fireEvent.click(updateBtn);
    expect(defaultProps.onOpenAbout).toHaveBeenCalled();
  });

  it('handles background update check when update is not available', async () => {
    (globalThis as any).go.main.App.CheckForUpdates = vi.fn().mockResolvedValue({
      updateAvailable: false,
      latestVersion: '',
    });

    render(<MenuBar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByTestId('menubar-update-btn')).toBeNull();
    });
  });

  it('handles background update check error gracefully', async () => {
    (globalThis as any).go.main.App.GetSystemInfo = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<MenuBar {...defaultProps} />);
    await waitFor(() => {
      expect(screen.queryByTestId('menubar-update-btn')).toBeNull();
    });
  });

  it('handles Resource > Save on existing project vs project id === -1 and UpdateProject success vs failure', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Case 1: UpdateProject returns true
    useFlowStore.setState({
      currentProject: { id: 10, name: "Active Proj" },
      nodes: [{ id: "n1", type: "Pod", position: { x: 0, y: 0 }, data: {} }],
    });

    const { rerender } = render(<MenuBar {...defaultProps} />);

    fireEvent.click(screen.getByText("Resource"));
    const saveItems = screen.getAllByText("Save");
    fireEvent.click(saveItems[saveItems.length - 1]);

    await waitFor(() => {
      expect((globalThis as any).go.main.App.UpdateProject).toHaveBeenCalledWith(10, expect.any(String));
      expect(alertSpy).toHaveBeenCalledWith("Resource architecture saved successfully!");
    });

    // Case 2: UpdateProject returns false
    (globalThis as any).go.main.App.UpdateProject = vi.fn().mockResolvedValue(false);
    alertSpy.mockClear();

    fireEvent.click(screen.getByText("Resource"));
    const saveItemsUpdateFail = screen.getAllByText("Save");
    fireEvent.click(saveItemsUpdateFail[saveItemsUpdateFail.length - 1]);

    await waitFor(() => {
      expect((globalThis as any).go.main.App.UpdateProject).toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
    });

    // Case 3: Project with id === -1 opens manager to save as new
    useFlowStore.setState({ currentProject: { id: -1, name: "Unsaved" } });
    rerender(<MenuBar {...defaultProps} />);

    fireEvent.click(screen.getByText("Resource"));
    const saveItems2 = screen.getAllByText("Save");
    fireEvent.click(saveItems2[saveItems2.length - 1]);
    expect(defaultProps.onOpenProjects).toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('handles View > Utilities menu item when history view is open or closed', () => {
    const setHistoryViewOpen = vi.spyOn(useFlowStore.getState(), 'setHistoryViewOpen');
    const setRightSidebarVisible = vi.spyOn(useFlowStore.getState(), 'setRightSidebarVisible');

    useFlowStore.setState({ isHistoryViewOpen: true, isRightSidebarVisible: true });
    const { rerender } = render(<MenuBar {...defaultProps} />);

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Utilities'));
    expect(setHistoryViewOpen).toHaveBeenCalledWith(false);

    useFlowStore.setState({ isHistoryViewOpen: false, isRightSidebarVisible: true });
    rerender(<MenuBar {...defaultProps} />);

    // View menu is still open
    fireEvent.click(screen.getByText('Utilities'));
    expect(setRightSidebarVisible).toHaveBeenCalledWith(false);
  });

  it('handles View > History and Terminal menu items', () => {
    const setRightSidebarVisible = vi.spyOn(useFlowStore.getState(), 'setRightSidebarVisible');
    const setHistoryViewOpen = vi.spyOn(useFlowStore.getState(), 'setHistoryViewOpen');
    const setTerminalOpen = vi.spyOn(useFlowStore.getState(), 'setTerminalOpen');

    useFlowStore.setState({ isHistoryViewOpen: false, isRightSidebarVisible: false });
    render(<MenuBar {...defaultProps} />);

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('History'));
    expect(setRightSidebarVisible).toHaveBeenCalledWith(true);
    expect(setHistoryViewOpen).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Terminal'));
    expect(setTerminalOpen).toHaveBeenCalledWith(true);
  });

  it('handles View > Simulation menu item in different monitoring modes', () => {
    const setMonitoringOpen = vi.spyOn(useFlowStore.getState(), 'setMonitoringOpen');
    useFlowStore.setState({ isMonitoringOpen: true });
    const { rerender } = render(<MenuBar {...defaultProps} />);

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Close Simulation'));
    expect(setMonitoringOpen).toHaveBeenCalledWith(false);

    useFlowStore.setState({ isMonitoringOpen: false, isMonitoringDetached: true });
    rerender(<MenuBar {...defaultProps} />);

    fireEvent.click(screen.getByText('View'));
    expect(screen.getByText('Monitoring: Detached')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Monitoring: Detached'));
    // Does not call setMonitoringOpen when detached
    expect(setMonitoringOpen).toHaveBeenCalledTimes(1);
  });

  it('handles Help > Report Issue link', () => {
    render(<MenuBar {...defaultProps} />);

    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('Report Issue'));
    expect((globalThis as any).BrowserOpenURL).toHaveBeenCalledWith('https://github.com/dhanyn10/kube-simulator/issues');
  });

  it('renders in light mode with error count > 99 displaying 99+', () => {
    useFlowStore.setState({
      colorMode: 'light',
      logs: Array.from({ length: 105 }, (_, i) => ({
        id: String(i),
        level: 'error',
        message: `Error ${i}`,
        timestamp: '10:00:00',
        scope: 'System'
      }))
    });

    render(<MenuBar {...defaultProps} />);

    const badge = screen.getByTestId('bell-error-badge');
    expect(badge).toHaveTextContent('99+');
  });

  it('toggles theme mode, sidebar, autofocus, and autosave', () => {
    const toggleColorMode = vi.spyOn(useFlowStore.getState(), 'toggleColorMode');
    const toggleAutosave = vi.spyOn(useFlowStore.getState(), 'toggleAutosave');
    const setSidebarVisible = vi.spyOn(useFlowStore.getState(), 'setSidebarVisible');
    const toggleAutofocus = vi.spyOn(useFlowStore.getState(), 'toggleAutofocus');

    render(<MenuBar {...defaultProps} />);

    const themeBtn = screen.getByTitle('Toggle Theme');
    fireEvent.click(themeBtn);
    expect(toggleColorMode).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Resource'));
    fireEvent.click(screen.getByText('Autosave: OFF'));
    expect(toggleAutosave).toHaveBeenCalled();

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Components'));
    expect(setSidebarVisible).toHaveBeenCalledWith(false);

    // Menu dropdown remains open for checked items
    fireEvent.click(screen.getByText('Autofocus'));
    expect(toggleAutofocus).toHaveBeenCalled();
  });
});
