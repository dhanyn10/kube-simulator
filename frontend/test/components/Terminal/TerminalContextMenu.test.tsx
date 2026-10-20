import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TerminalContextMenu } from '@/components/Terminal/TerminalContextMenu';

describe('TerminalContextMenu', () => {
  const defaultProps = {
    x: 100,
    y: 150,
    onClose: vi.fn(),
    colorMode: 'dark' as const,
    showAuth: true,
    onToggleAuth: vi.fn(),
    showFilterLogs: true,
    onToggleFilterLogs: vi.fn(),
    showExportLogs: true,
    onToggleExportLogs: vi.fn(),
  };

  it('renders context menu with VS Code style checklist options checked by default', () => {
    render(<TerminalContextMenu {...defaultProps} />);

    const menu = screen.getByTestId('terminal-context-menu');
    expect(menu).toBeInTheDocument();

    const authBtn = screen.getByTestId('terminal-context-auth');
    const filterBtn = screen.getByTestId('terminal-context-filter-logs');
    const exportBtn = screen.getByTestId('terminal-context-export-log-file');

    expect(authBtn).toHaveAttribute('aria-checked', 'true');
    expect(filterBtn).toHaveAttribute('aria-checked', 'true');
    expect(exportBtn).toHaveAttribute('aria-checked', 'true');

    // Check slots have checkmark SVGs
    const authSlot = screen.getByTestId('terminal-check-slot-auth');
    expect(authSlot.querySelector('svg')).toBeInTheDocument();

    expect(screen.getByText('Auth')).toBeInTheDocument();
    expect(screen.getByText('Filter logs')).toBeInTheDocument();
    expect(screen.getByText('Export log file')).toBeInTheDocument();
  });

  it('handles toggling auth option', () => {
    render(<TerminalContextMenu {...defaultProps} />);

    const authBtn = screen.getByTestId('terminal-context-auth');
    fireEvent.click(authBtn);

    expect(defaultProps.onToggleAuth).toHaveBeenCalledTimes(1);
  });

  it('handles toggling filter logs option', () => {
    render(<TerminalContextMenu {...defaultProps} />);

    const filterBtn = screen.getByTestId('terminal-context-filter-logs');
    fireEvent.click(filterBtn);

    expect(defaultProps.onToggleFilterLogs).toHaveBeenCalledTimes(1);
  });

  it('handles toggling export log file option', () => {
    render(<TerminalContextMenu {...defaultProps} />);

    const exportBtn = screen.getByTestId('terminal-context-export-log-file');
    fireEvent.click(exportBtn);

    expect(defaultProps.onToggleExportLogs).toHaveBeenCalledTimes(1);
  });

  it('renders unchecked states in light mode with empty check slots', () => {
    render(
      <TerminalContextMenu
        {...defaultProps}
        colorMode="light"
        showAuth={false}
        showFilterLogs={false}
        showExportLogs={false}
      />
    );

    const authBtn = screen.getByTestId('terminal-context-auth');
    const filterBtn = screen.getByTestId('terminal-context-filter-logs');
    const exportBtn = screen.getByTestId('terminal-context-export-log-file');

    expect(authBtn).toHaveAttribute('aria-checked', 'false');
    expect(filterBtn).toHaveAttribute('aria-checked', 'false');
    expect(exportBtn).toHaveAttribute('aria-checked', 'false');

    const authSlot = screen.getByTestId('terminal-check-slot-auth');
    expect(authSlot.querySelector('svg')).toBeNull();
  });

  it('closes on Escape key press', () => {
    render(<TerminalContextMenu {...defaultProps} />);

    fireEvent.keyDown(globalThis, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('ignores other key presses', () => {
    const onClose = vi.fn();
    render(<TerminalContextMenu {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(globalThis, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('prevents default and stops propagation on context menu inside the menu element', () => {
    render(<TerminalContextMenu {...defaultProps} />);

    const menu = screen.getByTestId('terminal-context-menu');
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const prevented = !menu.dispatchEvent(event);
    expect(prevented).toBe(true);
  });
});
