import { useMemo } from 'react';
import { useFlowStore } from '@/store';

/**
 * Returns the tooltip title text for the simulation action button based on state.
 */
export const getSimulationButtonTitle = (
  hasInternet: boolean,
  hasHpaValidationError: boolean,
  isSimulating: boolean,
  isPaused: boolean = false,
  canStart: boolean = true
): string => {
  if (!hasInternet || !canStart) return 'Add an Internet card to start simulation';
  if (hasHpaValidationError) return 'HPA requires Resource Limits on target workloads';
  if (isSimulating) return 'Pause Simulation';
  if (isPaused) return 'Resume Simulation';
  return 'Start Simulation';
};

/**
 * Returns the CSS class names for the primary play/pause button.
 */
export const getSimulationButtonClass = (
  hasInternet: boolean,
  isSimulating: boolean,
  hasHpaValidationError: boolean,
  isPaused: boolean = false,
  canStart: boolean = true
): string => {
  if (!hasInternet || !canStart) {
    if (!isSimulating && !isPaused) {
      return 'text-slate-400 cursor-not-allowed bg-transparent';
    }
  }

  if (isSimulating) {
    return hasHpaValidationError
      ? 'bg-amber-600 animate-pulse text-white hover:bg-amber-700'
      : 'bg-amber-500 text-white hover:bg-amber-600';
  }

  if (isPaused) {
    return hasHpaValidationError
      ? 'bg-emerald-600 animate-pulse text-white hover:bg-emerald-700'
      : 'bg-emerald-500 text-white hover:bg-emerald-600';
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
  readonly isPaused?: boolean;
  readonly hasInternet: boolean;
  readonly hasHpaValidationError: boolean;
  readonly pauseSimulation?: () => void;
  readonly startSimulation?: () => void;
  readonly canStart?: boolean;
}

/**
 * Custom activity hook managing state, speed calculations, and button action handlers for simulation controls.
 */
export const useSimulationControls = (props: UseSimulationControlsProps) => {
  const {
    isSimulating,
    isPaused: isPausedProp,
    hasInternet,
    hasHpaValidationError,
    pauseSimulation: pauseSimulationProp,
    startSimulation: startSimulationProp,
    canStart: canStartProp,
  } = props;

  const nodes = useFlowStore((state) => state.nodes);
  const isPausedStore = useFlowStore((state) => state.isPaused);
  const simulationSpeed = useFlowStore((state) => state.simulationSpeed);
  const setSimulationSpeed = useFlowStore((state) => state.setSimulationSpeed);
  const storePauseSimulation = useFlowStore((state) => state.pauseSimulation);
  const storeStartSimulation = useFlowStore((state) => state.startSimulation);

  const isPaused = isPausedProp ?? isPausedStore;
  const canStart = canStartProp ?? (hasInternet ?? false);

  const title = getSimulationButtonTitle(hasInternet, hasHpaValidationError, isSimulating, isPaused, canStart);
  const buttonClass = getSimulationButtonClass(hasInternet, isSimulating, hasHpaValidationError, isPaused, canStart);
  const stopButtonClass = getStopButtonClass(hasHpaValidationError);

  const handlePause = pauseSimulationProp ?? storePauseSimulation;
  const handleStart = () => {
    if (!canStart && !isSimulating && !isPaused) return;
    (startSimulationProp ?? storeStartSimulation)();
  };

  const hasActiveProfile = useMemo(() => {
    return nodes.some((n: { type: string; data?: { connectionProfile?: unknown } }) => (
      n.type === 'Internet' && Boolean(n.data?.connectionProfile)
    ));
  }, [nodes]);

  const showSpeedControls = (isSimulating || isPaused) && hasActiveProfile;

  return {
    title,
    buttonClass,
    stopButtonClass,
    handlePause,
    handleStart,
    isPaused,
    simulationSpeed,
    setSimulationSpeed,
    showSpeedControls,
    canStart,
  };
};
