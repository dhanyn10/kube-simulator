import { Play, Pause, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSimulationControls } from '@/activities/layout';

export { getSimulationButtonTitle, getSimulationButtonClass, getStopButtonClass } from '@/activities/layout';

interface SimulationControlsProps {
  readonly isSimulating: boolean;
  readonly startSimulation: () => void;
  readonly stopSimulation: () => void;
  readonly pauseSimulation?: () => void;
  readonly hasInternet: boolean;
  readonly hasHpaValidationError: boolean;
  readonly colorMode: 'dark' | 'light';
}

/**
 * Presentational UI component for simulation control buttons and speed acceleration toggles.
 */
export const SimulationControls = ({
  isSimulating,
  startSimulation,
  stopSimulation,
  pauseSimulation,
  hasInternet,
  hasHpaValidationError,
  colorMode
}: SimulationControlsProps) => {
  const {
    title,
    buttonClass,
    stopButtonClass,
    handlePause,
    simulationSpeed,
    setSimulationSpeed,
    showSpeedControls,
  } = useSimulationControls({
    isSimulating,
    hasInternet,
    hasHpaValidationError,
    pauseSimulation,
  });

  return (
    <div
      id="simulation-controls"
      className={cn(
        "flex items-center rounded-lg border p-0.5 shadow-sm gap-1",
        colorMode === 'dark' ? "bg-slate-900/50 border-slate-700/50" : "bg-white border-slate-200"
      )}
      style={{ '--wails-draggable': 'no-drag' }}
    >
      {isSimulating ? (
        <div data-testid="simulation-button-group" className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePause}
            disabled={!hasInternet}
            title={hasHpaValidationError ? 'HPA requires Resource Limits on target workloads' : 'Pause Simulation'}
            className={cn(
              "h-7 px-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md shadow-sm",
              buttonClass
            )}
          >
            <Pause size={10} fill="currentColor" />
            Pause
          </button>
          <button
            type="button"
            onClick={stopSimulation}
            disabled={!hasInternet}
            title="Stop Simulation"
            className={cn(
              "h-7 px-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md shadow-sm",
              stopButtonClass
            )}
          >
            <Square size={10} fill="currentColor" />
            Stop
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startSimulation}
          disabled={!hasInternet}
          title={title}
          className={cn(
            "h-7 px-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md shadow-sm",
            buttonClass
          )}
        >
          <Play size={10} fill="currentColor" />
          Play
        </button>
      )}

      {/* Speed acceleration button group */}
      {showSpeedControls && (
        <div
          data-testid="speed-controls-group"
          className={cn(
            "flex items-center p-0.5 rounded-md border text-xs font-mono font-black animate-in fade-in duration-200",
            colorMode === 'dark' ? "bg-slate-950/80 border-slate-800" : "bg-slate-100 border-slate-300"
          )}
        >
          <button
            type="button"
            onClick={() => setSimulationSpeed(1)}
            data-testid="speed-btn-1x"
            title="Normal Speed (1x)"
            className={cn(
              "px-2 py-1 rounded transition-colors flex items-center gap-0.5",
              simulationSpeed === 1
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <span>&gt;</span>
          </button>

          <button
            type="button"
            onClick={() => setSimulationSpeed(5)}
            data-testid="speed-btn-5x"
            title="Fast Speed (5x)"
            className={cn(
              "px-2 py-1 rounded transition-colors flex items-center gap-0.5",
              simulationSpeed === 5
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <span>&gt;&gt;</span>
          </button>

          <button
            type="button"
            onClick={() => setSimulationSpeed(10)}
            data-testid="speed-btn-10x"
            title="Ultra Speed (10x)"
            className={cn(
              "px-2 py-1 rounded transition-colors flex items-center gap-0.5",
              simulationSpeed === 10
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <span>&gt;&gt;&gt;</span>
          </button>
        </div>
      )}
    </div>
  );
};
