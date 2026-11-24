import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store';

const getTransitionClass = (speed: number): string => {
  if (speed === 10) {
    return 'transition-none';
  }
  if (speed === 5) {
    return 'transition-all duration-[30ms] ease-linear';
  }
  return 'transition-all duration-[150ms] ease-linear';
};

const getSeriesColors = (color: string, isAlert: boolean): { stroke: string; fill: string } => {
  if (isAlert) {
    return { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.15)' };
  }
  if (color === 'blue') {
    return { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.1)' };
  }
  return { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.1)' };
};

/**
 * Line chart for time-series metrics (with gradient fill and optional limit line).
 */
export const LineChart = ({
  data,
  color,
  label,
  valueFormatter,
  limitValue,
  isPercent = true,
  isAlert = false
}: {
  data: number[],
  color: string,
  label: string,
  valueFormatter?: (v: number) => string,
  limitValue?: number,
  isPercent?: boolean,
  isAlert?: boolean
}) => {
  const simulationSpeed = useFlowStore((state) => state.simulationSpeed) || 1;

  // Stream waveform from right to left like Windows Task Manager oscilloscope
  const count = data.length;
  const points = data.map((val, i) => {
    const x = count <= 1 ? 200 : Math.round(200 - (count - 1 - i) * (200 / 29));
    const rawPercent = isPercent ? val : (val / (limitValue || 100)) * 100;
    const clamped = Math.min(100, Math.max(0, rawPercent));
    const y = Math.round(100 - clamped);
    return `${x},${y}`;
  }).join(' ');

  const firstX = count <= 1 ? 200 : Math.max(0, Math.round(200 - (count - 1) * (200 / 29)));
  const areaPath = count > 0 ? `M${firstX},100 L${points} L200,100 Z` : 'M0,100 L200,100 Z';

  // Fast real-time transition synced with simulation speed (eliminates sluggish 1-second CSS lag)
  const transitionClass = getTransitionClass(simulationSpeed);
  const seriesColors = getSeriesColors(color, isAlert);

  return (
    <div className="flex flex-col gap-1 pointer-events-none select-none">
      <div className="flex justify-between items-center px-1 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {valueFormatter && data.length > 0 && (
            <span className="text-[8px] font-mono text-slate-400">
              {valueFormatter(data.at(-1) || 0)} / {valueFormatter(limitValue || 0)}
            </span>
          )}
          <span className={cn("text-[11px] font-mono font-bold", isAlert ? "text-red-500" : `text-${color}-500`)}>
            {data.length > 0 ? Math.round(data.at(-1) || 0) : 0}%
          </span>
        </div>
      </div>
      <div className="h-24 w-full bg-[#0b0e14] rounded border border-slate-800 relative overflow-hidden pointer-events-none shadow-inner">
        {/* Task Manager Oscilloscope Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between opacity-15 pointer-events-none">
          <div className="border-t border-slate-500 w-full" />
          <div className="border-t border-slate-500 w-full" />
          <div className="border-t border-slate-500 w-full" />
          <div className="border-t border-slate-500 w-full" />
        </div>
        <div className="absolute inset-0 flex justify-between opacity-10 pointer-events-none">
          <div className="border-l border-slate-500 h-full" />
          <div className="border-l border-slate-500 h-full" />
          <div className="border-l border-slate-500 h-full" />
          <div className="border-l border-slate-500 h-full" />
        </div>

        <svg
          aria-hidden="true"
          viewBox="0 0 200 100"
          className="w-full h-full preserve-3d pointer-events-none"
          preserveAspectRatio="none"
        >
          {/* Limit / Threshold Line */}
          <line
            x1="0" y1="0" x2="200" y2="0"
            stroke="#ef4444"
            strokeWidth="1"
            strokeDasharray="4 2"
            className="opacity-50"
          />
          {/* Real-time Polyline (red while the workload is overloaded) */}
          <polyline
            fill="none"
            stroke={seriesColors.stroke}
            strokeWidth="2"
            points={points}
            className={transitionClass}
          />
          {/* Area under line */}
          <path
            d={areaPath}
            fill={seriesColors.fill}
            className={transitionClass}
          />
        </svg>
      </div>
    </div>
  );
};
