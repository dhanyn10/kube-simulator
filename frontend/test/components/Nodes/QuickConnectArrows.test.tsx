import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickConnectArrows } from '@/components/Nodes/QuickConnectArrows';
import { useFlowStore } from '@/store';
import '@testing-library/jest-dom';

vi.mock('@/store', () => ({
  useFlowStore: vi.fn(),
}));

describe('QuickConnectArrows', () => {
  const mockOnQuickConnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useFlowStore as any).mockImplementation((selector: any) => {
      const state = {
        colorMode: 'dark',
        onQuickConnect: mockOnQuickConnect,
      };
      return selector(state);
    });
  });

  it('renders connect buttons and triggers onQuickConnect when clicked', () => {
    render(<QuickConnectArrows nodeId="node-1" color="indigo" />);

    const topBtn = screen.getByRole('button', { name: 'Connect Top' });
    const rightBtn = screen.getByRole('button', { name: 'Connect Right' });
    const bottomBtn = screen.getByRole('button', { name: 'Connect Bottom' });
    const leftBtn = screen.getByRole('button', { name: 'Connect Left' });

    expect(topBtn).toBeInTheDocument();
    expect(rightBtn).toBeInTheDocument();
    expect(bottomBtn).toBeInTheDocument();
    expect(leftBtn).toBeInTheDocument();

    fireEvent.click(topBtn);
    expect(mockOnQuickConnect).toHaveBeenCalledWith('node-1', 'top');

    fireEvent.click(rightBtn);
    expect(mockOnQuickConnect).toHaveBeenCalledWith('node-1', 'right');
  });

  it('handles keyboard navigation with Enter and Space keys and ignores other keys', () => {
    render(<QuickConnectArrows nodeId="node-1" />);

    const bottomBtn = screen.getByRole('button', { name: 'Connect Bottom' });

    fireEvent.keyDown(bottomBtn, { key: 'Escape' });
    expect(mockOnQuickConnect).not.toHaveBeenCalled();

    fireEvent.keyDown(bottomBtn, { key: 'Enter' });
    expect(mockOnQuickConnect).toHaveBeenCalledWith('node-1', 'bottom');

    fireEvent.keyDown(bottomBtn, { key: ' ' });
    expect(mockOnQuickConnect).toHaveBeenCalledWith('node-1', 'bottom');
  });

  it('renders correctly in light mode', () => {
    (useFlowStore as any).mockImplementation((selector: any) => {
      const state = {
        colorMode: 'light',
        onQuickConnect: mockOnQuickConnect,
      };
      return selector(state);
    });

    render(<QuickConnectArrows nodeId="node-1" color="emerald" />);
    const topBtn = screen.getByRole('button', { name: 'Connect Top' });
    expect(topBtn).toBeInTheDocument();
  });
});
