import React, { useMemo, useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { TimeRangeFilter } from './types';
import {
  XAxisTick,
  YAxisScaleTick,
  generateYAxisScale,
  generateXAxisTicks,
  getXAxisUnit,
  getIntervalCapacity,
  getScrubberTimeLabel,
} from './chartHelpers';
import { SystemMonitorScrubber, type ScrubberSeriesValue } from './SystemMonitorScrubber';
import { SystemMonitorCanvasRenderer, type CanvasSeriesItem } from './SystemMonitorCanvasRenderer';

export interface SystemMonitorAxisBottomProps {
  xTicks: XAxisTick[];
  isDark?: boolean;
  unit?: string;
}

const getTickAlignmentClass = (idx: number, total: number): string => {
  if (idx === 0) return 'translate-x-0 items-start';
  if (idx === total - 1) return '-translate-x-full items-end';
  return '-translate-x-1/2 items-center';
};

const resolveAxisScaleLabels = (xTicks: XAxisTick[], unit: string) => {
  if (xTicks.length < 2) {
    return { stepText: '1m / div', windowText: `0 ${unit}` };
  }
  const stepVal = Math.abs(xTicks[1].minute - xTicks[0].minute) || 1;
  const totalVal = Math.abs(xTicks.at(-1)?.minute ?? 0);
  const suffix = unit.toLowerCase() === 'hours' ? 'h' : 'm';
  return {
    stepText: `${stepVal}${suffix} / div`,
    windowText: `${totalVal} ${unit}`,
  };
};

export const SystemMonitorAxisBottom = memo(({
  xTicks,
  isDark = true,
  unit = 'Minutes',
}: SystemMonitorAxisBottomProps) => {
  const isDense = xTicks.length > 13;
  const { stepText, windowText } = resolveAxisScaleLabels(xTicks, unit);

  return (
    <div className={cn(
      "relative text-[9px] font-mono -mt-1 pb-1.5 border-b select-none",
      isDark ? "border-slate-800/40 text-slate-500" : "border-slate-200 text-slate-600"
    )}>
      {/* 1:1 Precision-Aligned Tick Ruler Row */}
      <div className="relative h-4 w-full">
        {xTicks.map((t, idx) => {
          const isAlternate = idx % 2 !== 0 && idx !== xTicks.length - 1;
          const hideClass = isDense && isAlternate ? 'hidden 2xl:inline-block opacity-55 text-[8px]' : '';
          const alignClass = getTickAlignmentClass(idx, xTicks.length);

          return (
            <div
              key={`x-axis-${t.minute}-${idx}`}
              style={{ left: `${t.percent}%` }}
              className={cn('absolute top-0 flex flex-col leading-none', alignClass)}
            >
              <span
                className={cn(
                  'w-px h-1 mb-0.5',
                  isDark ? 'bg-slate-700/80' : 'bg-slate-300',
                  isDense && isAlternate && 'h-0.5 opacity-50'
                )}
              />
              <span className={cn('transition-opacity whitespace-nowrap', hideClass)}>
                {t.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Google Maps Style Scale Bar & Unit Legend Row */}
      <div className="flex items-center justify-between w-full mt-1 px-0.5 text-[8px] font-mono">
        <div className="flex items-center gap-1.5">
          {/* Visual Google Maps Scale Bracket |---| */}
          <span
            aria-hidden="true"
            className={cn(
              'inline-block w-4 h-1.5 border-x border-b',
              isDark ? 'border-blue-400/70' : 'border-blue-600/70'
            )}
          />
          <span className={cn('tracking-wide', isDark ? 'text-slate-400' : 'text-slate-600')}>
            Scale: <strong className={isDark ? 'text-blue-400' : 'text-blue-600'}>{stepText}</strong>
          </span>
        </div>

        <span className={cn(
          "tracking-widest uppercase font-semibold",
          isDark ? "text-slate-400" : "text-slate-500"
        )}>
          {unit}
        </span>

        <span className={cn('tracking-wide', isDark ? 'text-slate-400' : 'text-slate-600')}>
          Window: <strong className={isDark ? 'text-slate-300' : 'text-slate-700'}>{windowText}</strong>
        </span>
      </div>
    </div>
  );
});

SystemMonitorAxisBottom.displayName = 'SystemMonitorAxisBottom';

export interface SystemMonitorYScaleOverlayProps {
  ticks: YAxisScaleTick[];
  isDark?: boolean;
}

export const SystemMonitorYScaleOverlay = memo(({ ticks, isDark = true }: SystemMonitorYScaleOverlayProps) => (
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
));

SystemMonitorYScaleOverlay.displayName = 'SystemMonitorYScaleOverlay';

export interface SystemMonitorVerticalGridProps {
  xTicks: XAxisTick[];
  isDark?: boolean;
}

export const SystemMonitorVerticalGrid = memo(({ xTicks, isDark = true }: SystemMonitorVerticalGridProps) => {
  const isDense = xTicks.length > 13;
  return (
    <div className={cn(
      "absolute inset-0 pointer-events-none",
      isDark ? "opacity-15" : "opacity-25"
    )}>
      {xTicks.map((t, idx) => {
        const isMinor = isDense && idx % 2 !== 0 && idx !== xTicks.length - 1;
        return (
          <div
            key={`vgrid-${t.minute}-${idx}`}
            className={cn(
              "absolute inset-y-0 border-l",
              isDark ? "border-slate-500" : "border-slate-300",
              isMinor && "border-dashed opacity-50"
            )}
            style={{ left: `${t.percent}%` }}
          />
        );
      })}
    </div>
  );
});

SystemMonitorVerticalGrid.displayName = 'SystemMonitorVerticalGrid';

export interface SystemMonitorHorizontalGridProps {
  isDark?: boolean;
}

export const SystemMonitorHorizontalGrid = memo(({ isDark = true }: SystemMonitorHorizontalGridProps) => (
  <div className={cn("absolute inset-0 flex flex-col justify-between p-2 pointer-events-none", isDark ? "opacity-20" : "opacity-30")}>
    <div className={cn("border-t w-full", isDark ? "border-slate-500" : "border-slate-300")} />
    <div className={cn("border-t w-full", isDark ? "border-slate-500" : "border-slate-300")} />
    <div className={cn("border-t w-full", isDark ? "border-slate-500" : "border-slate-300")} />
  </div>
));

SystemMonitorHorizontalGrid.displayName = 'SystemMonitorHorizontalGrid';

export interface SystemMonitorChartCanvasProps {
  heightClass?: string;
  isDark?: boolean;
  xTicks: XAxisTick[];
  yScaleTicks: YAxisScaleTick[];
  xAxisUnit?: string;
  isEmpty?: boolean;
  emptyText?: string;
  overlay?: React.ReactNode;
  children?: React.ReactNode;
  onMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const SystemMonitorChartCanvas = memo(({
  heightClass = 'h-28',
  isDark = true,
  xTicks,
  yScaleTicks,
  xAxisUnit,
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
    <SystemMonitorAxisBottom xTicks={xTicks} isDark={isDark} unit={xAxisUnit} />
  </>
));

SystemMonitorChartCanvas.displayName = 'SystemMonitorChartCanvas';

export interface SystemMonitorPanelCardProps {
  isDark?: boolean;
  headerLeft: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const SystemMonitorPanelCard = memo(({
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
));

SystemMonitorPanelCard.displayName = 'SystemMonitorPanelCard';

export const useChartScales = (
  dynamicMax: number,
  unit: string = '',
  interval?: TimeRangeFilter,
  tickCount: number = 3
) => {
  const yScale = useMemo(() => generateYAxisScale(dynamicMax, unit, tickCount), [dynamicMax, unit, tickCount]);
  const xTicks = useMemo(() => generateXAxisTicks(interval), [interval]);
  const xAxisUnit = useMemo(() => getXAxisUnit(interval), [interval]);
  return { yScale, xTicks, xAxisUnit };
};

export interface ChartHoverState {
  percent: number;
  timeLabel: string;
}

export const useInteractiveChartModel = (
  dynamicMax: number,
  unit: string = '',
  interval?: TimeRangeFilter,
  tickCount: number = 3
) => {
  const { yScale, xTicks, xAxisUnit } = useChartScales(dynamicMax, unit, interval, tickCount);
  const capacity = getIntervalCapacity(interval);
  const [hoverState, setHoverState] = useState<ChartHoverState | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percent = Math.round((x / rect.width) * 1000) / 10;
    const timeLabel = getScrubberTimeLabel(percent, interval);
    setHoverState({ percent, timeLabel });
  }, [interval]);

  const handleMouseLeave = useCallback(() => {
    setHoverState(null);
  }, []);

  return {
    yScale,
    xTicks,
    xAxisUnit,
    capacity,
    hoverState,
    handleMouseMove,
    handleMouseLeave,
  };
};

export interface SystemMonitorInteractiveChartProps {
  heightClass?: string;
  isDark?: boolean;
  interval?: TimeRangeFilter;
  maxVal: number;
  yUnit?: string;
  series: CanvasSeriesItem[];
  buildScrubberValues: (hoverPercent: number, capacity: number) => ScrubberSeriesValue[];
  isEmpty?: boolean;
  emptyText?: string;
  extraOverlay?: React.ReactNode;
}

export const SystemMonitorInteractiveChart = memo(({
  heightClass,
  isDark = true,
  interval,
  maxVal,
  yUnit = '',
  series,
  buildScrubberValues,
  isEmpty = false,
  emptyText,
  extraOverlay,
}: SystemMonitorInteractiveChartProps) => {
  const {
    yScale,
    xTicks,
    xAxisUnit,
    capacity,
    hoverState,
    handleMouseMove,
    handleMouseLeave,
  } = useInteractiveChartModel(maxVal, yUnit, interval);

  const scrubberValues = useMemo(() => {
    if (!hoverState) return [];
    return buildScrubberValues(hoverState.percent, capacity);
  }, [hoverState, buildScrubberValues, capacity]);

  return (
    <SystemMonitorChartCanvas
      heightClass={heightClass}
      isDark={isDark}
      xTicks={xTicks}
      xAxisUnit={xAxisUnit}
      yScaleTicks={yScale.ticks}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      overlay={
        <>
          {extraOverlay}
          {hoverState && (
            <SystemMonitorScrubber
              hoverPercent={hoverState.percent}
              timeLabel={hoverState.timeLabel}
              values={scrubberValues}
              isDark={isDark}
            />
          )}
        </>
      }
      isEmpty={isEmpty}
      emptyText={emptyText}
    >
      <SystemMonitorCanvasRenderer
        series={series}
        maxVal={maxVal}
        capacity={capacity}
      />
    </SystemMonitorChartCanvas>
  );
});

SystemMonitorInteractiveChart.displayName = 'SystemMonitorInteractiveChart';
