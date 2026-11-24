import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalPanel } from '@/components/Terminal/TerminalPanel';
import { useFlowStore } from '@/store/useFlowStore';

describe('Terminal CLI & Canvas Store Integration Tests', () => {
  beforeEach(() => {
    useFlowStore.setState({
      nodes: [],
      edges: [],
      terminalLogs: [],
      isTerminalOpen: true,
      terminalActiveTab: 'activity',
    });
  });

  it('executes help, kubectl get pods, kubectl get svc, and handles unknown commands against store state', () => {
    const store = useFlowStore.getState();
    store.addNode('Pod', { x: 100, y: 100 });
    store.addNode('Service', { x: 300, y: 100 });

    render(<TerminalPanel />);

    const input = screen.getByTestId('terminal-cli-input');
    expect(input).toBeTruthy();

    // 1. Run 'help'
    fireEvent.change(input, { target: { value: 'help' } });
    fireEvent.submit(input.closest('form')!);
    expect(useFlowStore.getState().terminalLogs.length).toBeGreaterThan(0);

    // 2. Run 'kubectl get pods'
    fireEvent.change(input, { target: { value: 'kubectl get pods' } });
    fireEvent.submit(input.closest('form')!);
    const logsAfterPods = useFlowStore.getState().terminalLogs.map((l) => l.message).join('\n');
    expect(logsAfterPods).toMatch(/pod/i);

    // 3. Run 'kubectl get svc'
    fireEvent.change(input, { target: { value: 'kubectl get svc' } });
    fireEvent.submit(input.closest('form')!);
    const logsAfterSvc = useFlowStore.getState().terminalLogs.map((l) => l.message).join('\n');
    expect(logsAfterSvc).toMatch(/service|svc/i);

    // 4. Run unknown command
    fireEvent.change(input, { target: { value: 'unknown-cmd-xyz' } });
    fireEvent.submit(input.closest('form')!);
    const logsAfterUnknown = useFlowStore.getState().terminalLogs.map((l) => l.message).join('\n');
    expect(logsAfterUnknown).toMatch(/unknown|not found|help/i);
  });
});
