import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SaveModal } from '../../../src/components/Modals/SaveModal';
import { useFlowStore } from '../../../src/store';
import '@testing-library/jest-dom';

vi.mock('../../../src/hooks/useFitView', () => ({
  useFitView: () => vi.fn(),
}));

describe('SaveModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSaveAs: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useFlowStore.setState({
      colorMode: 'dark',
      nodes: [{ id: 'n1', type: 'Pod', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
      currentProject: null,
    });
    (globalThis as any).go = {
      main: {
        App: {
          GetSetting: vi.fn().mockImplementation((key) => {
            if (key === 'auto_saved_profile_latest') return Promise.resolve('autosave-10092026120008');
            if (key === 'auto_saved_profile_content') return Promise.resolve(JSON.stringify({ nodes: [], edges: [], timestamp: 1789018536327 }));
            return Promise.resolve('');
          }),
          GetProjects: vi.fn().mockResolvedValue([
            { id: 1, name: 'Web Architecture', updated_at: '2026-09-10T12:00:08.000Z' },
          ]),
          SaveProject: vi.fn().mockResolvedValue(100),
          UpdateProject: vi.fn().mockResolvedValue(true),
          LoadProject: vi.fn().mockResolvedValue({ content: JSON.stringify({ nodes: [], edges: [] }) }),
        },
      },
    };
  });

  it('renders MS Word-style table headers, location sub-blocks, and Date Modified column without Action header', async () => {
    render(<SaveModal {...defaultProps} />);

    expect(screen.getByText('Save Architecture & Recent Files')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.queryByText('Action')).not.toBeInTheDocument();
    expect(screen.getAllByText('Date Modified').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText('autosave-10092026120008')).toBeInTheDocument();
      expect(screen.getByText('Web Architecture')).toBeInTheDocument();
      const pathSpan = screen.getByTitle('~/.kube-simulator/projects/1/architecture.infra');
      expect(pathSpan).toBeInTheDocument();
    });
  });

  it('supports row right-click context menu options (Change Theme, Load Profile, Exit)', async () => {
    render(<SaveModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('autosave-10092026120008')).toBeInTheDocument();
    });

    const itemRow = screen.getByText('autosave-10092026120008').closest('tr')!;
    fireEvent.contextMenu(itemRow);

    await waitFor(() => {
      expect(screen.getByText('Change Theme')).toBeInTheDocument();
      expect(screen.getByText('Load Profile')).toBeInTheDocument();
      expect(screen.getByText('Exit')).toBeInTheDocument();
    });

    // Click Load Profile
    fireEvent.click(screen.getByText('Load Profile'));
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('handles quick save current project', async () => {
    render(<SaveModal {...defaultProps} />);

    const saveBtn = screen.getByRole('button', { name: /Save$/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect((globalThis as any).go.main.App.SaveProject).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('handles Save As button click', () => {
    render(<SaveModal {...defaultProps} />);

    const saveAsBtn = screen.getByRole('button', { name: /Save As\.\.\./i });
    fireEvent.click(saveAsBtn);

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onSaveAs).toHaveBeenCalled();
  });
});
