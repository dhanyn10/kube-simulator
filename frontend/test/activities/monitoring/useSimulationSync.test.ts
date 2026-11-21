import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSimulationSync } from '@/activities/monitoring/useSimulationSync';
import { useFlowStore } from '@/store';
import { getBackendGateway } from '@/gateway';

let broadcastListener: ((event: any) => void) | null = null;
class MockBroadcastChannel {
  onmessage: ((event: any) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
  constructor() {
    broadcastListener = (data: any) => {
      if (this.onmessage) this.onmessage({ data } as any);
    };
  }
}
global.BroadcastChannel = MockBroadcastChannel as any;

describe('useSimulationSync', () => {
  let wailsEvents: Record<string, (arg?: any) => void> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    broadcastListener = null;
    wailsEvents = {};

    const gw = getBackendGateway();
    vi.spyOn(gw, 'onEvent').mockImplementation((event: string, cb: any) => {
      wailsEvents[event] = cb;
      return () => {
        delete wailsEvents[event];
      };
    });

    useFlowStore.setState({
      isMonitoringDetached: false,
      isSimulating: true,
      isPaused: false,
      simulationSpeed: 1,
      nodes: [
        { id: 'dep-1', type: 'Deployment', data: { label: 'Dep 1', replicas: 2 } } as any,
      ],
      simulationMetrics: {
        'dep-1': [{ cpuPercent: 50, memoryPercent: 40, cpuValue: 100, memoryValue: 200 }],
      },
    });
  });

  it('skips event registration when in detached mode (?mode=monitoring)', () => {
    const origLocation = globalThis.location;
    delete (globalThis as any).location;
    (globalThis as any).location = { search: '?mode=monitoring' };

    renderHook(() => useSimulationSync());

    expect(broadcastListener).toBeNull();
    expect(Object.keys(wailsEvents)).toHaveLength(0);

    (globalThis as any).location = origLocation;
  });

  it('registers BroadcastChannel and Wails event listeners in canvas mode', () => {
    const { unmount } = renderHook(() => useSimulationSync());

    expect(broadcastListener).toBeDefined();
    expect(wailsEvents['detached-open']).toBeDefined();
    expect(wailsEvents['detached-closed']).toBeDefined();
    expect(wailsEvents['simulation-speed-change']).toBeDefined();
    expect(wailsEvents['request-monitoring-snapshot']).toBeDefined();

    // Trigger DETACHED_OPEN via BroadcastChannel
    act(() => {
      broadcastListener?.({ type: 'DETACHED_OPEN' });
    });
    expect(useFlowStore.getState().isMonitoringDetached).toBe(true);

    // Trigger DETACHED_CLOSED via BroadcastChannel
    act(() => {
      broadcastListener?.({ type: 'DETACHED_CLOSED' });
    });
    expect(useFlowStore.getState().isMonitoringDetached).toBe(false);

    // Trigger REQUEST_SNAPSHOT via BroadcastChannel
    act(() => {
      broadcastListener?.({ type: 'REQUEST_SNAPSHOT' });
    });

    // Trigger SIMULATION_CONTROL via BroadcastChannel
    act(() => {
      broadcastListener?.({ type: 'SIMULATION_CONTROL', action: 'speed', speed: 5 });
    });
    expect(useFlowStore.getState().simulationSpeed).toBe(5);

    // Trigger Wails events
    act(() => {
      wailsEvents['detached-open']?.();
    });
    expect(useFlowStore.getState().isMonitoringDetached).toBe(true);

    act(() => {
      wailsEvents['detached-closed']?.();
    });
    expect(useFlowStore.getState().isMonitoringDetached).toBe(false);

    act(() => {
      wailsEvents['simulation-speed-change']?.(10);
    });
    expect(useFlowStore.getState().simulationSpeed).toBe(10);

    act(() => {
      wailsEvents['request-monitoring-snapshot']?.();
    });

    unmount();
    expect(Object.keys(wailsEvents)).toHaveLength(0);
  });

  it('invokes onDetachOpen callback when detached window is opened', () => {
    const onDetachOpen = vi.fn();
    renderHook(() => useSimulationSync({ onDetachOpen }));

    act(() => {
      broadcastListener?.({ type: 'DETACHED_OPEN' });
    });
    expect(onDetachOpen).toHaveBeenCalledTimes(1);
    expect(useFlowStore.getState().isMonitoringDetached).toBe(true);

    act(() => {
      wailsEvents['detached-open']?.();
    });
    expect(onDetachOpen).toHaveBeenCalledTimes(2);
  });
});
