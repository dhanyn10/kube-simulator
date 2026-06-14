import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MenuBar } from '../../../src/components/Layout/MenuBar';
import { useFlowStore } from '../../../src/store';

// Mock Wails runtime
vi.mock('@wailsjs/runtime/runtime', () => ({
  BrowserOpenURL: vi.fn(),
}));

// Mock tour
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
  });

  it('renders correctly', () => {
    render(<MenuBar {...defaultProps} />);
    expect(screen.getByText('File')).toBeDefined();
    expect(screen.getByText('Resource')).toBeDefined();
    expect(screen.getByText('View')).toBeDefined();
    expect(screen.getByText('Help')).toBeDefined();
    expect(screen.getByTestId('app-title')).toBeDefined();
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

    // Open View menu
    fireEvent.click(screen.getByText('View'));

    // Should have a checkmark because isSidebarVisible is true by default in beforeEach
    const componentsBtn = screen.getByText('Components').closest('button');
    expect(componentsBtn?.querySelector('svg[class*="lucide-check"]')).not.toBeNull();

    fireEvent.click(screen.getByText('Components'));
    expect(setSidebarVisible).toHaveBeenCalledWith(false);

    // Close menu by clicking outside to have a clean state for next part
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Components')).toBeNull();

    // Update store and rerender to verify checkmark disappears
    useFlowStore.setState({ isSidebarVisible: false });
    rerender(<MenuBar {...defaultProps} />);

    // Open View menu again
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
});
