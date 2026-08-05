import { Play, Square } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SimulationControlsProps {
  isSimulating: boolean;
  startSimulation: () => void;
  stopSimulation: () => void;
  hasInternet: boolean;
  hasHpaValidationError: boolean;
  colorMode: 'dark' | 'light';
}

export const SimulationControls = ({
  isSimulating,
  startSimulation,
  stopSimulation,
  hasInternet,
  hasHpaValidationError,
  colorMode
}: SimulationControlsProps) => {
  const getButtonTitle = () => {
    if (!hasInternet) return "Add an Internet card to start simulation";
    if (hasHpaValidationError) return "HPA requires Resource Limits on target workloads";
    return isSimulating ? "Stop Simulation" : "Start Simulation";
  };

  const getButtonClass = () => {
    if (!hasInternet) return "text-slate-400 cursor-not-allowed bg-transparent";

    if (isSimulating) {
      return hasHpaValidationError
        ? "bg-red-600 animate-pulse text-white"
        : "bg-red-500 text-white hover:bg-red-600";
    }

    return hasHpaValidationError
      ? "bg-amber-500/50 text-amber-900 border-amber-500/50"
      : "bg-emerald-500 text-white hover:bg-emerald-600";
  };

  return (
    <div
      id="simulation-controls"
      className={cn(
        "flex items-center rounded-lg border p-0.5 shadow-sm",
        colorMode === 'dark' ? "bg-slate-900/50 border-slate-700/50" : "bg-white border-slate-200"
      )}
      style={{ '--wails-draggable': 'no-drag' }}
    >
      <button
        type="button"
        onClick={() => isSimulating ? stopSimulation() : startSimulation()}
        disabled={!hasInternet}
        title={getButtonTitle()}
        className={cn(
          "h-7 px-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md shadow-sm",
          getButtonClass()
        )}
      >
        {isSimulating ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
        {isSimulating ? "Stop" : "Play"}
      </button>
    </div>
  );
};
