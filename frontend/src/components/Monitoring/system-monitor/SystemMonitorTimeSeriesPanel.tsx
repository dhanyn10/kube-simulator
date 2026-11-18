import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SimulationMetricPoint } from '@/store/types';
import { DeploymentSummary, TimeRangeFilter } from './types';
import {
  CHART_PALETTE,
  calculateSeriesStats,
  aggregateMetricSeries,
  calculateDynamicYMax,
  generateYAxisScale,
  generateXAxisTicks,
  getThresholdReferenceLines,
  resolveMemoryLimit,
  ThresholdReferenceLine,
} from './chartHelpers';
import {
  SystemMonitorAxisBottom,
  SystemMonitorYScaleOverlay,
  SystemMonitorVerticalGrid,
} from './SystemMonitorChartAxes';
import { ZapOff, AlertTriangle } from 'lucide-react';

interface SystemMonitorTimeSeriesPanelProps {
  title: string;
  description?: string;
  deployments: DeploymentSummary[];
  metrics: Record<string, SimulationMetricPoint[]>;
  metricKey: 'cpuPercent' | 'memoryPercent' | 'cpuValue' | 'memoryValue';
  unit?: string;
  maxVal?: number;
  showThresholds?: boolean;
  colorMode?: 'dark' | 'light';
  interval?: TimeRangeFilter;
  isSimulating?: boolean;
  hasHpa?: boolean;
  hpaTarget?: number;
}

const getThresholdBorderColor = (color: ThresholdReferenceLine['color']): string => {
  if (color === 'amber') return 'border-amber-500/60';
  if (color === 'rose') return 'border-rose-500/60';
  return 'border-red-500/70';
};

const getThresholdBadgeColor = (color: ThresholdReferenceLine['color']): string => {
  if (color === 'amber') return 'bg-amber-950/85 text-amber-300 border-amber-600/50';
  if (color === 'rose') return 'bg-rose-950/85 text-rose-300 border-rose-600/50';
  return 'bg-red-950/85 text-red-300 border-red-600/50';
};

const getThresholdLegendTextColor = (color: ThresholdReferenceLine['color']): string => {
  if (color === 'amber') return 'text-amber-400';
  if (color === 'rose') return 'text-rose-400';
  return 'text-red-400';
};

const getThresholdLegendDotColor = (color: ThresholdReferenceLine['color']): string => {
  if (color === 'amber') return 'bg-amber-400';
  if (color === 'rose') return 'bg-rose-400';
  return 'bg-red-400';
};

interface DynamicThresholdLinesProps {
  lines: ThresholdReferenceLine[];
}

export const DynamicThresholdLines = ({ lines }: DynamicThresholdLinesProps) => {
  if (lines.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 overflow-hidden">
      {lines.map((line) => (
        <div
          key={`threshold-line-${line.label}-${line.value}`}
          className="absolute inset-x-0"
          style={{ top: `${line.percentFromTop}%` }}
        >
          <div className={cn('w-full border-t border-dashed', getThresholdBorderColor(line.color))} />
          <span
            className={cn(
              'absolute right-1.5 -translate-y-1/2 px-1.5 py-0.5 rounded text-[8px] font-mono font-medium shadow-sm border backdrop-blur-sm whitespace-nowrap',
              getThresholdBadgeColor(line.color)
            )}
          >
            {line.badge}
          </span>
        </div>
      ))}
    </div>
  );
};

