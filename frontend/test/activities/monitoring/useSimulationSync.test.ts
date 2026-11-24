import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSimulationSync } from '@/activities/monitoring/useSimulationSync';
import { useFlowStore } from '@/store';
import { getBackendGateway } from '@/gateway';
import { broadcastMetrics } from '@/store/slices/simulationManager';

vi.mock('@/store/slices/simulationManager', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, broadcastMetrics: vi.fn() };
});

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

describe('useSimulationSync snapshot HPA branch coverage', () => {
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
      colorMode: 'dark',
      nodes: [],
    });
  });

  const triggerSnapshot = () => {
    act(() => {
      broadcastListener?.({ type: 'REQUEST_SNAPSHOT' });
    });
    expect(broadcastMetrics).toHaveBeenCalled();
  };

  it('hpaTarget stays 80 when no HPA node or hpas on nodes', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'dep-1', type: 'Deployment', data: { label: 'Dep' } },
        { id: 'internet-1', type: 'Internet', data: {} },
      ],
    });
    renderHook(() => useSimulationSync());
    triggerSnapshot();
    expect(broadcastMetrics).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ hpaTarget: 80, hasHpa: false, hasInternet: true }));
  });

  it('hpaTarget uses HPA node targetCPU when present', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'hpa-1', type: 'HPA', data: { label: 'HPA', targetCPU: '65' } },
        { id: 'dep-1', type: 'Deployment', data: { label: 'Dep' } },
      ],
    });
    renderHook(() => useSimulationSync());
    triggerSnapshot();
    expect(broadcastMetrics).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ hpaTarget: 65 }));
  });

  it('hpaTarget falls back to 80 when HPA node targetCPU is invalid', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'hpa-1', type: 'HPA', data: { label: 'HPA', targetCPU: 'abc' } },
        { id: 'dep-1', type: 'Deployment', data: { label: 'Dep' } },
      ],
    });
    renderHook(() => useSimulationSync());
    triggerSnapshot();
    expect(broadcastMetrics).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ hpaTarget: 80 }));
  });

  it('hpaTarget uses hpas[0].targetCPU on attached workloads when no HPA node', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'dep-1', type: 'Deployment', data: { label: 'Dep', hpas: [{ id: 'hpa-1', targetCPU: '70' }] } },
      ],
    });
    renderHook(() => useSimulationSync());
    triggerSnapshot();
    expect(broadcastMetrics).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ hpaTarget: 70, hasHpa: true }));
  });

  it('hpaTarget stays 80 when attached workload hpas is empty or hpas[0] has no targetCPU', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'dep-1', type: 'Deployment', data: { label: 'Dep', hpas: [] } },
        { id: 'dep-2', type: 'StatefulSet', data: { label: 'Sts', hpas: [{ id: 'hpa-2' }] } },
      ],
    });
    renderHook(() => useSimulationSync());
    triggerSnapshot();
    expect(broadcastMetrics).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ hpaTarget: 80 }));
  });

  it('hpaTarget stays 80 when the attached workload hpas[0].targetCPU is invalid', () => {
    useFlowStore.setState({
      nodes: [
        { id: 'dep-1', type: 'Deployment', data: { label: 'Dep', hpas: [{ id: 'hpa-1', targetCPU: 'not-a-number' }] } },
      ],
    });
    renderHook(() => useSimulationSync());
    triggerSnapshot();
    expect(broadcastMetrics).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ hpaTarget: 80 }));
  });
});

describe('useSimulationSync theme sync branch coverage', () => {
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

    useFlowStore.setState({ colorMode: 'dark', nodes: [] });
  });

  it('applies THEME_SYNC colorMode when different and skips when equal', () => {
    renderHook(() => useSimulationSync());

    // Different mode -> applies
    act(() => {
      broadcastListener?.({ type: 'THEME_SYNC', colorMode: 'light' });
    });
    expect(useFlowStore.getState().colorMode).toBe('light');

    // Equal mode -> skipped (no-op)
    act(() => {
      broadcastListener?.({ type: 'THEME_SYNC', colorMode: 'light' });
    });
    expect(useFlowStore.getState().colorMode).toBe('light');

    // Non-matching types and missing colorMode are ignored
    act(() => {
      broadcastListener?.({ type: 'SOMETHING_ELSE', colorMode: 'dark' });
    });
    act(() => {
      broadcastListener?.({ type: 'THEME_SYNC' });
    });
    act(() => {
      broadcastListener?.({});
    });
    expect(useFlowStore.getState().colorMode).toBe('light');
  });
});
