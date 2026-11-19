import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TimeRangeFilter } from './types';
import {
  XAxisTick,
  YAxisScaleTick,
  generateYAxisScale,
  generateXAxisTicks,
} from './chartHelpers';

export interface SystemMonitorAxisBottomProps {
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

export interface SystemMonitorYScaleOverlayProps {
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

export interface SystemMonitorVerticalGridProps {
  xTicks: XAxisTick[];
  isDark?: boolean;
}

export const SystemMonitorVerticalGrid = ({ xTicks, isDark = true }: SystemMonitorVerticalGridProps) => (
  <div className={cn(
    "absolute inset-0 pointer-events-none",
    isDark ? "opacity-15" : "opacity-25"
  )}>
    {xTicks.map((t, idx) => (
      <div
        key={`vgrid-${t.minute}-${idx}`}
        className={cn("absolute inset-y-0 border-l", isDark ? "border-slate-500" : "border-slate-300")}
        style={{ left: `${t.percent}%` }}
      />
    ))}
  </div>
);

export interface SystemMonitorHorizontalGridProps {
  isDark?: boolean;
}

export const SystemMonitorHorizontalGrid = ({ isDark = true }: SystemMonitorHorizontalGridProps) => (
  <div className={cn("absolute inset-0 flex flex-col justify-between p-2 pointer-events-none", isDark ? "opacity-20" : "opacity-30")}>
    <div className={cn("border-t w-full", isDark ? "border-slate-500" : "border-slate-300")} />
    <div className={cn("border-t w-full", isDark ? "border-slate-500" : "border-slate-300")} />
    <div className={cn("border-t w-full", isDark ? "border-slate-500" : "border-slate-300")} />
  </div>
);

export interface SystemMonitorChartCanvasProps {
  heightClass?: string;
  isDark?: boolean;
  xTicks: XAxisTick[];
  yScaleTicks: YAxisScaleTick[];
  isEmpty?: boolean;
  emptyText?: string;
  overlay?: React.ReactNode;
  children?: React.ReactNode;
  onMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const SystemMonitorChartCanvas = ({
  heightClass = 'h-28',
  isDark = true,
  xTicks,
  yScaleTicks,
  isEmpty = false,
  emptyText = 'No data available',
  overlay,
  children,
  onMouseMove,
  onMouseLeave,
}: SystemMonitorChartCanvasProps) => (
  <>
    <div
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={cn(
        heightClass,
        "w-full rounded border relative overflow-hidden flex items-center justify-center transition-colors cursor-crosshair",
        isDark ? "bg-[#111217] border-[#22252b]" : "bg-slate-50 border-slate-200"
      )}
    >
      <SystemMonitorHorizontalGrid isDark={isDark} />
      <SystemMonitorVerticalGrid xTicks={xTicks} isDark={isDark} />
      <SystemMonitorYScaleOverlay ticks={yScaleTicks} isDark={isDark} />
      {overlay}
      {isEmpty ? (
        <span className="text-xs font-mono text-slate-500">{emptyText}</span>
      ) : (
        children
      )}
    </div>
    <SystemMonitorAxisBottom xTicks={xTicks} isDark={isDark} />
  </>
);

export interface SystemMonitorPanelCardProps {
  isDark?: boolean;
  headerLeft: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const SystemMonitorPanelCard = ({
  isDark = true,
  headerLeft,
  headerRight,
  children,
  footer,
  className,
}: SystemMonitorPanelCardProps) => (
  <div
    className={cn(
      'p-4 rounded-lg border flex flex-col gap-3 transition-colors',
      isDark ? 'bg-[#181b1f] border-[#22252b] text-slate-200' : 'bg-white border-slate-200 text-slate-800',
      className
    )}
  >
    <div className={cn("flex items-center justify-between pb-2 border-b", isDark ? "border-slate-800/60" : "border-slate-200")}>
      {headerLeft}
      {headerRight}
    </div>
    {children}
    {footer}
  </div>
);

export const useChartScales = (
  dynamicMax: number,
  unit: string = '',
  interval?: TimeRangeFilter,
  tickCount: number = 3
) => {
  const yScale = useMemo(() => generateYAxisScale(dynamicMax, unit, tickCount), [dynamicMax, unit, tickCount]);
  const xTicks = useMemo(() => generateXAxisTicks(interval), [interval]);
  return { yScale, xTicks };
};
