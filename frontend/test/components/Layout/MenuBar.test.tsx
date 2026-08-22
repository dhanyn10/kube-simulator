import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MenuBar } from '../../../src/components/Layout/MenuBar';
import { useFlowStore } from '../../../src/store';
import '@testing-library/jest-dom';

vi.mock('@wailsjs/runtime/runtime', () => ({
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
      isAutofocusEnabled: true,
      currentProject: null,
    });
    (globalThis as any).go = {
      main: {
        App: {
          UpdateProject: vi.fn().mockResolvedValue(true),
        },
      },
    };
  });

  it('renders correctly', () => {
    render(<MenuBar {...defaultProps} />);
    expect(screen.getByText('File')).toBeDefined();
    expect(screen.getByText('Resource')).toBeDefined();
    expect(screen.getByText('View')).toBeDefined();
    expect(screen.getByText('Help')).toBeDefined();
    expect(screen.getByTestId('app-title')).toBeDefined();
  });

  it('handles Resource > Save on existing project', async () => {
    useFlowStore.setState({
      currentProject: { id: 10, name: "Active Proj" },
      nodes: [{ id: "n1", type: "Pod", position: { x: 0, y: 0 }, data: {} }],
    });

    render(<MenuBar {...defaultProps} />);

    const resourceBtn = screen.getByText("Resource");
    fireEvent.click(resourceBtn);

    const saveItems = screen.getAllByText("Save");
    fireEvent.click(saveItems[saveItems.length - 1]);

    await waitFor(() => {
      expect((globalThis as any).go.main.App.UpdateProject).toHaveBeenCalledWith(10, expect.any(String));
    });
  });

  it('opens dropdown on click', () => {
    render(<MenuBar {...defaultProps} />);
    const fileMenu = screen.getByText('File');
    fireEvent.click(fileMenu);

    expect(screen.getByText('Export')).toBeDefined();
    expect(screen.getByText('Import')).toBeDefined();
    expect(screen.getByText('Save')).toBeDefined();
  });

  it('triggers onExportYaml when Export is clicked', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Export'));
    expect(defaultProps.onExportYaml).toHaveBeenCalled();
  });

  it('toggles theme mode', () => {
    const toggleColorMode = vi.spyOn(useFlowStore.getState(), 'toggleColorMode');
    render(<MenuBar {...defaultProps} />);
    const themeBtn = screen.getByTitle('Toggle Theme');
    fireEvent.click(themeBtn);
    expect(toggleColorMode).toHaveBeenCalled();
  });

  it('toggles sidebar visibility and shows checkmark', () => {
    const setSidebarVisible = vi.spyOn(useFlowStore.getState(), 'setSidebarVisible');
    const { rerender } = render(<MenuBar {...defaultProps} />);

    fireEvent.click(screen.getByText('View'));

    const componentsBtn = screen.getByText('Components').closest('button');
    expect(componentsBtn?.querySelector('svg[class*="lucide-check"]')).not.toBeNull();

    fireEvent.click(screen.getByText('Components'));
    expect(setSidebarVisible).toHaveBeenCalledWith(false);

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Components')).toBeNull();

    useFlowStore.setState({ isSidebarVisible: false });
    rerender(<MenuBar {...defaultProps} />);

    fireEvent.click(screen.getByText('View'));
    expect(screen.getByText('Components').closest('button')?.querySelector('svg[class*="lucide-check"]')).toBeNull();
  });

  it('toggles right sidebar visibility', () => {
    const setRightSidebarVisible = vi.spyOn(useFlowStore.getState(), 'setRightSidebarVisible');
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Utilities'));
    expect(setRightSidebarVisible).toHaveBeenCalledWith(false);
  });

  it('toggles autofocus', () => {
    const toggleAutofocus = vi.spyOn(useFlowStore.getState(), 'toggleAutofocus');
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Autofocus'));
    expect(toggleAutofocus).toHaveBeenCalled();
  });

  it('opens log modal', () => {
    const setLogModalOpen = vi.spyOn(useFlowStore.getState(), 'setLogModalOpen');
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Logs'));
    expect(setLogModalOpen).toHaveBeenCalledWith(true);
  });

  it('starts tour from help menu', async () => {
    const { startTour } = await import('../../../src/lib/tour');
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('Take a Tour'));
    expect(startTour).toHaveBeenCalled();
  });

  it('opens about dialog from help menu', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('About'));
    expect(defaultProps.onOpenAbout).toHaveBeenCalled();
  });

  it('closes menu when clicking outside', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('File'));
    expect(screen.queryByText('Export')).toBeDefined();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Export')).toBeNull();
  });

  it('switches active menu on hover if another menu is open', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('File'));
    expect(screen.queryByText('Export')).toBeDefined();

    fireEvent.mouseEnter(screen.getByText('Resource'));
    expect(screen.queryByText('Export')).toBeNull();
    expect(screen.queryByText('Scenarios')).toBeDefined();
  });

  it('displays shortcuts in menu items', () => {
    render(<MenuBar {...defaultProps} />);
    fireEvent.click(screen.getByText('File'));
    expect(screen.getByText('Ctrl+S')).toBeDefined();
  });

  it('renders bell notification button on the right side of play button and displays error count badge', () => {
    useFlowStore.setState({
      logs: [
        { id: '1', level: 'error', message: 'Database connection error', timestamp: '10:00:00', scope: 'System' },
        { id: '2', level: 'fatal', message: 'Out of memory', timestamp: '10:00:01', scope: 'Backend' },
      ],
    });

    render(<MenuBar {...defaultProps} />);

    const bellBtn = screen.getByTestId('bell-notification-btn');
    expect(bellBtn).toBeInTheDocument();

    const errorBadge = screen.getByTestId('bell-error-badge');
    expect(errorBadge).toBeInTheDocument();
    expect(errorBadge).toHaveTextContent('2');

    const setLogModalOpen = vi.spyOn(useFlowStore.getState(), 'setLogModalOpen');
    fireEvent.click(bellBtn);
    expect(setLogModalOpen).toHaveBeenCalledWith(true);
  });
});
