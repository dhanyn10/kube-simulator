export const getSimulationButtonTitle = (
  hasInternet: boolean,
  hasHpaValidationError: boolean,
  isSimulating: boolean
): string => {
  if (!hasInternet) return 'Add an Internet card to start simulation';
  if (hasHpaValidationError) return 'HPA requires Resource Limits on target workloads';
  return isSimulating ? 'Stop Simulation' : 'Start Simulation';
};

export const getSimulationButtonClass = (
  hasInternet: boolean,
  isSimulating: boolean,
  hasHpaValidationError: boolean
): string => {
  if (!hasInternet) return 'text-slate-400 cursor-not-allowed bg-transparent';

  if (isSimulating) {
    return hasHpaValidationError
      ? 'bg-red-600 animate-pulse text-white'
      : 'bg-red-500 text-white hover:bg-red-600';
  }

  return hasHpaValidationError
    ? 'bg-amber-500/50 text-amber-900 border-amber-500/50'
    : 'bg-emerald-500 text-white hover:bg-emerald-600';
};

export const useSimulationControls = (props: {
  isSimulating: boolean;
  hasInternet: boolean;
  hasHpaValidationError: boolean;
}) => {
  const title = getSimulationButtonTitle(props.hasInternet, props.hasHpaValidationError, props.isSimulating);
  const buttonClass = getSimulationButtonClass(props.hasInternet, props.isSimulating, props.hasHpaValidationError);

  return { title, buttonClass };
};