export const SystemMonitorTimeSeriesPanel = ({
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
  isSimulating = true,
  hasHpa = false,
  hpaTarget = 80,
}: SystemMonitorTimeSeriesPanelProps) => {
  const isDark = colorMode === 'dark';

  const dynamicMax = useMemo(() => {
    const allValues: number[] = [];
    deployments.forEach((dep) => {
      const points = metrics[dep.id] || [];
      points.forEach((p) => {
        const val = Number(p[metricKey]);
        if (!Number.isNaN(val)) allValues.push(val);
      });
    });
    const floor =
      metricKey === 'memoryValue'
        ? resolveMemoryLimit(deployments, metrics, maxVal)
        : maxVal;
    return calculateDynamicYMax(allValues, floor);
  }, [deployments, metrics, metricKey, maxVal]);

  const yScale = useMemo(() => generateYAxisScale(dynamicMax, unit, 3), [dynamicMax, unit]);
  const xTicks = useMemo(() => generateXAxisTicks(interval), [interval]);

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

  return (
    <div
      className={cn(
        'p-4 rounded-lg border flex flex-col gap-3 transition-colors',
        isDark ? 'bg-[#181b1f] border-[#22252b] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
      )}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded bg-blue-500" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider">{title}</h2>
          {description && <span className="text-[10px] text-slate-400 font-sans">({description})</span>}
        </div>
        {showThresholds && thresholdLines.length > 0 && (
          <div className="flex items-center gap-2 text-[9px] font-mono flex-wrap">
            {thresholdLines.map((line) => (
              <span
                key={`legend-threshold-${line.label}-${line.color}`}
                className={cn('flex items-center gap-1 font-medium', getThresholdLegendTextColor(line.color))}
              >
                <span className={cn('w-2 h-0.5 inline-block', getThresholdLegendDotColor(line.color))} />
                {line.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main Chart Canvas Area */}
      <div className={cn(
        "h-40 w-full rounded border relative overflow-hidden flex items-center justify-center transition-colors",
        isDark ? "bg-[#111217] border-[#22252b]" : "bg-slate-50 border-slate-200"
      )}>
        {/* Horizontal Background Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-20">
          <div className="border-t border-slate-500 w-full" />
          <div className="border-t border-slate-500 w-full" />
          <div className="border-t border-slate-500 w-full" />
        </div>

        {/* Dynamic Vertical Grid Lines */}
        <SystemMonitorVerticalGrid xTicks={xTicks} />

        {/* Dynamic Y-Axis Scale Indicator (Windows Task Manager style) */}
        <SystemMonitorYScaleOverlay ticks={yScale.ticks} />

        {/* Kubernetes-native Dynamic Threshold Lines & Badges */}
        {showThresholds && <DynamicThresholdLines lines={thresholdLines} />}

        {deployments.length === 0 ? (
          <span className="text-xs font-mono text-slate-500">No active workload metrics</span>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 500 140" className="w-full h-full" preserveAspectRatio="none">
            {seriesData.map((s) => (
              <g key={`series-${s.id}`}>
                {/* Area under line */}
                <path
                  d={s.areaPath}
                  fill={s.color}
                  fillOpacity="0.12"
                  className="transition-all duration-150"
                />
                {/* Crisp angular polyline matching Windows 11 Task Manager */}
                <polyline
                  points={s.svgPoints}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-150"
                />
              </g>
            ))}
          </svg>
        )}
      </div>

      {/* Dynamic 24-Hour Timeline Bottom Axis */}
      <SystemMonitorAxisBottom xTicks={xTicks} />

      {/* Metrics Legend Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono text-left">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-1 font-medium">Workload</th>
              <th className="py-1 font-medium text-right">Current</th>
              <th className="py-1 font-medium text-right">Min</th>
              <th className="py-1 font-medium text-right">Max</th>
              <th className="py-1 font-medium text-right">Avg</th>
              <th className="py-1 font-medium text-right">Alerts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {seriesData.map((s) => (
              <tr key={`legend-${s.id}`} className="hover:bg-slate-800/20">
                <td className="py-1 flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                  <span className="truncate max-w-[150px]">{s.label}</span>
                </td>
                <td className="py-1 text-right font-bold" style={{ color: s.color }}>
                  {s.current}
                  {unit}
                </td>
                <td className="py-1 text-right text-slate-400">
                  {s.min}
                  {unit}
                </td>
                <td className="py-1 text-right text-slate-400">
                  {s.max}
                  {unit}
                </td>
                <td className="py-1 text-right text-slate-400">
                  {s.avg}
                  {unit}
                </td>
                <td className="py-1 text-right">
                  {s.isThrottled && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-amber-400 font-bold mr-1.5">
                      <ZapOff size={10} /> Throttled
                    </span>
                  )}
                  {s.isOOM && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-rose-400 font-bold">
                      <AlertTriangle size={10} /> OOM Risk
                    </span>
                  )}
                  {!s.isThrottled && !s.isOOM && (
                    <span className="text-[9px] text-emerald-400">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
