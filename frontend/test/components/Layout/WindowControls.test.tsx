import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WindowControls } from '../../../src/components/Layout/WindowControls';

describe('WindowControls', () => {
  const mockMinimize = vi.fn();
  const mockMaximize = vi.fn();
  const mockClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).go = {
      main: {
        App: {
          MinimizeWindow: mockMinimize,
          MaximizeWindow: mockMaximize,
          CloseWindow: mockClose,
        }
      }
    };
  });

  it('calls WindowMinimize when minimize button is clicked', () => {
    render(<WindowControls colorMode="light" />);
    const minBtn = screen.getByLabelText('minimize');
    fireEvent.click(minBtn);
    expect(mockMinimize).toHaveBeenCalled();
  });

  it('calls WindowMaximize when maximize button is clicked', () => {
    render(<WindowControls colorMode="light" />);
    const maxBtn = screen.getByLabelText('maximize');
    fireEvent.click(maxBtn);
    expect(mockMaximize).toHaveBeenCalled();
  });

  it('calls WindowClose when close button is clicked', () => {
    render(<WindowControls colorMode="light" />);
    const closeBtn = screen.getByLabelText('close');
    fireEvent.click(closeBtn);
    expect(mockClose).toHaveBeenCalled();
  });

  it('applies dark mode classes', () => {
    render(<WindowControls colorMode="dark" />);
    const minBtn = screen.getByLabelText('minimize');
    expect(minBtn.className).toContain('hover:bg-slate-800');
  });

  it('handles missing go global gracefully', () => {
    delete (window as any).go;
    render(<WindowControls colorMode="light" />);
    const minBtn = screen.getByLabelText('minimize');
    fireEvent.click(minBtn); // Should not crash
  });
});
