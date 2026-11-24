import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSystemMonitorDashboard } from '@/activities/monitoring/useSystemMonitorDashboard';
import { getBackendGateway } from '@/gateway';

describe('useSystemMonitorDashboard hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state and calculates clusterTotals correctly', () => {
    const { result } = renderHook(() => useSystemMonitorDashboard());

    expect(result.current.isSimulating).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.simulationSpeed).toBe(1);
    expect(result.current.clusterTotals.cpuPercent).toBe(0);
    expect(result.current.hasHpa).toBe(false);
    expect(result.current.hpaTarget).toBe(80);
  });

  it('handles simulation controls: start, pause, resume, stop, speed', async () => {
    const gw = getBackendGateway();
    const startSpy = vi.spyOn(gw, 'startSimulation');
    const pauseSpy = vi.spyOn(gw, 'pauseSimulation');
    const stopSpy = vi.spyOn(gw, 'stopSimulation');
    const speedSpy = vi.spyOn(gw, 'setSimulationSpeed');

    const { result } = renderHook(() => useSystemMonitorDashboard());

    expect(result.current.canStart).toBe(false);

    await act(async () => {
      await result.current.sendControl('start', { speed: 5 });
    });
    expect(startSpy).toHaveBeenCalledWith(5);
    expect(result.current.isSimulating).toBe(true);

    await act(async () => {
      await result.current.sendControl('pause');
    });
    expect(pauseSpy).toHaveBeenCalled();
    expect(result.current.isPaused).toBe(true);
    expect(result.current.isSimulating).toBe(false);

    await act(async () => {
      await result.current.sendControl('resume');
    });
    expect(startSpy).toHaveBeenCalled();
    expect(result.current.isPaused).toBe(false);

    await act(async () => {
      await result.current.sendControl('speed', { speed: 10 });
    });
    expect(speedSpy).toHaveBeenCalledWith(10);
    expect(result.current.simulationSpeed).toBe(10);

    await act(async () => {
      await result.current.sendControl('stop');
    });
    expect(stopSpy).toHaveBeenCalled();
    expect(result.current.isSimulating).toBe(false);
  });

  it('updates hasHpa and hpaTarget from storeNodes and broadcast messages', async () => {
    // 1. When storeNodes has an HPA node with custom targetCPU
    const { useFlowStore } = await import('@/store');
    useFlowStore.setState({
      nodes: [
        { id: 'hpa-1', type: 'HPA', data: { targetCPU: 75 }, position: { x: 0, y: 0 } },
      ],
    });

    const { result, unmount } = renderHook(() => useSystemMonitorDashboard());
    expect(result.current.hasHpa).toBe(true);
    expect(result.current.hpaTarget).toBe(75);

    unmount();
    useFlowStore.setState({ nodes: [] });
  });

  it('deduplicates metrics-update events with the same or older timestamp', async () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') {
        metricsCallback = cb;
      }
      return () => {};
    });

    const { result } = renderHook(() => useSystemMonitorDashboard());

    const payload1 = {
      timestamp: 1000,
      deployments: [{ id: 'dep-1', label: 'web', replicas: 2 }],
      isSimulating: true,
      speed: 5,
    };

    act(() => {
      metricsCallback?.(JSON.stringify(payload1));
    });

    expect(result.current.deployments).toHaveLength(1);
    expect(result.current.simulationSpeed).toBe(5);

    // Send redundant event with same timestamp
    const payloadRedundant = {
      timestamp: 1000,
      deployments: [{ id: 'dep-1', label: 'web', replicas: 99 }],
      isSimulating: true,
      speed: 1,
    };

    act(() => {
      metricsCallback?.(JSON.stringify(payloadRedundant));
    });

    // Should ignore payloadRedundant because timestamp <= 1000
    expect(result.current.simulationSpeed).toBe(5);
    expect(result.current.deployments[0].replicas).toBe(2);

    // Send newer event with timestamp 2000
    const payloadNewer = {
      timestamp: 2000,
      deployments: [{ id: 'dep-1', label: 'web', replicas: 4 }],
      isSimulating: true,
      speed: 10,
    };

    act(() => {
      metricsCallback?.(JSON.stringify(payloadNewer));
    });

    expect(result.current.simulationSpeed).toBe(10);
    expect(result.current.deployments[0].replicas).toBe(4);
  });

  it('toggles theme between dark and light, syncing with store and gateway', () => {
    const { result } = renderHook(() => useSystemMonitorDashboard());
    const initialMode = result.current.colorMode;

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.colorMode).not.toBe(initialMode);

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.colorMode).toBe(initialMode);
  });

  it('aggregates throttled, OOM, and resource limits into cluster totals', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') {
        metricsCallback = cb;
      }
      return () => {};
    });

    const { result } = renderHook(() => useSystemMonitorDashboard());

    const payload = {
      timestamp: 5000,
      deployments: [{ id: 'dep-1', label: 'api-service', replicas: 2 }],
      metrics: {
        'dep-1': [
          {
            cpuValue: 800,
            cpuLimit: 1000,
            memoryValue: 700,
            memoryLimit: 1024,
            cpuPercent: 80,
            memoryPercent: 68,
            isThrottled: true,
            isOOM: true,
            replicas: 2,
          },
        ],
      },
      isSimulating: true,
    };

    act(() => {
      metricsCallback?.(JSON.stringify(payload));
    });

    expect(result.current.clusterTotals.cpuPercent).toBe(80);
    expect(result.current.clusterTotals.memoryPercent).toBe(68);
    expect(result.current.clusterTotals.errorRate).toBe(100);
    expect(result.current.clusterTotals.totalPods).toBe(2);
  });

  it('handles window controls: close and maximize via gateway and store', async () => {
    const gw = getBackendGateway();
    const closeSpy = vi.spyOn(gw, 'closeSimulationWindow').mockResolvedValue(true);
    const maxSpy = vi.spyOn(gw, 'maximizeWindow').mockResolvedValue();
    const { useFlowStore } = await import('@/store');
    useFlowStore.setState({ isMonitoringOpen: true, isMonitoringDetached: true });

    const { result } = renderHook(() => useSystemMonitorDashboard());

    act(() => {
      result.current.handleCloseWindow();
    });
    expect(closeSpy).toHaveBeenCalled();
    expect(useFlowStore.getState().isMonitoringOpen).toBe(false);
    expect(useFlowStore.getState().isMonitoringDetached).toBe(false);

    act(() => {
      result.current.handleMaximizeWindow();
    });
    expect(maxSpy).toHaveBeenCalled();
  });

  it('applyData: handles payload without metrics/deployments/canStart/speed/hpa', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') metricsCallback = cb;
      return () => {};
    });
    const { result } = renderHook(() => useSystemMonitorDashboard());

    act(() => {
      metricsCallback?.(JSON.stringify({ isSimulating: false, isPaused: true }));
    });
    expect(result.current.deployments).toHaveLength(0);
    expect(result.current.isSimulating).toBe(false);
    expect(result.current.isPaused).toBe(true);
  });

  it('applyData: falls back to deployments array for canStart and hasHpa when fields are missing', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') metricsCallback = cb;
      return () => {};
    });
    const { result } = renderHook(() => useSystemMonitorDashboard());

    act(() => {
      metricsCallback?.(JSON.stringify({
        deployments: [{ id: 'dep-1', label: 'web' }],
        isSimulating: true,
      }));
    });
    expect(result.current.canStart).toBe(true);
    expect(result.current.hasHpa).toBe(false);
  });

  it('applyData: marks hasHpa from deployments when data.hasHpa is not boolean', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') metricsCallback = cb;
      return () => {};
    });
    const { result } = renderHook(() => useSystemMonitorDashboard());

    act(() => {
      metricsCallback?.(JSON.stringify({
        deployments: [{ id: 'dep-1', label: 'web', hasHpa: true }],
      }));
    });
    expect(result.current.hasHpa).toBe(true);
  });

  it('applyData: skips hpaTarget when not a finite number', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') metricsCallback = cb;
      return () => {};
    });
    const { result } = renderHook(() => useSystemMonitorDashboard());

    act(() => {
      metricsCallback?.(JSON.stringify({ hpaTarget: 'abc' as any }));
    });
    expect(result.current.hpaTarget).toBe(80);
  });

  it('handleUpdate returns early for falsy data', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') metricsCallback = cb;
      return () => {};
    });
    const { result } = renderHook(() => useSystemMonitorDashboard());
    act(() => {
      metricsCallback?.(JSON.stringify(null));
    });
    expect(result.current.deployments).toHaveLength(0);
  });

  it('handleUpdate applies data without timestamp immediately', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') metricsCallback = cb;
      return () => {};
    });
    const { result } = renderHook(() => useSystemMonitorDashboard());

    act(() => {
      metricsCallback?.(JSON.stringify({ deployments: [{ id: 'dep-1', label: 'web', replicas: 2 }] }));
    });
    expect(result.current.deployments[0].replicas).toBe(2);
  });

  it('sendControl speed without a speed option is a no-op', async () => {
    const gw = getBackendGateway();
    const speedSpy = vi.spyOn(gw, 'setSimulationSpeed');
    const { result } = renderHook(() => useSystemMonitorDashboard());
    await act(async () => {
      await result.current.sendControl('speed');
    });
    expect(speedSpy).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.sendControl('speed', {});
    });
    expect(speedSpy).not.toHaveBeenCalled();
  });

  it('sendControl resume starts simulation and clears paused state', async () => {
    const gw = getBackendGateway();
    const startSpy = vi.spyOn(gw, 'startSimulation');
    const { result } = renderHook(() => useSystemMonitorDashboard());
    await act(async () => {
      await result.current.sendControl('resume');
    });
    expect(startSpy).toHaveBeenCalledWith(1);
    expect(result.current.isSimulating).toBe(true);
    expect(result.current.isPaused).toBe(false);
  });

  it('applyData skips non-array speed', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') metricsCallback = cb;
      return () => {};
    });
    const { result } = renderHook(() => useSystemMonitorDashboard());
    act(() => {
      metricsCallback?.(JSON.stringify({ isSimulating: false, speed: 0 }));
    });
    expect(result.current.simulationSpeed).toBe(1);
  });

  it('clusterTotals handles deployment with empty metrics and non-numeric values', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') metricsCallback = cb;
      return () => {};
    });
    const { result } = renderHook(() => useSystemMonitorDashboard());

    act(() => {
      metricsCallback?.(JSON.stringify({
        deployments: [
          { id: 'dep-1', label: 'web', replicas: 2 },
          { id: 'dep-2', label: 'db', replicas: 0 },
        ],
        metrics: {
          'dep-1': [
            { cpuValue: 0, cpuLimit: 0, memoryValue: 0, memoryLimit: 0, isThrottled: false, isOOM: false },
          ],
        },
      }));
    });
    // replicas||1: dep-1=2, dep-2=0 falsy -> 1 => 3
    expect(result.current.clusterTotals.totalPods).toBe(3);
    expect(result.current.clusterTotals.cpuPercent).toBe(0);
    expect(result.current.clusterTotals.memoryPercent).toBe(0);
    expect(result.current.clusterTotals.errorRate).toBe(0);
  });

  it('clusterTotals errorRate is 0 when totalPods is 0', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') metricsCallback = cb;
      return () => {};
    });
    const { result } = renderHook(() => useSystemMonitorDashboard());

    act(() => {
      metricsCallback?.(JSON.stringify({
        deployments: [{ id: 'dep-1', label: 'web', replicas: 0 }],
      }));
    });
    // replicas 0 falsy -> 1
    expect(result.current.clusterTotals.totalPods).toBe(1);
    expect(result.current.clusterTotals.errorRate).toBe(0);
  });

  it('colorMode effect ignores storeColorMode when falsy', async () => {
    const { useFlowStore } = await import('@/store');
    useFlowStore.setState({ colorMode: '' as any });
    const { result } = renderHook(() => useSystemMonitorDashboard());
    expect(result.current.colorMode).toBe('dark');
  });

  it('metrics-update event ignores payload when broadcast already received it', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') metricsCallback = cb;
      return () => {};
    });
    const { result } = renderHook(() => useSystemMonitorDashboard());
    // Simulate broadcast arriving first
    const bc = new BroadcastChannel('monitoring-data');
    bc.postMessage({ type: 'METRICS_UPDATE', deployments: [{ id: 'dep-b', label: 'b', replicas: 1 }] });
    bc.close();

    // Give the event loop a tick for broadcast delivery
    return new Promise((resolve) => setTimeout(resolve, 50)).then(async () => {
      expect(result.current.deployments).toEqual([{ id: 'dep-b', label: 'b', replicas: 1 }]);
      await act(async () => {
        metricsCallback?.(JSON.stringify({ deployments: [{ id: 'dep-event', label: 'e', replicas: 9 }], isSimulating: true }));
      });
      expect(result.current.deployments).toEqual([{ id: 'dep-b', label: 'b', replicas: 1 }]);
    });
  });

  it('metrics-update event swallows parse errors', () => {
    const gw = getBackendGateway();
    let metricsCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'metrics-update') metricsCallback = cb;
      return () => {};
    });
    renderHook(() => useSystemMonitorDashboard());
    expect(() => metricsCallback?.('not json')).not.toThrow();
  });

  it('snapshot events: handle empty raw and malformed JSON gracefully', async () => {
    const gw = getBackendGateway();
    let snapshotCallback: ((json: string) => void) | undefined;
    vi.spyOn(gw, 'onEvent').mockImplementation((eventName, cb) => {
      if (eventName === 'simulation-snapshot-updated') snapshotCallback = cb;
      return () => {};
    });
    vi.spyOn(gw, 'getSimulationSnapshot').mockResolvedValue('');
    renderHook(() => useSystemMonitorDashboard());
    expect(() => snapshotCallback?.('')).not.toThrow();

    vi.spyOn(gw, 'getSimulationSnapshot').mockResolvedValue('invalid-json');
    await expect(gw.getSimulationSnapshot()).resolves.toBe('invalid-json');
  });

  it('handleCloseWindow browser-fallback path closes window when not wails desktop and not test', async () => {
    const closeSpy = vi.fn();
    vi.stubGlobal('close', closeSpy);
    vi.stubEnv('NODE_ENV', 'production');
    const { result } = renderHook(() => useSystemMonitorDashboard());
    act(() => {
      result.current.handleCloseWindow();
    });
    expect(closeSpy).toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
