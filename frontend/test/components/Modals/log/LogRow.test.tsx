import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogRow } from '@/components/Modals/log/LogRow';
import { LogEntry } from '@/store/types';
import '@testing-library/jest-dom';

describe('LogRow', () => {
  const dummyLog: LogEntry = {
    id: 'log-1',
    level: 'error',
    message: 'CrashLoopBackOff in pod app-web-1',
    timestamp: 1700000000000,
    scope: 'KubeConsole',
  };

  const defaultProps = {
    log: dummyLog,
    isSelected: false,
    isExpanded: false,
    searchQuery: '',
    colorMode: 'dark' as const,
    onToggleSelect: vi.fn(),
    onToggleExpand: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders log row with error badge, scope, timestamp, and handles checkbox selection', () => {
    render(<LogRow {...defaultProps} />);

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByTestId('log-scope-badge')).toHaveTextContent('KubeConsole');
    expect(screen.getByText('CrashLoopBackOff in pod app-web-1')).toBeInTheDocument();

    // Checkbox click
    const checkbox = screen.getByTestId('log-checkbox');
    fireEvent.click(checkbox);
    expect(defaultProps.onToggleSelect).toHaveBeenCalledWith('log-1');

    // Row expansion click
    const rowBtn = screen.getByRole('button', { name: /CrashLoopBackOff/i });
    fireEvent.click(rowBtn);
    expect(defaultProps.onToggleExpand).toHaveBeenCalledWith('log-1');

    // Delete button click
    const deleteBtn = screen.getByTitle('Delete log');
    fireEvent.click(deleteBtn);
    expect(defaultProps.onDelete).toHaveBeenCalledWith('log-1');
  });

  it('renders warn and info log levels in light mode with selected state and search highlighting', () => {
    const warnLog: LogEntry = {
      id: 'log-2',
      level: 'warn',
      message: 'High CPU utilization detected',
      timestamp: 1700000000000,
      scope: 'Simulation',
    };

    const { rerender } = render(
      <LogRow
        {...defaultProps}
        log={warnLog}
        isSelected={true}
        searchQuery="CPU"
        colorMode="light"
      />
    );

    expect(screen.getByText('warn')).toBeInTheDocument();
    expect(screen.getByText('CPU')).toHaveClass('bg-amber-400/30');

    const infoLog: LogEntry = {
      id: 'log-3',
      level: 'info',
      message: 'Pod started successfully',
      timestamp: 1700000000000,
    };

    rerender(
      <LogRow
        {...defaultProps}
        log={infoLog}
        isSelected={false}
        searchQuery=""
        colorMode="dark"
      />
    );

    expect(screen.getByText('info')).toBeInTheDocument();
    expect(screen.getByTestId('log-scope-badge')).toHaveTextContent('System');
  });
});
