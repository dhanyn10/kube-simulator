import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalPanel, handleGetPods, handleGetDeployments, handleGetServices, handleLogsCommand, handleDescribeCommand } from '../../../src/components/Layout/TerminalPanel';
import { useFlowStore } from '../../../src/store/useFlowStore';
import '@testing-library/jest-dom';

// Simple mock for scrollIntoView as it doesn't exist in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('TerminalPanel', () => {
  beforeEach(() => {
    const state = useFlowStore.getState();
    state.clearTerminalLogs();
    state.setTerminalOpen(false);
    state.setTerminalActiveTab('activity');
    state.setTerminalSelectedResourceId(null);
    useFlowStore.setState({
      nodes: [
        { id: 'pod-1', type: 'Pod', data: { label: 'web-pod' }, position: { x: 0, y: 0 } },
        { id: 'dep-1', type: 'Deployment', data: { label: 'api-dep' }, position: { x: 10, y: 10 } }
      ]
    });
  });

  it('renders minimized button when isTerminalOpen is false', () => {
    render(<TerminalPanel />);
    expect(screen.getByText('Kube Terminal')).toBeInTheDocument();
    expect(screen.queryByTestId('terminal-container')).toBeNull();
  });

  it('renders full terminal panel when isTerminalOpen is true', () => {
    useFlowStore.setState({ isTerminalOpen: true });
    render(<TerminalPanel />);
    expect(screen.getByTestId('terminal-container')).toBeInTheDocument();
    expect(screen.getByText('Kube Console')).toBeInTheDocument();
    expect(screen.getByText('Kubectl Activity')).toBeInTheDocument();
    expect(screen.getByText('Kube Logs')).toBeInTheDocument();
  });

  it('renders kubectl activity logs', () => {
    useFlowStore.setState({
      isTerminalOpen: true,
      activityLogs: ['$ kubectl apply -f manifest.yaml', 'deployment.apps/api-dep created']
    });

    render(<TerminalPanel />);
    expect(screen.getByText('$ kubectl apply -f manifest.yaml')).toBeInTheDocument();
    expect(screen.getByText('deployment.apps/api-dep created')).toBeInTheDocument();
  });

  it('allows switching tabs', () => {
    useFlowStore.setState({ isTerminalOpen: true });
    render(<TerminalPanel />);

    const logsTab = screen.getByText('Kube Logs');
    fireEvent.click(logsTab);

    expect(useFlowStore.getState().terminalActiveTab).toBe('logs');
  });

  it('allows filtering logs via search', () => {
    useFlowStore.setState({
      isTerminalOpen: true,
      activityLogs: ['line one', 'line two', 'another line']
    });

    render(<TerminalPanel />);
    expect(screen.getByText('line one')).toBeInTheDocument();
    expect(screen.getByText('line two')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Filter logs...');
    fireEvent.change(searchInput, { target: { value: 'one' } });

    // Using a custom text matcher to account for text split by <mark> elements
    expect(screen.getByText((_, element) => element?.tagName === 'SPAN' && element?.textContent === 'line one')).toBeInTheDocument();
    expect(screen.queryByText((_, element) => element?.tagName === 'SPAN' && element?.textContent === 'line two')).toBeNull();
  });

  it('handles help command', () => {
    useFlowStore.setState({ isTerminalOpen: true, isSimulating: true });
    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input');
    fireEvent.change(input, { target: { value: 'help' } });
    fireEvent.submit(screen.getByTestId('terminal-cli-input').closest('form')!);

    expect(screen.getByText('Available educational Kubernetes commands:')).toBeInTheDocument();
  });

  it('handles kubectl get pods command', () => {
    useFlowStore.setState({ isTerminalOpen: true, isSimulating: true });
    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input');
    fireEvent.change(input, { target: { value: 'kubectl get pods' } });
    fireEvent.submit(screen.getByTestId('terminal-cli-input').closest('form')!);

    expect(screen.getByText((_, element) => element?.tagName === 'SPAN' && (element?.textContent?.includes('web-pod') ?? false))).toBeInTheDocument();
  });

  it('handles kubectl get pods -w command', () => {
    useFlowStore.setState({ isTerminalOpen: true, isSimulating: true });
    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input');
    fireEvent.change(input, { target: { value: 'kubectl get pods -w' } });
    fireEvent.submit(screen.getByTestId('terminal-cli-input').closest('form')!);

    expect(screen.getByText((_, element) => element?.tagName === 'SPAN' && (element?.textContent?.includes('web-pod') ?? false))).toBeInTheDocument();
  });

  it('navigates through command history with Up and Down arrows', () => {
    useFlowStore.setState({ isTerminalOpen: true, isSimulating: true });
    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input') as HTMLInputElement;

    // Submit first command
    fireEvent.change(input, { target: { value: 'kubectl get pods' } });
    fireEvent.submit(input.closest('form')!);

    // Submit second command
    fireEvent.change(input, { target: { value: 'help' } });
    fireEvent.submit(input.closest('form')!);

    // Press ArrowUp to get 'help'
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('help');

    // Press ArrowUp again to get 'kubectl get pods'
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('kubectl get pods');

    // Press ArrowDown to get 'help'
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('help');

    // Press ArrowDown again to clear
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('');
  });

  it('handles kubectl get services command', () => {
    useFlowStore.setState({
      isTerminalOpen: true,
      isSimulating: true,
      nodes: [
        { id: 'svc-1', type: 'Service', data: { label: 'web-service', port: 80 }, position: { x: 0, y: 0 } }
      ]
    });
    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input');
    fireEvent.change(input, { target: { value: 'kubectl get services' } });
    fireEvent.submit(screen.getByTestId('terminal-cli-input').closest('form')!);

    expect(screen.getByText((_, element) => element?.tagName === 'SPAN' && (element?.textContent?.includes('web-service') ?? false))).toBeInTheDocument();
  });

  it('handles kubectl describe pod command', () => {
    useFlowStore.setState({ isTerminalOpen: true, isSimulating: true });
    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input');
    fireEvent.change(input, { target: { value: 'kubectl describe pod web-pod' } });
    fireEvent.submit(screen.getByTestId('terminal-cli-input').closest('form')!);

    expect(screen.getByText(/Name:\s+web-pod/)).toBeInTheDocument();
    expect(screen.getByText(/Successfully assigned default\/web-pod/)).toBeInTheDocument();
  });

  it('paginates logs in Kubernetes Logs tab', () => {
    // Generate 60 mock log lines for pod-1
    const testLogs = Array.from({ length: 60 }, (_, i) => `log line ${i + 1}`);
    useFlowStore.setState({
      isTerminalOpen: true,
      terminalActiveTab: 'logs',
      terminalSelectedResourceId: 'pod-1',
      terminalLogs: { 'pod-1': testLogs }
    });

    render(<TerminalPanel />);

    // Page 1 should display logs 1 to 25 (PAGE_SIZE = 25)
    expect(screen.getByText('log line 1')).toBeInTheDocument();
    expect(screen.getByText('log line 25')).toBeInTheDocument();
    expect(screen.queryByText('log line 26')).toBeNull();

    expect(screen.getByText('Showing 1-25 of 60 logs')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    // Click Next button to go to Page 2
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn);

    expect(screen.queryByText('log line 25')).toBeNull();
    expect(screen.getByText('log line 26')).toBeInTheDocument();
    expect(screen.getByText('log line 50')).toBeInTheDocument();
    expect(screen.queryByText('log line 51')).toBeNull();
    expect(screen.getByText('Showing 26-50 of 60 logs')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    // Click Prev button to go back to Page 1
    const prevBtn = screen.getByRole('button', { name: 'Prev' });
    fireEvent.click(prevBtn);

    expect(screen.getByText('log line 25')).toBeInTheDocument();
    expect(screen.queryByText('log line 26')).toBeNull();
  });

  describe('unit tests for extracted command helpers', () => {
    it('handleGetPods outputs correct table headers and pod information', () => {
      const addLog = vi.fn();
      const nodes = [
        { id: 'pod-test', type: 'Pod', data: { label: 'test-pod', status: 'ready' } }
      ] as any;
      handleGetPods(addLog, nodes, true);
      expect(addLog).toHaveBeenCalledTimes(2);
      expect(addLog).toHaveBeenNthCalledWith(1, expect.stringContaining('READY   STATUS'));
      expect(addLog).toHaveBeenNthCalledWith(2, expect.stringContaining('test-pod'));
    });

    it('handleGetPods logs correctly when no workloads are found', () => {
      const addLog = vi.fn();
      handleGetPods(addLog, [], false);
      expect(addLog).toHaveBeenCalledWith('No pods or workloads found on the canvas.');
    });

    it('handleGetDeployments outputs correct deployment table info', () => {
      const addLog = vi.fn();
      const nodes = [
        { id: 'dep-test', type: 'Deployment', data: { label: 'test-dep', replicas: 3 } }
      ] as any;
      handleGetDeployments(addLog, nodes, true);
      expect(addLog).toHaveBeenCalledTimes(2);
      expect(addLog).toHaveBeenNthCalledWith(2, expect.stringContaining('test-dep'));
    });

    it('handleGetDeployments logs correctly when no deployments exist', () => {
      const addLog = vi.fn();
      handleGetDeployments(addLog, [], false);
      expect(addLog).toHaveBeenCalledWith('No deployments found on the canvas.');
    });

    it('handleGetServices logs correctly when no services exist', () => {
      const addLog = vi.fn();
      handleGetServices(addLog, []);
      expect(addLog).toHaveBeenCalledWith('No services found on the canvas.');
    });

    it('handleLogsCommand returns false when command does not match logs pattern', () => {
      const result = handleLogsCommand('kubectl get pods', vi.fn(), [], vi.fn(), vi.fn());
      expect(result).toBe(false);
    });

    it('handleLogsCommand updates terminal settings when matching workload exists', () => {
      const addLog = vi.fn();
      const setSelected = vi.fn();
      const setActiveTab = vi.fn();
      const nodes = [
        { id: 'pod-t', type: 'Pod', data: { label: 'my-pod' } }
      ] as any;

      const result = handleLogsCommand('kubectl logs pod/my-pod', addLog, nodes, setSelected, setActiveTab);
      expect(result).toBe(true);
      expect(setSelected).toHaveBeenCalledWith('pod-t');
      expect(setActiveTab).toHaveBeenCalledWith('logs');
      expect(addLog).toHaveBeenCalledWith(expect.stringContaining('Switched console output stream'));
    });

    it('handleDescribeCommand returns false on non-describe command', () => {
      const result = handleDescribeCommand('kubectl logs pod-x', vi.fn(), [], false);
      expect(result).toBe(false);
    });

    it('handleDescribeCommand logs descriptive output when pod is found', () => {
      const addLog = vi.fn();
      const nodes = [
        { id: 'pod-x', type: 'Pod', data: { label: 'found-pod', cpuLimit: '200m', memoryLimit: '128Mi' } }
      ] as any;

      const result = handleDescribeCommand('kubectl describe pod found-pod', addLog, nodes, true);
      expect(result).toBe(true);
      expect(addLog).toHaveBeenCalledWith(expect.stringContaining('Name:         found-pod'));
    });
  });
});
