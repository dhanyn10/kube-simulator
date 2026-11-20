import { FlowState } from '@/store/types';

/**
 * Handles incoming simulation control commands from detached monitoring windows.
 */
export const handleSimulationControl = (
  data: { action: string; speed?: number; multiplier?: number },
  getState: () => FlowState
) => {
  const { action, speed, multiplier } = data;
  const state = getState();

  if (action === 'start' || action === 'resume') {
    state.startSimulation();
  } else if (action === 'pause') {
    state.pauseSimulation();
  } else if (action === 'stop') {
    state.stopSimulation();
  } else if (action === 'speed' && speed) {
    state.setSimulationSpeed(speed as 1 | 5 | 10);
  } else if (action === 'traffic_spike') {
    applyTrafficSpike(getState, multiplier || 2.0);
  }
};

/**
 * Injects a traffic surge across all active Internet gateway nodes.
 */
export const applyTrafficSpike = (
  getState: () => FlowState,
  multiplier: number = 2.0
) => {
  const state = getState();
  const safeMult = multiplier > 0 ? multiplier : 2.0;

  const updatedNodes = state.nodes.map(n => {
    if (n.type === 'Internet') {
      const baseTraffic = Number(n.data.currentTraffic || n.data.traffic || 1000);
      return {
        ...n,
        data: {
          ...n.data,
          currentTraffic: Math.round(baseTraffic * safeMult),
          traffic: Math.round(baseTraffic * safeMult),
        }
      };
    }
    return n;
  });

  state.setNodes?.(updatedNodes);

  state.addLog?.(
    'warning',
    `[Chaos/Spike] Injected ${safeMult}x traffic surge across internet gateways.`,
    'Simulation'
  );

  return updatedNodes;
};
