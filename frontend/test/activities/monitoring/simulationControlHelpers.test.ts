import { describe, it, expect, vi } from 'vitest';
import { handleSimulationControl, applyTrafficSpike } from '@/activities/monitoring/simulationControlHelpers';

describe('simulationControlHelpers', () => {
  it('handles simulation control actions: start, resume, pause, stop, speed, traffic_spike', () => {
    const startSimulation = vi.fn();
    const pauseSimulation = vi.fn();
    const stopSimulation = vi.fn();
    const setSimulationSpeed = vi.fn();
    const addLog = vi.fn();

    const mockState = {
      nodes: [
        { id: 'inet-1', type: 'Internet', data: { traffic: 1000, currentTraffic: 1000 } },
        { id: 'pod-1', type: 'Pod', data: {} }
      ],
      startSimulation,
      pauseSimulation,
      stopSimulation,
      setSimulationSpeed,
      addLog,
    } as any;

    const getState = () => mockState;

    handleSimulationControl({ action: 'start' }, getState);
    expect(startSimulation).toHaveBeenCalledTimes(1);

    handleSimulationControl({ action: 'resume' }, getState);
    expect(startSimulation).toHaveBeenCalledTimes(2);

    handleSimulationControl({ action: 'pause' }, getState);
    expect(pauseSimulation).toHaveBeenCalledTimes(1);

    handleSimulationControl({ action: 'stop' }, getState);
    expect(stopSimulation).toHaveBeenCalledTimes(1);

    handleSimulationControl({ action: 'speed', speed: 10 }, getState);
    expect(setSimulationSpeed).toHaveBeenCalledWith(10);

    handleSimulationControl({ action: 'traffic_spike', multiplier: 3 }, getState);
    expect(addLog).toHaveBeenCalledWith('warning', expect.stringContaining('3x'), 'Simulation');
  });

  it('applies traffic spike and defaults multiplier when <= 0', () => {
    const addLog = vi.fn();
    const mockState = {
      nodes: [
        { id: 'inet-1', type: 'Internet', data: { traffic: 500 } },
        { id: 'node-2', type: 'Service', data: {} }
      ],
      addLog,
    } as any;

    const updated = applyTrafficSpike(() => mockState, -1);
    expect(updated[0].data.currentTraffic).toBe(1000); // 500 * default 2
    expect(addLog).toHaveBeenCalled();
  });
});
