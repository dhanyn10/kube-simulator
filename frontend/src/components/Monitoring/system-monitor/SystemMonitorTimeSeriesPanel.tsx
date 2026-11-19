import { useMemo, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { BaseSystemMonitorPanelProps } from './types';
import {
  CHART_PALETTE,
  calculateSeriesStats,
  aggregateMetricSeries,
  calculateDynamicYMax,
  getThresholdReferenceLines,
  resolveMemoryLimit,
  resolveScrubberPointValue,
  ThresholdReferenceLine,
} from './chartHelpers';
import {
  SystemMonitorPanelCard,
  SystemMonitorInteractiveChart,
} from './SystemMonitorChartAxes';
import { type CanvasSeriesItem } from './SystemMonitorCanvasRenderer';
import { ZapOff, AlertTriangle } from 'lucide-react';

export interface SystemMonitorTimeSeriesPanelProps extends BaseSystemMonitorPanelProps {
  title: string;
  description?: string;
  metricKey: 'cpuPercent' | 'memoryPercent' | 'cpuValue' | 'memoryValue';
  unit?: string;
  maxVal?: number;
  showThresholds?: boolean;
  hasHpa?: boolean;
  hpaTarget?: number;
}

const getThresholdBorderColor = (color: ThresholdReferenceLine['color'], isDark: boolean = true): string => {
  if (color === 'amber') return isDark ? 'border-amber-500/60' : 'border-amber-500';
  if (color === 'rose') return isDark ? 'border-rose-500/60' : 'border-rose-500';
  return isDark ? 'border-red-500/70' : 'border-red-500';
};

const getThresholdBadgeColor = (color: ThresholdReferenceLine['color'], isDark: boolean = true): string => {
  if (color === 'amber') {
    return isDark
      ? 'bg-amber-950/85 text-amber-300 border-amber-600/50'
      : 'bg-amber-50/95 text-amber-800 border-amber-300';
  }
  if (color === 'rose') {
    return isDark
      ? 'bg-rose-950/85 text-rose-300 border-rose-600/50'
      : 'bg-rose-50/95 text-rose-800 border-rose-300';
  }
  return isDark
    ? 'bg-red-950/85 text-red-300 border-red-600/50'
    : 'bg-red-50/95 text-red-800 border-red-300';
};

const getThresholdLegendTextColor = (color: ThresholdReferenceLine['color'], isDark: boolean = true): string => {
  if (color === 'amber') return isDark ? 'text-amber-400' : 'text-amber-700';
  if (color === 'rose') return isDark ? 'text-rose-400' : 'text-rose-700';
  return isDark ? 'text-red-400' : 'text-red-700';
};

const getThresholdLegendDotColor = (color: ThresholdReferenceLine['color']): string => {
  if (color === 'amber') return 'bg-amber-400';
  if (color === 'rose') return 'bg-rose-400';
  return 'bg-red-400';
};

interface DynamicThresholdLinesProps {
  lines: ThresholdReferenceLine[];
  isDark?: boolean;
}

export const DynamicThresholdLines = ({ lines, isDark = true }: DynamicThresholdLinesProps) => {
  if (lines.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 overflow-hidden">
      {lines.map((line) => (
        <div
          key={`threshold-line-${line.label}-${line.value}`}
          className="absolute inset-x-0"
          style={{ top: `${line.percentFromTop}%` }}
        >
          <div className={cn('w-full border-t border-dashed', getThresholdBorderColor(line.color, isDark))} />
          <span
            className={cn(
              'absolute right-1.5 -translate-y-1/2 px-1.5 py-0.5 rounded text-[8px] font-mono font-medium shadow-sm border backdrop-blur-sm whitespace-nowrap',
              getThresholdBadgeColor(line.color, isDark)
            )}
          >
            {line.badge}
          </span>
        </div>
      ))}
    </div>
  );
};

export const SystemMonitorTimeSeriesPanel = memo(({
  title,
  description,
  deployments,
  metrics,
  metricKey,
  unit = '%',
  maxVal = 100,
  showThresholds = true,
  colorMode = 'dark',
  interval = '1h',
  hasHpa = false,
  hpaTarget = 80,
}: SystemMonitorTimeSeriesPanelProps) => {
  const isDark = colorMode === 'dark';

  const dynamicMax = useMemo(() => {
    let peak = 0;
    for (let d = 0; d < deployments.length; d++) {
      const points = metrics[deployments[d].id];
      if (points) {
        for (let p = 0; p < points.length; p++) {
          const val = Number(points[p][metricKey]);
          if (val > peak) peak = val;
        }
      }
    }
    const floor =
      metricKey === 'memoryValue'
        ? resolveMemoryLimit(deployments, metrics, maxVal)
        : maxVal;
    return calculateDynamicYMax(peak > 0 ? [peak] : [], floor);
  }, [deployments, metrics, metricKey, maxVal]);

  const thresholdLines = useMemo(() => {
    if (!showThresholds) return [];
    return getThresholdReferenceLines(metricKey, dynamicMax, deployments, metrics, maxVal, hasHpa, hpaTarget);
  }, [showThresholds, metricKey, dynamicMax, deployments, metrics, maxVal, hasHpa, hpaTarget]);

  const seriesData = useMemo(() => {
    return deployments.map((dep, idx) => {
      const color = CHART_PALETTE[idx % CHART_PALETTE.length];
      const points = metrics[dep.id] || [];
      const aggregated = aggregateMetricSeries(points, metricKey, interval, dynamicMax, 500, 140);
      const lastPoint = points.at(-1);
      const stats = calculateSeriesStats(dep.id, dep.label, color, aggregated.data, lastPoint);
      return {
        ...stats,
        data: aggregated.data,
        svgPoints: aggregated.svgPoints,
        areaPath: aggregated.areaPath,
        current: Math.round(aggregated.currentVal),
      };
    });
  }, [deployments, metrics, metricKey, dynamicMax, interval]);

  const buildTimeSeriesScrubber = useCallback(
    (hoverPercent: number, capacity: number) =>
      seriesData.map((s) => ({
        id: s.id,
        label: s.label,
        color: s.color,
        value: resolveScrubberPointValue(s.data, s.current, hoverPercent, capacity),
        unit,
        isThrottled: s.isThrottled,
        isOOM: s.isOOM,
      })),
    [seriesData, unit]
  );

  const canvasSeriesList: CanvasSeriesItem[] = useMemo(() => {
    return seriesData.map((s) => ({
      id: s.id,
      color: s.color,
      data: s.data,
      isArea: true,
      lineWidth: 1.75,
    }));
  }, [seriesData]);

  return (
    <SystemMonitorPanelCard
      isDark={isDark}
      headerLeft={
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded bg-blue-500" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider">{title}</h2>
          {description && <span className={cn("text-[10px] font-sans", isDark ? "text-slate-400" : "text-slate-500")}>({description})</span>}
        </div>
      }
      headerRight={
        showThresholds && thresholdLines.length > 0 ? (
          <div className="flex items-center gap-2 text-[9px] font-mono flex-wrap">
            {thresholdLines.map((line) => (
              <span
                key={`legend-threshold-${line.label}-${line.color}`}
                className={cn('flex items-center gap-1 font-medium', getThresholdLegendTextColor(line.color, isDark))}
              >
                <span className={cn('w-2 h-0.5 inline-block', getThresholdLegendDotColor(line.color))} />
                {line.label}
              </span>
            ))}
          </div>
        ) : undefined
      }
      footer={
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono text-left">
            <thead>
              <tr className={cn("border-b", isDark ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-600")}>
                <th className="py-1 font-medium">Workload</th>
                <th className="py-1 font-medium text-right">Current</th>
                <th className="py-1 font-medium text-right">Min</th>
                <th className="py-1 font-medium text-right">Max</th>
                <th className="py-1 font-medium text-right">Avg</th>
                <th className="py-1 font-medium text-right">Alerts</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", isDark ? "divide-slate-800/40" : "divide-slate-100")}>
              {seriesData.map((s) => (
                <tr key={`legend-${s.id}`} className={cn("transition-colors", isDark ? "hover:bg-slate-800/20" : "hover:bg-slate-50")}>
                  <td className="py-1 flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                    <span className="truncate max-w-[150px]">{s.label}</span>
                  </td>
                  <td className="py-1 text-right font-bold" style={{ color: s.color }}>
                    {s.current}
                    {unit}
                  </td>
                  <td className={cn("py-1 text-right", isDark ? "text-slate-400" : "text-slate-600")}>
                    {s.min}
                    {unit}
                  </td>
                  <td className={cn("py-1 text-right", isDark ? "text-slate-400" : "text-slate-600")}>
                    {s.max}
                    {unit}
                  </td>
                  <td className={cn("py-1 text-right", isDark ? "text-slate-400" : "text-slate-600")}>
                    {s.avg}
                    {unit}
                  </td>
                  <td className="py-1 text-right">
                    {s.isThrottled && (
                      <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold mr-1.5", isDark ? "text-amber-400" : "text-amber-700")}>
                        <ZapOff size={10} /> Throttled
                      </span>
                    )}
                    {s.isOOM && (
                      <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold", isDark ? "text-rose-400" : "text-rose-700")}>
                        <AlertTriangle size={10} /> OOM Risk
                      </span>
                    )}
                    {!s.isThrottled && !s.isOOM && (
                      <span className={cn("text-[9px]", isDark ? "text-emerald-400" : "text-emerald-700 font-medium")}>OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      <SystemMonitorInteractiveChart
        heightClass="h-40"
        isDark={isDark}
        interval={interval}
        maxVal={dynamicMax}
        yUnit={unit}
        series={canvasSeriesList}
        buildScrubberValues={buildTimeSeriesScrubber}
        extraOverlay={showThresholds ? <DynamicThresholdLines lines={thresholdLines} isDark={isDark} /> : null}
        isEmpty={deployments.length === 0}
        emptyText="No active workload metrics"
      />
    </SystemMonitorPanelCard>
  );
});
