import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalPanel } from '../../../src/components/Layout/TerminalPanel';
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
    expect(screen.getByText('K8s Terminal')).toBeInTheDocument();
    expect(screen.queryByTestId('terminal-container')).toBeNull();
  });

  it('renders full terminal panel when isTerminalOpen is true', () => {
    useFlowStore.setState({ isTerminalOpen: true });
    render(<TerminalPanel />);
    expect(screen.getByTestId('terminal-container')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes Console')).toBeInTheDocument();
    expect(screen.getByText('Kubectl Activity')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes Logs')).toBeInTheDocument();
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

    const logsTab = screen.getByText('Kubernetes Logs');
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
    expect(screen.getByText((_, element) => element?.textContent === 'line one')).toBeInTheDocument();
    expect(screen.queryByText((_, element) => element?.textContent === 'line two')).toBeNull();
  });
});
