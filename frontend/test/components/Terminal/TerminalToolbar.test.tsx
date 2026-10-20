import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    const activityTabBtn = screen.getByText('Kubectl Activity');
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

  it('renders correctly in light mode', () => {
    render(<TerminalToolbar {...defaultProps} colorMode="light" />);
    expect(screen.getByText('Kube Console')).toBeInTheDocument();
  });
});
