import { Play, Pause, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSimulationControls } from '@/activities/layout';

export { getSimulationButtonTitle, getSimulationButtonClass, getStopButtonClass } from '@/activities/layout';

interface SimulationControlsProps {
  readonly isSimulating: boolean;
  readonly isPaused?: boolean;
  readonly startSimulation: () => void;
  readonly stopSimulation: () => void;
  readonly pauseSimulation?: () => void;
  readonly hasInternet: boolean;
  readonly hasHpaValidationError: boolean;
  readonly colorMode: 'dark' | 'light';
  readonly canStart?: boolean;
}

interface SimulationPlaybackButtonGroupProps {
  readonly isSimulating: boolean;
  readonly handlePause: () => void;
  readonly handleStart: () => void;
  readonly stopSimulation: () => void;
  readonly hasInternet: boolean;
  readonly canStart: boolean;
  readonly hasHpaValidationError: boolean;
  readonly title: string;
  readonly buttonClass: string;
  readonly stopButtonClass: string;
  readonly colorMode: 'dark' | 'light';
}

const SimulationPlaybackButtonGroup = ({
  isSimulating,
  handlePause,
  handleStart,
  stopSimulation,
  hasInternet,
  canStart,
  hasHpaValidationError,
  title,
  buttonClass,
  stopButtonClass,
  colorMode,
}: SimulationPlaybackButtonGroupProps) => {
  const isDark = colorMode === 'dark';
  const pauseTitle = hasHpaValidationError
    ? 'HPA requires Resource Limits on target workloads'
    : 'Pause Simulation';
  const resumeTitle = canStart ? 'Resume Simulation' : title;

  return (
    <div
      data-testid="simulation-button-group"
      className={cn(
        'inline-flex rounded-md shadow-sm overflow-hidden divide-x',
        isDark ? 'divide-slate-800' : 'divide-slate-200'
      )}
    >
      {isSimulating ? (
        <button
          type="button"
          onClick={handlePause}
          disabled={!hasInternet}
          title={pauseTitle}
          className={cn(
            'h-7 px-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-l-md rounded-r-none shadow-sm',
            buttonClass
          )}
        >
          <Pause size={10} fill="currentColor" />
          Pause
        </button>
      ) : (
        <button
          type="button"
          onClick={() => handleStart()}
          disabled={!canStart}
          title={resumeTitle}
          className={cn(
            'h-7 px-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-l-md rounded-r-none shadow-sm',
            buttonClass
          )}
        >
          <Play size={10} fill="currentColor" />
          Resume
        </button>
      )}
      <button
        type="button"
        onClick={stopSimulation}
        disabled={!hasInternet}
        title="Stop Simulation"
        className={cn(
          'h-7 px-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-r-md rounded-l-none shadow-sm',
          stopButtonClass
        )}
      >
        <Square size={10} fill="currentColor" />
        Stop
      </button>
    </div>
  );
};

interface SimulationSpeedControlsProps {
  readonly simulationSpeed: number;
  readonly setSimulationSpeed: (speed: number) => void;
  readonly colorMode: 'dark' | 'light';
}

const SPEED_OPTIONS = [
  { speed: 1, label: '>', title: 'Normal Speed (1x)', testId: 'speed-btn-1x' },
  { speed: 5, label: '>>', title: 'Fast Speed (5x)', testId: 'speed-btn-5x' },
  { speed: 10, label: '>>>', title: 'Ultra Speed (10x)', testId: 'speed-btn-10x' },
] as const;

const getSpeedButtonClass = (isActive: boolean, isDark: boolean): string => {
  if (isActive) {
    return 'bg-blue-600 text-white shadow-sm';
  }
  return isDark
    ? 'text-slate-400 hover:text-slate-200'
    : 'text-slate-600 hover:text-slate-900';
};

const SimulationSpeedControls = ({
  simulationSpeed,
  setSimulationSpeed,
  colorMode,
}: SimulationSpeedControlsProps) => {
  const isDark = colorMode === 'dark';

  return (
    <div
      data-testid="speed-controls-group"
      className={cn(
        'flex items-center p-0.5 rounded-md border text-xs font-mono font-black animate-in fade-in duration-200',
        isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100 border-slate-300'
      )}
    >
      {SPEED_OPTIONS.map((opt) => (
        <button
          key={`speed-${opt.speed}`}
          type="button"
          onClick={() => setSimulationSpeed(opt.speed)}
          data-testid={opt.testId}
          title={opt.title}
          className={cn(
            'px-2 py-1 rounded transition-colors flex items-center gap-0.5',
            getSpeedButtonClass(simulationSpeed === opt.speed, isDark)
          )}
        >
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
};

/**
 * Presentational UI component for simulation control buttons and speed acceleration toggles.
 */
export const SimulationControls = ({
  isSimulating,
  isPaused: isPausedProp,
  startSimulation,
  stopSimulation,
  pauseSimulation,
  hasInternet,
  hasHpaValidationError,
  colorMode,
  canStart: canStartProp,
}: SimulationControlsProps) => {
  const {
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
  } = useSimulationControls({
    isSimulating,
    isPaused: isPausedProp,
    hasInternet,
    hasHpaValidationError,
    pauseSimulation,
    startSimulation,
    canStart: canStartProp,
  });

  const isGroupActive = isSimulating || isPaused;
  const isDark = colorMode === 'dark';

  return (
    <div
      id="simulation-controls"
      className={cn(
        'wails-no-drag flex items-center rounded-lg border p-0.5 shadow-sm gap-1',
        isDark ? 'bg-slate-900/50 border-slate-700/50' : 'bg-white border-slate-200'
      )}
    >
      {isGroupActive ? (
        <SimulationPlaybackButtonGroup
          isSimulating={isSimulating}
          handlePause={handlePause}
          handleStart={handleStart}
          stopSimulation={stopSimulation}
          hasInternet={hasInternet}
          canStart={canStart}
          hasHpaValidationError={hasHpaValidationError}
          title={title}
          buttonClass={buttonClass}
          stopButtonClass={stopButtonClass}
          colorMode={colorMode}
        />
      ) : (
        <button
          type="button"
          onClick={() => handleStart()}
          disabled={!canStart}
          title={title}
          className={cn(
            'h-7 px-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md shadow-sm',
            buttonClass
          )}
        >
          <Play size={10} fill="currentColor" />
          Play
        </button>
      )}

      {showSpeedControls && (
        <SimulationSpeedControls
          simulationSpeed={simulationSpeed}
          setSimulationSpeed={setSimulationSpeed}
          colorMode={colorMode}
        />
      )}
    </div>
  );
};
