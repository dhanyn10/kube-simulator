import { Play, Square, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';

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
  const logs = useFlowStore((state) => state.logs);
  const setLogModalOpen = useFlowStore((state) => state.setLogModalOpen);

  const errorCount = logs.filter((l) => l.level === 'error' || l.level === 'fatal').length;

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
        "flex items-center gap-1 rounded-lg border p-0.5 shadow-sm",
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

      {/* Bell Notification button directly next to Play button */}
      <button
        type="button"
        onClick={() => setLogModalOpen(true)}
        title={errorCount > 0 ? `${errorCount} application errors recorded` : "View Logs"}
        data-testid="bell-notification-btn"
        className={cn(
          "relative h-7 w-7 flex items-center justify-center rounded-md transition-colors",
          colorMode === 'dark'
            ? "hover:bg-slate-800 text-slate-400 hover:text-white"
            : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
        )}
      >
        <Bell size={14} />
        {errorCount > 0 && (
          <span
            data-testid="bell-error-badge"
            className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white shadow-sm animate-in zoom-in-50 duration-150"
          >
            {errorCount > 99 ? '99+' : errorCount}
          </span>
        )}
      </button>
    </div>
  );
};
