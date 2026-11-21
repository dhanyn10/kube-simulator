import { describe, it, expect, vi } from 'vitest';
import { handleSimulationControl } from '@/activities/monitoring/simulationControlHelpers';

describe('simulationControlHelpers', () => {
  it('handles simulation control actions: start, resume, pause, stop, speed', () => {
    const startSimulation = vi.fn();
    const pauseSimulation = vi.fn();
    const stopSimulation = vi.fn();
    const setSimulationSpeed = vi.fn();

    const mockState = {
      startSimulation,
      pauseSimulation,
      stopSimulation,
      setSimulationSpeed,
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
  });
});
