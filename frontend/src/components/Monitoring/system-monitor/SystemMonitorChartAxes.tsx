import { cn } from '@/lib/utils';
import { XAxisTick, YAxisScaleTick } from './chartHelpers';

interface SystemMonitorAxisBottomProps {
  xTicks: XAxisTick[];
  isDark?: boolean;
}

export const SystemMonitorAxisBottom = ({ xTicks, isDark = true }: SystemMonitorAxisBottomProps) => (
  <div className={cn(
    "relative h-4 px-1 text-[9px] font-mono -mt-1 pb-1 border-b",
    isDark ? "border-slate-800/40 text-slate-500" : "border-slate-200 text-slate-600"
  )}>
    <div className="flex justify-between items-center w-full">
      {xTicks.map((t, idx) => {
        const isDense = xTicks.length > 13;
        const isAlternate = idx % 2 !== 0 && idx !== xTicks.length - 1;
        const hideClass = isDense && isAlternate ? 'hidden sm:inline opacity-60' : '';

        return (
          <span
            key={`x-axis-${t.minute}-${idx}`}
            className={cn('transition-opacity', hideClass)}
          >
            {t.label}
          </span>
        );
      })}
    </div>
  </div>
);

interface SystemMonitorYScaleOverlayProps {
  ticks: YAxisScaleTick[];
  isDark?: boolean;
}

export const SystemMonitorYScaleOverlay = ({ ticks, isDark = true }: SystemMonitorYScaleOverlayProps) => (
  <div className={cn(
    "absolute left-1.5 inset-y-1.5 flex flex-col justify-between pointer-events-none z-10 text-[8px] font-mono select-none",
    isDark ? "text-slate-400" : "text-slate-600"
  )}>
    {ticks.map((tick, idx) => (
      <span
        key={`y-tick-${tick.value}-${idx}`}
        className={cn(
          "px-1 py-0.5 rounded border shadow-sm",
          isDark ? "bg-[#111217]/85 border-slate-800/80 text-slate-400" : "bg-white/95 border-slate-300 text-slate-700"
        )}
      >
        {tick.label}
      </span>
    ))}
  </div>
);

interface SystemMonitorVerticalGridProps {
  xTicks: XAxisTick[];
  isDark?: boolean;
}

export const SystemMonitorVerticalGrid = ({ xTicks, isDark = true }: SystemMonitorVerticalGridProps) => (
  <div className={cn(
    "absolute inset-0 flex justify-between pointer-events-none",
    isDark ? "opacity-15" : "opacity-25"
  )}>
    {xTicks.map((t, idx) => (
      <div
        key={`vgrid-${t.minute}-${idx}`}
        className={cn("border-l h-full", isDark ? "border-slate-500" : "border-slate-300")}
        style={{ left: `${t.percent}%` }}
      />
    ))}
  </div>
);

