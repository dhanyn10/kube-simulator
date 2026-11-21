import { FlowState } from '@/store/types';

/**
 * Handles incoming simulation control commands from detached monitoring windows.
 */
export const handleSimulationControl = (
  data: { action: string; speed?: number },
  getState: () => FlowState
) => {
  const { action, speed } = data;
  const state = getState();

  if (action === 'start' || action === 'resume') {
    state.startSimulation();
  } else if (action === 'pause') {
    state.pauseSimulation();
  } else if (action === 'stop') {
    state.stopSimulation();
  } else if (action === 'speed' && speed) {
    state.setSimulationSpeed(speed as 1 | 5 | 10);
  }
};
