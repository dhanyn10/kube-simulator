import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TerminalPanel, handleGetPods, handleGetDeployments, handleGetServices, handleLogsCommand, handleDescribeCommand, generateLogFilename, exportLogFile, handleHistoryCommand, formatCommandTimestamp, CommandHistoryEntry } from '../../../../src/components/Activity/Terminal/TerminalPanel';
import { useFlowStore } from '../../../../src/store/useFlowStore';
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
      colorMode: 'dark',
      nodes: [
        { id: 'pod-1', type: 'Pod', data: { label: 'web-pod' }, position: { x: 0, y: 0 } },
        { id: 'dep-1', type: 'Deployment', data: { label: 'api-dep' }, position: { x: 10, y: 10 } }
      ]
    });
  });

  it('renders null when isTerminalOpen is false', () => {
    const { container } = render(<TerminalPanel />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('terminal-container')).toBeNull();
  });

  it('renders full terminal panel when isTerminalOpen is true', () => {
    act(() => {
      useFlowStore.setState({ isTerminalOpen: true });
    });
    render(<TerminalPanel />);
    expect(screen.getByTestId('terminal-container')).toBeInTheDocument();
    expect(screen.getByText('Kube Console')).toBeInTheDocument();
    expect(screen.getByText('Kubectl Activity')).toBeInTheDocument();
    expect(screen.getByText('Kube Logs')).toBeInTheDocument();
  });

  it('renders kubectl activity logs', () => {
    act(() => {
      useFlowStore.setState({
        isTerminalOpen: true,
        activityLogs: ['$ kubectl apply -f manifest.yaml', 'deployment.apps/api-dep created']
      });
    });

    render(<TerminalPanel />);
    expect(screen.getByText('$ kubectl apply -f manifest.yaml')).toBeInTheDocument();
    expect(screen.getByText('deployment.apps/api-dep created')).toBeInTheDocument();
  });

  it('allows switching tabs', () => {
    act(() => {
      useFlowStore.setState({ isTerminalOpen: true });
    });
    render(<TerminalPanel />);

    const logsTab = screen.getByText('Kube Logs');
    fireEvent.click(logsTab);

    expect(useFlowStore.getState().terminalActiveTab).toBe('logs');
  });

  it('allows filtering logs via search', () => {
    act(() => {
      useFlowStore.setState({
        isTerminalOpen: true,
        activityLogs: ['line one', 'line two', 'another line']
      });
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
    act(() => {
      useFlowStore.setState({ isTerminalOpen: true, isSimulating: true });
    });
    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input');
    fireEvent.change(input, { target: { value: 'help' } });
    fireEvent.submit(screen.getByTestId('terminal-cli-input').closest('form')!);

    expect(screen.getByText('Available educational Kubernetes commands:')).toBeInTheDocument();
  });

  it('handles history command and displays command history with timestamps', () => {
    act(() => {
      useFlowStore.setState({ isTerminalOpen: true, isSimulating: true });
    });
    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input');

    // Run first command
    fireEvent.change(input, { target: { value: 'kubectl get pods' } });
    fireEvent.submit(input.closest('form')!);

    // Run history command
    fireEvent.change(input, { target: { value: 'history' } });
    fireEvent.submit(input.closest('form')!);

    // Should display history output
    expect(screen.getAllByText((_, element) => element?.tagName === 'SPAN' && (element?.textContent?.includes('history') ?? false)).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.tagName === 'SPAN' && (element?.textContent?.includes('kubectl get pods') ?? false)).length).toBeGreaterThan(0);
  });

  it('handles kubectl get pods command', () => {
    act(() => {
      useFlowStore.setState({ isTerminalOpen: true, isSimulating: true });
    });
    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input');
    fireEvent.change(input, { target: { value: 'kubectl get pods' } });
    fireEvent.submit(screen.getByTestId('terminal-cli-input').closest('form')!);

    expect(screen.getByText((_, element) => element?.tagName === 'SPAN' && (element?.textContent?.includes('web-pod') ?? false))).toBeInTheDocument();
  });

  it('handles kubectl get pods -w command', () => {
    act(() => {
      useFlowStore.setState({ isTerminalOpen: true, isSimulating: true });
    });
    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input');
    fireEvent.change(input, { target: { value: 'kubectl get pods -w' } });
    fireEvent.submit(screen.getByTestId('terminal-cli-input').closest('form')!);

    expect(screen.getByText((_, element) => element?.tagName === 'SPAN' && (element?.textContent?.includes('web-pod') ?? false))).toBeInTheDocument();
  });

  it('navigates through command history with Up and Down arrows', () => {
    act(() => {
      useFlowStore.setState({ isTerminalOpen: true, isSimulating: true });
    });
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
    act(() => {
      useFlowStore.setState({
        isTerminalOpen: true,
        isSimulating: true,
        nodes: [
          { id: 'svc-1', type: 'Service', data: { label: 'web-service', port: 80 }, position: { x: 0, y: 0 } }
        ]
      });
    });
    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input');
    fireEvent.change(input, { target: { value: 'kubectl get services' } });
    fireEvent.submit(screen.getByTestId('terminal-cli-input').closest('form')!);

    expect(screen.getByText((_, element) => element?.tagName === 'SPAN' && (element?.textContent?.includes('web-service') ?? false))).toBeInTheDocument();
  });

  it('handles kubectl describe pod command', () => {
    act(() => {
      useFlowStore.setState({ isTerminalOpen: true, isSimulating: true });
    });
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
    act(() => {
      useFlowStore.setState({
        isTerminalOpen: true,
        terminalActiveTab: 'logs',
        terminalSelectedResourceId: 'pod-1',
        terminalLogs: { 'pod-1': testLogs }
      });
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

    it('formatCommandTimestamp formats date into YYYY-MM-DD HH:MM:SS string', () => {
      const mockDate = new Date('2026-03-30T10:15:20');
      const formatted = formatCommandTimestamp(mockDate);
      expect(formatted).toBe('2026-03-30 10:15:20');
    });

    it('handleHistoryCommand outputs formatted history entries', () => {
      const addLog = vi.fn();
      const entries: CommandHistoryEntry[] = [
        { id: 1, command: 'kubectl get pods', timestamp: '2026-03-30 10:15:20' },
        { id: 2, command: 'history', timestamp: '2026-03-30 10:15:25' },
      ];

      const result = handleHistoryCommand('history', entries, addLog);
      expect(result).toBe(true);
      expect(addLog).toHaveBeenCalledTimes(2);
      expect(addLog).toHaveBeenNthCalledWith(1, '    1  2026-03-30 10:15:20  kubectl get pods');
      expect(addLog).toHaveBeenNthCalledWith(2, '    2  2026-03-30 10:15:25  history');
    });

    it('handleHistoryCommand handles empty history list', () => {
      const addLog = vi.fn();
      const result = handleHistoryCommand('history', [], addLog);
      expect(result).toBe(true);
      expect(addLog).toHaveBeenCalledWith('No command history recorded.');
    });
  });

  describe('additional styling and behavior tests', () => {
    it('applies correct tab highlight classes based on colorMode and active status', () => {
      act(() => {
        useFlowStore.setState({ isTerminalOpen: true, terminalActiveTab: 'activity', colorMode: 'dark' });
      });
      const { rerender } = render(<TerminalPanel />);
      let activityTab = screen.getByText('Kubectl Activity');
      expect(activityTab.className).toContain('text-white');

      act(() => {
        useFlowStore.setState({ colorMode: 'light' });
      });
      rerender(<TerminalPanel />);
      activityTab = screen.getByText('Kubectl Activity');
      expect(activityTab.className).toContain('text-slate-900');

      act(() => {
        useFlowStore.setState({ terminalActiveTab: 'logs', colorMode: 'dark' });
      });
      rerender(<TerminalPanel />);
      activityTab = screen.getByText('Kubectl Activity');
      expect(activityTab.className).toContain('text-slate-500');

      act(() => {
        useFlowStore.setState({ colorMode: 'light' });
      });
      rerender(<TerminalPanel />);
      activityTab = screen.getByText('Kubectl Activity');
      expect(activityTab.className).toContain('text-slate-400');
    });

    it('disables Prev/Next pagination buttons correctly on first and last page boundaries', () => {
      const testLogs = Array.from({ length: 30 }, (_, i) => `log line ${i + 1}`);
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          terminalActiveTab: 'logs',
          terminalSelectedResourceId: 'pod-1',
          terminalLogs: { 'pod-1': testLogs }
        });
      });

      render(<TerminalPanel />);

      const prevBtn = screen.getByRole('button', { name: 'Prev' });
      const nextBtn = screen.getByRole('button', { name: 'Next' });

      expect(prevBtn).toBeDisabled();
      expect(nextBtn).not.toBeDisabled();

      fireEvent.click(nextBtn);

      expect(prevBtn).not.toBeDisabled();
      expect(nextBtn).toBeDisabled();
    });

    it('highlights matched search queries within logs', () => {
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          terminalActiveTab: 'logs',
          terminalSelectedResourceId: 'pod-1',
          terminalLogs: { 'pod-1': ['Executing system logs for database connection'] }
        });
      });

      render(<TerminalPanel />);

      const searchInput = screen.getByPlaceholderText('Filter logs...');
      fireEvent.change(searchInput, { target: { value: 'database' } });

      const markElement = screen.getByText('database');
      expect(markElement).toBeInTheDocument();
      expect(markElement.tagName).toBe('MARK');
    });

    it('renders Autoscroll checkbox and handles toggle and manual scroll up uncheck', () => {
      vi.useFakeTimers();

      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          terminalActiveTab: 'activity',
          activityLogs: Array.from({ length: 50 }, (_, i) => `log line ${i + 1}`)
        });
      });

      const { container } = render(<TerminalPanel />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const autoscrollCheckbox = screen.getByTestId('autoscroll-checkbox-activity') as HTMLInputElement;
      expect(autoscrollCheckbox).toBeInTheDocument();
      expect(autoscrollCheckbox.checked).toBe(true);

      // Simulate manual scroll up on the content area
      const contentArea = container.querySelector('.terminal-content-area')!;
      Object.defineProperty(contentArea, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(contentArea, 'scrollTop', { value: 100, configurable: true });
      Object.defineProperty(contentArea, 'clientHeight', { value: 300, configurable: true });

      act(() => {
        fireEvent.scroll(contentArea);
      });

      // Autoscroll should automatically be unchecked
      expect(autoscrollCheckbox.checked).toBe(false);

      // Clicking checkbox re-checks it
      act(() => {
        fireEvent.click(autoscrollCheckbox);
      });
      expect(autoscrollCheckbox.checked).toBe(true);

      vi.useRealTimers();
    });

    it('renders Autoscroll checkbox in Kube Logs tab and handles switching selected resource', () => {
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          terminalActiveTab: 'logs',
          terminalSelectedResourceId: 'pod-1',
          terminalLogs: {
            'pod-1': ['pod-1 log line 1', 'pod-1 log line 2'],
            'dep-1': ['dep-1 log line 1', 'dep-1 log line 2']
          }
        });
      });

      render(<TerminalPanel />);

      const autoscrollLogsCheckbox = screen.getByTestId('autoscroll-checkbox-logs') as HTMLInputElement;
      expect(autoscrollLogsCheckbox).toBeInTheDocument();
      expect(autoscrollLogsCheckbox.checked).toBe(true);

      expect(screen.getByText('pod-1 log line 1')).toBeInTheDocument();

      // Change resource dropdown
      const selectResource = screen.getByRole('combobox');
      fireEvent.change(selectResource, { target: { value: 'dep-1' } });

      expect(useFlowStore.getState().terminalSelectedResourceId).toBe('dep-1');
      expect(screen.getByText('dep-1 log line 1')).toBeInTheDocument();
    });

    it('clears terminal logs when clear command is executed', () => {
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          activityLogs: ['line 1', 'line 2']
        });
      });

      render(<TerminalPanel />);
      expect(screen.getByText('line 1')).toBeInTheDocument();

      const input = screen.getByTestId('terminal-cli-input');
      fireEvent.change(input, { target: { value: 'clear' } });
      fireEvent.submit(input.closest('form')!);

      expect(useFlowStore.getState().activityLogs).toHaveLength(0);
    });

    it('outputs command not found message on unknown kubectl command', () => {
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          isSimulating: true
        });
      });

      render(<TerminalPanel />);

      const input = screen.getByTestId('terminal-cli-input');
      fireEvent.change(input, { target: { value: 'kubectl unknowncommand' } });
      fireEvent.submit(input.closest('form')!);

      expect(screen.getByText(/command not found: "kubectl unknowncommand"/)).toBeInTheDocument();
    });

    it('renders autocomplete info button on item hover and opens accordion description when clicked', () => {
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          isSimulating: true
        });
      });

      render(<TerminalPanel />);

      const input = screen.getByTestId('terminal-cli-input');
      fireEvent.change(input, { target: { value: 'kubectl get' } });

      const popup = screen.getByTestId('terminal-autocomplete-popup');
      expect(popup).toBeInTheDocument();

      const infoBtn = screen.getByTestId('autocomplete-info-btn-0');
      expect(infoBtn).toBeInTheDocument();

      fireEvent.click(infoBtn);

      const accordion = screen.getByTestId('autocomplete-description-accordion-0');
      expect(accordion).toBeInTheDocument();
      expect(accordion).toHaveTextContent('List all pods on canvas');
    });

    it('handles keyboard navigation and selection in autocomplete popup', () => {
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          isSimulating: true
        });
      });

      render(<TerminalPanel />);

      const input = screen.getByTestId('terminal-cli-input') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'kubectl get' } });
      expect(screen.getByTestId('terminal-autocomplete-popup')).toBeInTheDocument();

      // Navigate down and up in popup
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      // Enter to complete selection
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(input.value).toBe('kubectl get pods');
    });

    it('handles Tab / Shift+Tab and Arrow keys to cycle through accordion sub-items without blurring input', () => {
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          isSimulating: true,
          nodes: [
            { id: 'pod-1', type: 'Pod', data: { label: 'web-pod' }, position: { x: 0, y: 0 } },
            { id: 'pod-2', type: 'Pod', data: { label: 'api-pod' }, position: { x: 0, y: 0 } }
          ]
        });
      });

      render(<TerminalPanel />);

      const input = screen.getByTestId('terminal-cli-input') as HTMLInputElement;

      // Typing 'kubectl logs' opens dropdown with accordion sub-items
      fireEvent.change(input, { target: { value: 'kubectl logs' } });
      expect(screen.getByTestId('terminal-autocomplete-popup')).toBeInTheDocument();
      expect(screen.getByTestId('autocomplete-subitems-accordion-0')).toBeInTheDocument();

      // Pressing Tab cycles to second sub-item option
      fireEvent.keyDown(input, { key: 'Tab' });

      // Pressing Shift+Tab cycles backward to first sub-item option
      fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });

      // Pressing ArrowRight cycles right
      fireEvent.keyDown(input, { key: 'ArrowRight' });

      // Pressing ArrowLeft cycles left
      fireEvent.keyDown(input, { key: 'ArrowLeft' });

      // Pressing Enter selects current sub-item option
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(input.value).toBe('kubectl logs web-pod');
      expect(screen.queryByTestId('terminal-autocomplete-popup')).toBeNull();
    });

    it('handles clicking on sub-item button directly to complete input', () => {
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          isSimulating: true,
          nodes: [
            { id: 'pod-1', type: 'Pod', data: { label: 'frontend-pod' }, position: { x: 0, y: 0 } },
            { id: 'pod-2', type: 'Pod', data: { label: 'backend-pod' }, position: { x: 0, y: 0 } }
          ]
        });
      });

      render(<TerminalPanel />);

      const input = screen.getByTestId('terminal-cli-input') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'kubectl logs' } });
      expect(screen.getByTestId('terminal-autocomplete-popup')).toBeInTheDocument();

      const subItem1 = screen.getByTestId('autocomplete-subitem-1');
      expect(subItem1).toHaveTextContent('backend-pod');

      fireEvent.click(subItem1);

      expect(input.value).toBe('kubectl logs backend-pod');
      expect(screen.queryByTestId('terminal-autocomplete-popup')).toBeNull();
    });

    it('handles Escape key to close autocomplete popup', () => {
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          isSimulating: true,
          nodes: [
            { id: 'pod-1', type: 'Pod', data: { label: 'web-pod' }, position: { x: 0, y: 0 } }
          ]
        });
      });

      render(<TerminalPanel />);

      const input = screen.getByTestId('terminal-cli-input') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'kubectl logs' } });
      expect(screen.getByTestId('terminal-autocomplete-popup')).toBeInTheDocument();

      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByTestId('terminal-autocomplete-popup')).toBeNull();
    });

    it('handles ArrowUp and ArrowDown navigation when dropdown has no sub-items', () => {
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          isSimulating: true
        });
      });

      render(<TerminalPanel />);

      const input = screen.getByTestId('terminal-cli-input') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'kubectl get' } });
      expect(screen.getByTestId('terminal-autocomplete-popup')).toBeInTheDocument();

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      fireEvent.keyDown(input, { key: 'Enter' });
      expect(input.value).toBe('kubectl get deployments');
    });
  });

  describe('Kubectl new interactive commands', () => {
    beforeEach(() => {
      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          isSimulating: true,
          nodes: [
            { id: 'pod-1', type: 'Pod', data: { label: 'web-pod', status: 'ready', image: 'nginx:latest' }, position: { x: 0, y: 0 } },
            { id: 'dep-1', type: 'Deployment', data: { label: 'api-dep', replicas: 2, image: 'nginx:latest' }, position: { x: 10, y: 10 } }
          ]
        });
      });
    });

    it('handles scale deployment command', () => {
      render(<TerminalPanel />);
      const input = screen.getByTestId('terminal-cli-input');
      fireEvent.change(input, { target: { value: 'kubectl scale deployment/api-dep --replicas=5' } });
      fireEvent.submit(input.closest('form')!);

      const state = useFlowStore.getState();
      const depNode = state.nodes.find(n => n.id === 'dep-1');
      expect(depNode?.data.replicas).toBe(5);
    });

    it('handles set image deployment command', () => {
      render(<TerminalPanel />);
      const input = screen.getByTestId('terminal-cli-input');
      fireEvent.change(input, { target: { value: 'kubectl set image deployment/api-dep api-container=nginx:alpine' } });
      fireEvent.submit(input.closest('form')!);

      const state = useFlowStore.getState();
      const depNode = state.nodes.find(n => n.id === 'dep-1');
      expect(depNode?.data.isRollingUpdate).toBe(true);
      expect(depNode?.data.rolloutTargetImage).toBe('nginx:alpine');
    });

    it('handles rollout status command', () => {
      render(<TerminalPanel />);
      const input = screen.getByTestId('terminal-cli-input');
      fireEvent.change(input, { target: { value: 'kubectl rollout status deployment/api-dep' } });
      fireEvent.submit(input.closest('form')!);

      const logs = useFlowStore.getState().activityLogs;
      expect(logs[logs.length - 1]).toContain('successfully rolled out');
    });

    it('handles rollout history command', () => {
      render(<TerminalPanel />);
      const input = screen.getByTestId('terminal-cli-input');
      fireEvent.change(input, { target: { value: 'kubectl rollout history deployment/api-dep' } });
      fireEvent.submit(input.closest('form')!);

      const logs = useFlowStore.getState().activityLogs;
      expect(logs.some(line => line.includes('REVISION  CHANGE-CAUSE'))).toBe(true);
    });

    it('handles rollout undo command', () => {
      // Setup some revisions first so rollback can be executed
      act(() => {
        useFlowStore.setState({
          nodes: [
            {
              id: 'dep-1',
              type: 'Deployment',
              data: {
                label: 'api-dep',
                replicas: 2,
                image: 'nginx:alpine',
                rolloutRevisions: ['nginx:latest', 'nginx:alpine']
              },
              position: { x: 10, y: 10 }
            }
          ]
        });
      });

      render(<TerminalPanel />);
      const input = screen.getByTestId('terminal-cli-input');
      fireEvent.change(input, { target: { value: 'kubectl rollout undo deployment/api-dep' } });
      fireEvent.submit(input.closest('form')!);

      const state = useFlowStore.getState();
      const depNode = state.nodes.find(n => n.id === 'dep-1');
      expect(depNode?.data.isRollingUpdate).toBe(true);
      expect(depNode?.data.rolloutTargetImage).toBe('nginx:latest');
    });

    it('handles delete pod command with self-healing', () => {
      // Put a pod with a parent deployment so self-healing is triggered
      act(() => {
        useFlowStore.setState({
          nodes: [
            { id: 'dep-1', type: 'Deployment', data: { label: 'api-dep', replicas: 1, image: 'nginx:latest' }, position: { x: 10, y: 10 } },
            { id: 'pod-1', type: 'Pod', parentId: 'dep-1', data: { label: 'web-pod', status: 'ready', image: 'nginx:latest' }, position: { x: 10, y: 10 } }
          ]
        });
      });

      render(<TerminalPanel />);
      const input = screen.getByTestId('terminal-cli-input');
      fireEvent.change(input, { target: { value: 'kubectl delete pod web-pod' } });
      fireEvent.submit(input.closest('form')!);

      const state = useFlowStore.getState();
      // Check that 'web-pod' has been deleted
      const webPodExists = state.nodes.some(n => n.id === 'pod-1');
      expect(webPodExists).toBe(false);

      // Verify that the deployment controller has recreated a pod (self-healing)
      const childPods = state.nodes.filter(n => n.parentId === 'dep-1' && n.type === 'Pod');
      expect(childPods).toHaveLength(1);
      expect(childPods[0].data.status).toBe('pending');
    });

    it('handles get all command', () => {
      render(<TerminalPanel />);
      const input = screen.getByTestId('terminal-cli-input');
      fireEvent.change(input, { target: { value: 'kubectl get all' } });
      fireEvent.submit(input.closest('form')!);

      const logs = useFlowStore.getState().activityLogs;
      expect(logs.some(line => line.includes('pod/web-pod'))).toBe(true);
      expect(logs.some(line => line.includes('deployment.apps/api-dep'))).toBe(true);
    });

    it('handles describe deployment command and missing deployment error', () => {
      render(<TerminalPanel />);
      const input = screen.getByTestId('terminal-cli-input');
      fireEvent.change(input, { target: { value: 'kubectl describe deployment api-dep' } });
      fireEvent.submit(input.closest('form')!);

      const logs = useFlowStore.getState().activityLogs;
      expect(logs.some(line => line.includes('Name:                   api-dep'))).toBe(true);
      expect(logs.some(line => line.includes('StrategyType:           RollingUpdate'))).toBe(true);

      fireEvent.change(input, { target: { value: 'kubectl describe deploy non-existent-dep' } });
      fireEvent.submit(input.closest('form')!);

      const updatedLogs = useFlowStore.getState().activityLogs;
      expect(updatedLogs.some(line => line.includes('Error from server (NotFound): deployment "non-existent-dep" not found'))).toBe(true);
    });

    it('handles kubectl get deploy, kubectl get svc, and admin help commands', () => {
      render(<TerminalPanel />);
      const input = screen.getByTestId('terminal-cli-input');

      fireEvent.change(input, { target: { value: 'kubectl get deploy' } });
      fireEvent.submit(input.closest('form')!);

      fireEvent.change(input, { target: { value: 'kubectl get svc' } });
      fireEvent.submit(input.closest('form')!);

      const logs = useFlowStore.getState().activityLogs;
      expect(logs.some(line => line.includes('api-dep'))).toBe(true);

      act(() => {
        useFlowStore.setState({ isAdminAuthenticated: true });
      });

      fireEvent.change(input, { target: { value: 'help' } });
      fireEvent.submit(input.closest('form')!);

      const adminLogs = useFlowStore.getState().activityLogs;
      expect(adminLogs.some(line => line.includes('Admin CLI Commands:'))).toBe(true);
    });

    it('minimizes terminal panel when X button is clicked and renders minimized trigger', () => {
      act(() => {
        useFlowStore.setState({ isTerminalOpen: true });
      });

      const { rerender } = render(<TerminalPanel />);

      const minimizeBtn = screen.getByTitle('Minimize Panel');
      fireEvent.click(minimizeBtn);

      expect(useFlowStore.getState().isTerminalOpen).toBe(false);

      rerender(<TerminalPanel />);
      expect(screen.queryByTestId('terminal-container')).toBeNull();
    });

    it('renders idle terminal empty state and starts simulation when Apply Manifests button is clicked', () => {
      const startSimulationSpy = vi.spyOn(useFlowStore.getState(), 'startSimulation');

      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          isSimulating: false,
          terminalActiveTab: 'activity',
          activityLogs: []
        });
      });

      render(<TerminalPanel />);

      expect(screen.getByText('Terminal Idle')).toBeInTheDocument();

      const applyBtn = screen.getByRole('button', { name: 'Apply Manifests' });
      fireEvent.click(applyBtn);

      expect(startSimulationSpy).toHaveBeenCalled();
    });
  });

  describe('unit tests for log export utilities', () => {
    it('generateLogFilename formats scenario and default project names correctly', () => {
      const scenarioFilename = generateLogFilename('Scenario: Basic Deployment', 'logs', 'web-pod');
      expect(scenarioFilename).toMatch(/^resource-logs-scenario-basic-deployment-web-pod_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/);

      const defaultFilename = generateLogFilename(null, 'activity');
      expect(defaultFilename).toMatch(/^activity-history_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/);
    });

    it('exportLogFile triggers download element correctly', () => {
      const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
        remove: vi.fn(),
      };
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any);

      exportLogFile(['line 1', 'line 2'], 'test_file.log');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockAnchor.download).toBe('test_file.log');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(mockAnchor.remove).toHaveBeenCalled();

      createObjectUrlSpy.mockRestore();
      revokeObjectUrlSpy.mockRestore();
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('renders export log button and triggers export when clicked', () => {
      const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      act(() => {
        useFlowStore.setState({
          isTerminalOpen: true,
          activityLogs: ['line 1', 'line 2'],
          currentProject: { id: 1, name: 'Scenario: Basic Deployment' }
        });
      });

      render(<TerminalPanel />);

      const exportBtn = screen.getByTestId('terminal-export-log-btn');
      expect(exportBtn).toBeInTheDocument();

      fireEvent.click(exportBtn);

      expect(createObjectUrlSpy).toHaveBeenCalled();

      createObjectUrlSpy.mockRestore();
      revokeObjectUrlSpy.mockRestore();
    });
  });
});
