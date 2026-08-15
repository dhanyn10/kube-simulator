import { describe, it, expect, beforeEach } from 'vitest';
import { useFlowStore } from '../../src/store/useFlowStore';

describe('useFlowStore - Terminal Slice', () => {
  beforeEach(() => {
    const state = useFlowStore.getState();
    state.clearTerminalLogs();
    state.setTerminalOpen(false);
    state.setTerminalActiveTab('activity');
    state.setTerminalSelectedResourceId(null);
  });

  it('sets terminal visibility correctly', () => {
    expect(useFlowStore.getState().isTerminalOpen).toBe(false);

    useFlowStore.getState().setTerminalOpen(true);
    expect(useFlowStore.getState().isTerminalOpen).toBe(true);
  });

  it('updates terminal active tab correctly', () => {
    expect(useFlowStore.getState().terminalActiveTab).toBe('activity');

    useFlowStore.getState().setTerminalActiveTab('logs');
    expect(useFlowStore.getState().terminalActiveTab).toBe('logs');
  });

  it('updates terminal selected resource ID', () => {
    expect(useFlowStore.getState().terminalSelectedResourceId).toBeNull();

    useFlowStore.getState().setTerminalSelectedResourceId('node-1');
    expect(useFlowStore.getState().terminalSelectedResourceId).toBe('node-1');
  });

  it('adds activity logs and caps length', () => {
    expect(useFlowStore.getState().activityLogs).toEqual([]);

    useFlowStore.getState().addActivityLog('Running kubectl get pods');
    expect(useFlowStore.getState().activityLogs).toEqual(['Running kubectl get pods']);

    // Test capping
    for (let i = 0; i < 210; i++) {
      useFlowStore.getState().addActivityLog(`Log ${i}`);
    }
    expect(useFlowStore.getState().activityLogs).toHaveLength(200);
  });

  it('adds terminal workload logs', () => {
    expect(useFlowStore.getState().terminalLogs['pod-1']).toBeUndefined();

    useFlowStore.getState().addTerminalLog('pod-1', 'Server started');
    expect(useFlowStore.getState().terminalLogs['pod-1']).toEqual(['Server started']);

    useFlowStore.getState().addTerminalLog('pod-1', 'Traffic incoming');
    expect(useFlowStore.getState().terminalLogs['pod-1']).toEqual(['Server started', 'Traffic incoming']);
  });
});
