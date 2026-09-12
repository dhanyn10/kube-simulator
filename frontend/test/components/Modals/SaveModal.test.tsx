import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SaveModal } from '@/components/Modals/SaveModal';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

vi.mock('@/hooks/useFitView', () => ({
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

  it('renders null when isOpen is false', () => {
    const { container } = render(<SaveModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
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

  it('renders in light mode with active project badge and disabled save button when name is blank', async () => {
    useFlowStore.setState({
      colorMode: 'light',
      currentProject: { id: 1, name: 'Web Architecture' },
    });

    render(<SaveModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter architecture name...') as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: '   ' } });
    });

    const saveBtn = screen.getByRole('button', { name: /Save$/i });
    expect(saveBtn).toBeDisabled();
  });

  it('disables save button when canvas is empty', async () => {
    useFlowStore.setState({
      nodes: [],
    });

    render(<SaveModal {...defaultProps} />);

    const saveBtn = screen.getByRole('button', { name: /Save$/i });
    expect(saveBtn).toBeDisabled();
  });

  it('handles typing in name input and quick saving current project', async () => {
    render(<SaveModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('Enter architecture name...');
    act(() => {
      fireEvent.change(input, { target: { value: 'Custom Project Name' } });
    });

    const saveBtn = screen.getByRole('button', { name: /Save$/i });
    expect(saveBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect((globalThis as any).go.main.App.SaveProject).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('handles quick saving existing current project (UpdateProject branch)', async () => {
    useFlowStore.setState({
      currentProject: { id: 1, name: 'Web Architecture' },
    });

    render(<SaveModal {...defaultProps} />);

    const saveBtn = screen.getByRole('button', { name: /Save$/i });

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect((globalThis as any).go.main.App.UpdateProject).toHaveBeenCalledWith(1, expect.any(String));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('handles double click on a recent file row to restore it', async () => {
    render(<SaveModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Web Architecture')).toBeInTheDocument();
    });

    const fileRow = screen.getByText('Web Architecture').closest('tr')!;
    await act(async () => {
      fireEvent.doubleClick(fileRow);
    });

    await waitFor(() => {
      expect((globalThis as any).go.main.App.LoadProject).toHaveBeenCalledWith(1);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('supports row right-click context menu options (Change Theme, Load Profile, Exit) in dark mode', async () => {
    render(<SaveModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('autosave-10092026120008')).toBeInTheDocument();
    });

    const itemRow = screen.getByText('autosave-10092026120008').closest('tr')!;
    act(() => {
      fireEvent.contextMenu(itemRow);
    });

    await waitFor(() => {
      expect(screen.getByText('Change Theme')).toBeInTheDocument();
      expect(screen.getByText('Load Profile')).toBeInTheDocument();
      expect(screen.getByText('Exit')).toBeInTheDocument();
    });

    // Test Change Theme button
    act(() => {
      fireEvent.click(screen.getByText('Change Theme'));
    });
    expect(useFlowStore.getState().colorMode).toBe('light');

    // Re-open context menu and test Load Profile button
    act(() => {
      fireEvent.contextMenu(itemRow);
    });
    await waitFor(() => expect(screen.getByText('Load Profile')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText('Load Profile'));
    });

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('supports context menu Exit button and light mode rendering', async () => {
    useFlowStore.setState({ colorMode: 'light' });
    render(<SaveModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Web Architecture')).toBeInTheDocument();
    });

    const itemRow = screen.getByText('Web Architecture').closest('tr')!;
    act(() => {
      fireEvent.contextMenu(itemRow);
    });

    await waitFor(() => {
      expect(screen.getByText('Exit')).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByText('Exit'));
    });

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders empty message when recent files list is empty', async () => {
    ((globalThis as any).go.main.App.GetSetting as any).mockResolvedValue('');
    ((globalThis as any).go.main.App.GetProjects as any).mockResolvedValue([]);

    render(<SaveModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No recent files or auto-saved profiles found')).toBeInTheDocument();
    });
  });

  it('handles Save As button click', () => {
    render(<SaveModal {...defaultProps} />);

    const saveAsBtn = screen.getByRole('button', { name: /Save As\.\.\./i });
    act(() => {
      fireEvent.click(saveAsBtn);
    });

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onSaveAs).toHaveBeenCalled();
  });
});
