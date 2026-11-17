import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSystemMonitorDashboard } from '@/components/Monitoring/system-monitor/useSystemMonitorDashboard';
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
  });

  it('handles simulation controls: start, pause, resume, stop, speed, traffic_spike', async () => {
    const gw = getBackendGateway();
    const startSpy = vi.spyOn(gw, 'startSimulation');
    const pauseSpy = vi.spyOn(gw, 'pauseSimulation');
    const stopSpy = vi.spyOn(gw, 'stopSimulation');
    const speedSpy = vi.spyOn(gw, 'setSimulationSpeed');
    const spikeSpy = vi.spyOn(gw, 'triggerTrafficSpike');

    const { result } = renderHook(() => useSystemMonitorDashboard());

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
      await result.current.sendControl('traffic_spike', { multiplier: 3 });
    });
    expect(spikeSpy).toHaveBeenCalledWith(3);

    await act(async () => {
      await result.current.sendControl('stop');
    });
    expect(stopSpy).toHaveBeenCalled();
    expect(result.current.isSimulating).toBe(false);
  });
});
