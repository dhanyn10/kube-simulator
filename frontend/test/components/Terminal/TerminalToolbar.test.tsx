import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TerminalToolbar } from '@/components/Terminal/TerminalToolbar';
import { useFlowStore } from '@/store';
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
    terminalSelectedResourceId: null,
    setTerminalSelectedResourceId: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    handleExportLogs: vi.fn(),
    clearTerminalLogs: vi.fn(),
    setTerminalOpen: vi.fn(),
    colorMode: 'dark' as const,
  };

  beforeEach(() => {
    useFlowStore.setState({
      terminalShowAuth: true,
      terminalShowFilterLogs: true,
      terminalShowExportLogs: true,
    });
  });

  it('renders tab buttons without Kube Console text', () => {
    render(<TerminalToolbar {...defaultProps} />);

    expect(screen.queryByText('Kube Console')).not.toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('handles switching active tab', () => {
    render(<TerminalToolbar {...defaultProps} />);

    const logsTabBtn = screen.getByText('Logs');
    fireEvent.click(logsTabBtn);

    expect(defaultProps.setTerminalActiveTab).toHaveBeenCalledWith('logs');

    const activityTabBtn = screen.getByText('Activity');
    fireEvent.click(activityTabBtn);
    expect(defaultProps.setTerminalActiveTab).toHaveBeenCalledWith('activity');
  });

  it('renders resource dropdown in logs tab and updates selected resource', () => {
    render(
      <TerminalToolbar
        {...defaultProps}
        terminalActiveTab="logs"
      />
    );

    const select = screen.getByTestId('terminal-resource-select');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('pod/web-pod')).toBeInTheDocument();
    expect(screen.getByText('deployment/api-dep')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'dep-1' } });
    expect(defaultProps.setTerminalSelectedResourceId).toHaveBeenCalledWith('dep-1');
  });

  it('renders resource dropdown in light mode without label', () => {
    render(
      <TerminalToolbar
        {...defaultProps}
        colorMode="light"
        terminalActiveTab="logs"
        loggableResources={[{ id: 'pod-2', type: 'Pod' } as any]}
      />
    );
    expect(screen.getByText('pod/pod-2')).toBeInTheDocument();
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

  it('opens IAM modal when Auth button is clicked', () => {
    const setKubeIamModalOpen = vi.fn();
    useFlowStore.setState({ setKubeIamModalOpen });
    render(<TerminalToolbar {...defaultProps} />);

    const authBtn = screen.getByTitle('Open Kube IAM Management');
    fireEvent.click(authBtn);
    expect(setKubeIamModalOpen).toHaveBeenCalledWith(true);
  });

  it('renders IAM users and handles changing active identity', () => {
    const setActiveIdentity = vi.fn();
    useFlowStore.setState({
      activeIdentity: 'system:admin',
      setActiveIdentity,
      iamUsers: [
        { id: 'u1', username: 'dev-alice' } as any,
        { id: 'u2', username: 'ops-bob' } as any,
      ],
    });
    render(<TerminalToolbar {...defaultProps} />);

    const identitySelect = screen.getByTestId('terminal-identity-select');
    expect(screen.getByText('dev-alice')).toBeInTheDocument();
    expect(screen.getByText('ops-bob')).toBeInTheDocument();

    fireEvent.change(identitySelect, { target: { value: 'dev-alice' } });
    expect(setActiveIdentity).toHaveBeenCalledWith('dev-alice');
  });

  it('renders correctly in light mode without Kube Console text', () => {
    render(<TerminalToolbar {...defaultProps} colorMode="light" />);
    expect(screen.queryByText('Kube Console')).not.toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('opens context menu on right click on terminal toolbar and allows toggling auth, filter logs, and export', () => {
    const { container } = render(<TerminalToolbar {...defaultProps} />);
    const toolbar = container.querySelector('.terminal-toolbar')!;
    expect(toolbar).toBeInTheDocument();

    expect(screen.getByTestId('terminal-auth-section')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-filter-section')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-export-log-btn')).toBeInTheDocument();

    // Right-click on toolbar
    fireEvent.contextMenu(toolbar, { clientX: 200, clientY: 100 });

    const contextMenu = screen.getByTestId('terminal-context-menu');
    expect(contextMenu).toBeInTheDocument();

    const authOption = screen.getByTestId('terminal-context-auth');
    const filterOption = screen.getByTestId('terminal-context-filter-logs');
    const exportOption = screen.getByTestId('terminal-context-export-log-file');

    expect(authOption).toHaveAttribute('aria-checked', 'true');
    expect(filterOption).toHaveAttribute('aria-checked', 'true');
    expect(exportOption).toHaveAttribute('aria-checked', 'true');

    // Toggle Auth off
    fireEvent.click(authOption);
    expect(screen.queryByTestId('terminal-auth-section')).not.toBeInTheDocument();

    // Toggle Filter logs off
    fireEvent.click(filterOption);
    expect(screen.queryByTestId('terminal-filter-section')).not.toBeInTheDocument();

    // Toggle Export log file off
    fireEvent.click(exportOption);
    expect(screen.queryByTestId('terminal-export-log-btn')).not.toBeInTheDocument();

    // Toggle Auth back on
    fireEvent.click(authOption);
    expect(screen.getByTestId('terminal-auth-section')).toBeInTheDocument();

    // Close menu by clicking outside
    fireEvent.click(document.body);
    expect(screen.queryByTestId('terminal-context-menu')).not.toBeInTheDocument();
  });

  it('supports custom prop handlers for visibility toggles', () => {
    const setShowAuth = vi.fn();
    const setShowFilterLogs = vi.fn();
    const setShowExportLogs = vi.fn();

    const { container } = render(
      <TerminalToolbar
        {...defaultProps}
        showAuth={false}
        setShowAuth={setShowAuth}
        showFilterLogs={false}
        setShowFilterLogs={setShowFilterLogs}
        showExportLogs={false}
        setShowExportLogs={setShowExportLogs}
      />
    );

    expect(screen.queryByTestId('terminal-auth-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terminal-filter-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terminal-export-log-btn')).not.toBeInTheDocument();

    const toolbar = container.querySelector('.terminal-toolbar')!;
    fireEvent.contextMenu(toolbar, { clientX: 150, clientY: 80 });

    const authOption = screen.getByTestId('terminal-context-auth');
    fireEvent.click(authOption);
    expect(setShowAuth).toHaveBeenCalledWith(true);

    const filterOption = screen.getByTestId('terminal-context-filter-logs');
    fireEvent.click(filterOption);
    expect(setShowFilterLogs).toHaveBeenCalledWith(true);

    const exportOption = screen.getByTestId('terminal-context-export-log-file');
    fireEvent.click(exportOption);
    expect(setShowExportLogs).toHaveBeenCalledWith(true);
  });
});
