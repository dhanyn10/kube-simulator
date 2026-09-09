import { Play, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useSimulationControls,
  getSimulationButtonTitle,
  getSimulationButtonClass,
} from '../../activity/layout';

export { getSimulationButtonTitle, getSimulationButtonClass };

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
  const { title, buttonClass } = useSimulationControls({
    isSimulating,
    hasInternet,
    hasHpaValidationError,
  });

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
        title={title}
        className={cn(
          "h-7 px-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md shadow-sm",
          buttonClass
        )}
      >
        {isSimulating ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
        {isSimulating ? "Stop" : "Play"}
      </button>
    </div>
  );
};
