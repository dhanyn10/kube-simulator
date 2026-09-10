import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { FileBackstageView } from '../../../src/components/Layout/FileBackstageView';
import { useFlowStore } from '../../../src/store';
import '@testing-library/jest-dom';

describe('FileBackstageView', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSaveAs: vi.fn(),
    onImportFile: vi.fn(),
    onExportYaml: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [{ id: 'node-1', type: 'Pod', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
      currentProject: { id: 1, name: 'Sample Architecture' },
      isSidebarVisible: true,
      isRightSidebarVisible: true,
      isMonitoringOpen: false,
      isAutofocusEnabled: true,
      canvasBgVariant: 'dots',
      canvasBgColor: 'default',
      canvasBgOpacity: 0.5,
    });
    (globalThis as any).go = {
      main: {
        App: {
          GetSetting: vi.fn().mockImplementation((key) => {
            if (key === 'auto_saved_profile_latest') return Promise.resolve('autosave-10092026120008');
            if (key === 'auto_saved_profile_content') return Promise.resolve(JSON.stringify({ timestamp: 1700000000000, nodes: [], edges: [] }));
            return Promise.resolve(null);
          }),
          GetProjects: vi.fn().mockResolvedValue([
            { id: 1, name: 'Sample Architecture', updated_at: '2025-01-01' },
          ]),
          SaveProject: vi.fn().mockResolvedValue(2),
          UpdateProject: vi.fn().mockResolvedValue(true),
          LoadProject: vi.fn().mockResolvedValue({ content: JSON.stringify({ nodes: [], edges: [] }) }),
        },
      },
    };
  });

  const renderWithProvider = (ui: React.ReactNode) => {
    return render(<ReactFlowProvider>{ui}</ReactFlowProvider>);
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithProvider(<FileBackstageView {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders fullscreen backstage view with Home tab active by default and closes on back arrow or Esc key', () => {
    renderWithProvider(<FileBackstageView {...defaultProps} />);

    expect(screen.getByTestId('file-backstage-view')).toBeInTheDocument();
    expect(screen.getByText('Home & Recent Profiles')).toBeInTheDocument();

    const backBtn = screen.getByTestId('file-backstage-back-btn');
    fireEvent.click(backBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();

    // Test Esc key listener
    fireEvent.keyDown(globalThis, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
  });

  it('directly saves current profile when Save sidebar button is clicked', async () => {
    renderWithProvider(<FileBackstageView {...defaultProps} />);

    const saveSidebarBtn = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveSidebarBtn);

    await waitFor(() => {
      expect((globalThis as any).go.main.App.UpdateProject).toHaveBeenCalledWith(1, expect.any(String));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('switches tabs between Home, Settings > View, and Settings > Canvas', () => {
    renderWithProvider(<FileBackstageView {...defaultProps} />);

    // Click View & Layout submenu under Settings
    fireEvent.click(screen.getByText('View & Layout'));
    expect(screen.getByText('View & Layout Settings')).toBeInTheDocument();
    expect(screen.getByText('Components Sidebar')).toBeInTheDocument();

    // Click Canvas Grid submenu under Settings
    fireEvent.click(screen.getByText('Canvas Grid'));
    expect(screen.getByText('Canvas Grid Customization')).toBeInTheDocument();
    expect(screen.getByText('Dots Pattern')).toBeInTheDocument();

    // Switch back to Home tab
    fireEvent.click(screen.getByText('Home'));
    expect(screen.getByText('Home & Recent Profiles')).toBeInTheDocument();
  });

  it('handles Save As, Import, Export YAML sidebar action clicks', () => {
    renderWithProvider(<FileBackstageView {...defaultProps} />);

    fireEvent.click(screen.getByText('Save As...'));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onSaveAs).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Import'));
    expect(defaultProps.onImportFile).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Export YAML'));
    expect(defaultProps.onExportYaml).toHaveBeenCalled();
  });

  it('toggles theme mode using footer button', () => {
    const toggleColorMode = vi.spyOn(useFlowStore.getState(), 'toggleColorMode');
    renderWithProvider(<FileBackstageView {...defaultProps} />);

    fireEvent.click(screen.getByText('Theme Mode'));
    expect(toggleColorMode).toHaveBeenCalled();
  });
});
