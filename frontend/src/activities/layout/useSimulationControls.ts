import { useMemo } from 'react';
import { useFlowStore } from '@/store';

/**
 * Returns the tooltip title text for the simulation action button based on state.
 */
export const getSimulationButtonTitle = (
  hasInternet: boolean,
  hasHpaValidationError: boolean,
  isSimulating: boolean
): string => {
  if (!hasInternet) return 'Add an Internet card to start simulation';
  if (hasHpaValidationError) return 'HPA requires Resource Limits on target workloads';
  return isSimulating ? 'Pause Simulation' : 'Start Simulation';
};

/**
 * Returns the CSS class names for the primary play/pause button.
 */
export const getSimulationButtonClass = (
  hasInternet: boolean,
  isSimulating: boolean,
  hasHpaValidationError: boolean
): string => {
  if (!hasInternet) return 'text-slate-400 cursor-not-allowed bg-transparent';

  if (isSimulating) {
    return hasHpaValidationError
      ? 'bg-amber-600 animate-pulse text-white hover:bg-amber-700'
      : 'bg-amber-500 text-white hover:bg-amber-600';
  }

  return hasHpaValidationError
    ? 'bg-amber-500/50 text-amber-900 border-amber-500/50'
    : 'bg-emerald-500 text-white hover:bg-emerald-600';
};

/**
 * Returns the CSS class names for the stop simulation button.
 */
export const getStopButtonClass = (hasHpaValidationError: boolean): string => {
  return hasHpaValidationError
    ? 'bg-red-600 animate-pulse text-white'
    : 'bg-red-500 text-white hover:bg-red-600';
};

export interface UseSimulationControlsProps {
  readonly isSimulating: boolean;
  readonly hasInternet: boolean;
  readonly hasHpaValidationError: boolean;
  readonly pauseSimulation?: () => void;
}

/**
 * Custom activity hook managing state, speed calculations, and button action handlers for simulation controls.
 */
export const useSimulationControls = (props: UseSimulationControlsProps) => {
  const { isSimulating, hasInternet, hasHpaValidationError, pauseSimulation: pauseSimulationProp } = props;

  const title = getSimulationButtonTitle(hasInternet, hasHpaValidationError, isSimulating);
  const buttonClass = getSimulationButtonClass(hasInternet, isSimulating, hasHpaValidationError);
  const stopButtonClass = getStopButtonClass(hasHpaValidationError);

  const nodes = useFlowStore((state) => state.nodes);
  const simulationSpeed = useFlowStore((state) => state.simulationSpeed);
  const setSimulationSpeed = useFlowStore((state) => state.setSimulationSpeed);
  const storePauseSimulation = useFlowStore((state) => state.pauseSimulation);

  const handlePause = pauseSimulationProp || storePauseSimulation;

  const hasActiveProfile = useMemo(() => {
    return nodes.some((n: { type: string; data?: { connectionProfile?: unknown } }) => (
      n.type === 'Internet' && Boolean(n.data?.connectionProfile)
    ));
  }, [nodes]);

  const showSpeedControls = isSimulating && hasActiveProfile;

  return {
    title,
    buttonClass,
    stopButtonClass,
    handlePause,
    simulationSpeed,
    setSimulationSpeed,
    showSpeedControls,
  };
};
