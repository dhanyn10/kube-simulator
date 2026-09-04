import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from '@/components/UI/ContextMenu';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

vi.mock('@/store', () => ({
  useFlowStore: vi.fn(),
}));

describe('ContextMenu', () => {
  const mockOnClose = vi.fn();
  const mockOnInspect = vi.fn();
  const mockOnDelete = vi.fn();
  const mockGroupNodes = vi.fn();
  const mockUngroupNodes = vi.fn();
  const mockCopyNodes = vi.fn();
  const mockPasteNodes = vi.fn();
  const mockToggleColorMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useFlowStore as any).mockImplementation((selector: any) => {
      const state = {
        colorMode: 'dark',
        toggleColorMode: mockToggleColorMode,
        nodes: [{ id: '1', selected: true, data: {} }],
        groupNodes: mockGroupNodes,
        ungroupNodes: mockUngroupNodes,
        copyNodes: mockCopyNodes,
        pasteNodes: mockPasteNodes,
      };
      return selector(state);
    });
  });

  it('renders correctly', () => {
    render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} onInspect={mockOnInspect} onDelete={mockOnDelete} />
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Inspect YAML')).toBeInTheDocument();
    expect(screen.getByText('Change Theme')).toBeInTheDocument();
  });

  it('disables Inspect YAML when canvas is empty', () => {
    (useFlowStore as any).mockImplementation((selector: any) => {
      const state = {
        colorMode: 'dark',
        toggleColorMode: mockToggleColorMode,
        nodes: [],
        groupNodes: mockGroupNodes,
        ungroupNodes: mockUngroupNodes,
        copyNodes: mockCopyNodes,
        pasteNodes: mockPasteNodes,
      };
      return selector(state);
    });

    render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} onInspect={mockOnInspect} onDelete={mockOnDelete} />
    );
    const inspectBtn = screen.getByText('Inspect YAML').closest('button');
    expect(inspectBtn).toBeDisabled();
  });

  it('calls toggleColorMode and onClose when Change Theme is clicked', () => {
    render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} onInspect={mockOnInspect} onDelete={mockOnDelete} />
    );
    fireEvent.click(screen.getByText('Change Theme'));
    expect(mockToggleColorMode).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onInspect and onClose when Inspect YAML is clicked', () => {
    render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} onInspect={mockOnInspect} onDelete={mockOnDelete} />
    );
    fireEvent.click(screen.getByText('Inspect YAML'));
    expect(mockOnInspect).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls copyNodes and onClose when Copy is clicked', () => {
    render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} onInspect={mockOnInspect} onDelete={mockOnDelete} />
    );
    fireEvent.click(screen.getByText('Copy'));
    expect(mockCopyNodes).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls pasteNodes and onClose when Paste is clicked', () => {
    render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} onInspect={mockOnInspect} onDelete={mockOnDelete} />
    );
    fireEvent.click(screen.getByText('Paste'));
    expect(mockPasteNodes).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onDelete and onClose when Delete is clicked', () => {
    render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} onInspect={mockOnInspect} onDelete={mockOnDelete} />
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(mockOnDelete).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} onInspect={mockOnInspect} onDelete={mockOnDelete} />
    );
    fireEvent.click(screen.getByLabelText('Close context menu'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles keyboard navigation - ArrowDown', () => {
    render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} onInspect={mockOnInspect} onDelete={mockOnDelete} />
    );
    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    items[0].focus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
  });

  it('handles keyboard navigation - ArrowUp', () => {
    render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} onInspect={mockOnInspect} onDelete={mockOnDelete} />
    );
    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    items[1].focus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('closes on Escape key', () => {
    render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} onInspect={mockOnInspect} onDelete={mockOnDelete} />
    );
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders and clicks View logs when single workload card is selected', () => {
    const mockSetTerminalOpen = vi.fn();
    const mockSetTerminalActiveTab = vi.fn();
    const mockSetTerminalSelectedResourceId = vi.fn();

    (useFlowStore as any).mockImplementation((selector: any) => {
      const state = {
        colorMode: 'light',
        nodes: [{ id: 'pod-1', type: 'Pod', selected: true, data: {} }],
        groupNodes: mockGroupNodes,
        ungroupNodes: mockUngroupNodes,
        copyNodes: mockCopyNodes,
        pasteNodes: mockPasteNodes,
        setTerminalOpen: mockSetTerminalOpen,
        setTerminalActiveTab: mockSetTerminalActiveTab,
        setTerminalSelectedResourceId: mockSetTerminalSelectedResourceId,
      };
      return selector(state);
    });

    render(
      <ContextMenu
        x={100}
        y={100}
        onClose={mockOnClose}
        onInspect={mockOnInspect}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByText('View logs (kubectl logs)'));
    expect(mockSetTerminalSelectedResourceId).toHaveBeenCalledWith('pod-1');
    expect(mockSetTerminalActiveTab).toHaveBeenCalledWith('logs');
    expect(mockSetTerminalOpen).toHaveBeenCalledWith(true);
  });
});
