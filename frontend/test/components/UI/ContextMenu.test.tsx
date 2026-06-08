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

  beforeEach(() => {
    vi.clearAllMocks();
    (useFlowStore as any).mockImplementation((selector: any) => {
      const state = {
        colorMode: 'dark',
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
});
