import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalToolbar } from '../../../src/activity/terminal/TerminalPanel';
import '@testing-library/jest-dom';

describe('TerminalToolbar', () => {
  const defaultProps = {
    terminalActiveTab: 'activity' as const,
    setTerminalActiveTab: vi.fn(),
    activityTabClass: 'border-blue-500 text-white',
    logsTabClass: 'border-transparent text-slate-500',
    loggableResources: [
      { id: 'pod-1', type: 'Pod', data: { label: 'web-pod' } },
      { id: 'dep-1', type: 'Deployment', data: { label: 'api-dep' } },
    ] as any,
    terminalSelectedResourceId: 'pod-1',
    setTerminalSelectedResourceId: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    handleExportLogs: vi.fn(),
    clearTerminalLogs: vi.fn(),
    setTerminalOpen: vi.fn(),
    colorMode: 'dark' as const,
  };

  it('renders Kube Console title and tab buttons', () => {
    render(<TerminalToolbar {...defaultProps} />);

    expect(screen.getByText('Kube Console')).toBeInTheDocument();
    expect(screen.getByText('Kubectl Activity')).toBeInTheDocument();
    expect(screen.getByText('Kube Logs')).toBeInTheDocument();
  });

  it('handles switching active tab', () => {
    render(<TerminalToolbar {...defaultProps} />);

    const logsTabBtn = screen.getByText('Kube Logs');
    fireEvent.click(logsTabBtn);

    expect(defaultProps.setTerminalActiveTab).toHaveBeenCalledWith('logs');
  });

  it('renders resource dropdown in logs tab and updates selected resource', () => {
    render(
      <TerminalToolbar
        {...defaultProps}
        terminalActiveTab="logs"
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('pod/web-pod')).toBeInTheDocument();
    expect(screen.getByText('deployment/api-dep')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'dep-1' } });
    expect(defaultProps.setTerminalSelectedResourceId).toHaveBeenCalledWith('dep-1');
  });

  it('handles search input filter query changes', () => {
    render(<TerminalToolbar {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Filter logs...');
    fireEvent.change(searchInput, { target: { value: 'status' } });

    expect(defaultProps.setSearchQuery).toHaveBeenCalledWith('status');
  });

  it('triggers log export, log clear, and panel minimize actions', () => {
    render(<TerminalToolbar {...defaultProps} />);

    const exportBtn = screen.getByTestId('terminal-export-log-btn');
    fireEvent.click(exportBtn);
    expect(defaultProps.handleExportLogs).toHaveBeenCalledTimes(1);

    const clearBtn = screen.getByTitle('Clear Terminal Output');
    fireEvent.click(clearBtn);
    expect(defaultProps.clearTerminalLogs).toHaveBeenCalledTimes(1);

    const minimizeBtn = screen.getByTitle('Minimize Panel');
    fireEvent.click(minimizeBtn);
    expect(defaultProps.setTerminalOpen).toHaveBeenCalledWith(false);
  });
});
