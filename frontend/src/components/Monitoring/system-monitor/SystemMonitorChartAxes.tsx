import { cn } from '@/lib/utils';
import { XAxisTick, YAxisScaleTick } from './chartHelpers';

interface SystemMonitorAxisBottomProps {
  xTicks: XAxisTick[];
}

export const SystemMonitorAxisBottom = ({ xTicks }: SystemMonitorAxisBottomProps) => (
  <div className="relative h-4 px-1 text-[9px] font-mono text-slate-500 -mt-1 pb-1 border-b border-slate-800/40">
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
}

export const SystemMonitorYScaleOverlay = ({ ticks }: SystemMonitorYScaleOverlayProps) => (
  <div className="absolute left-1.5 inset-y-1.5 flex flex-col justify-between pointer-events-none z-10 text-[8px] font-mono text-slate-400 select-none">
    {ticks.map((tick, idx) => (
      <span
        key={`y-tick-${tick.value}-${idx}`}
        className="bg-[#111217]/85 px-1 py-0.5 rounded border border-slate-800/80 shadow-sm"
      >
        {tick.label}
      </span>
    ))}
  </div>
);

interface SystemMonitorVerticalGridProps {
  xTicks: XAxisTick[];
}

export const SystemMonitorVerticalGrid = ({ xTicks }: SystemMonitorVerticalGridProps) => (
  <div className="absolute inset-0 flex justify-between pointer-events-none opacity-15">
    {xTicks.map((t, idx) => (
      <div
        key={`vgrid-${t.minute}-${idx}`}
        className="border-l border-slate-500 h-full"
        style={{ left: `${t.percent}%` }}
      />
    ))}
  </div>
);

