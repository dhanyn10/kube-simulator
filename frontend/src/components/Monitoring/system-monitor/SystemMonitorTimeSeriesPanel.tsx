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
}

interface ThresholdLinesProps {
  dynamicMax: number;
}

const ThresholdLines = ({ dynamicMax }: ThresholdLinesProps) => {
  const show80 = 80 <= dynamicMax;
  const show90 = 90 <= dynamicMax;
  const top80 = Math.max(0, Math.round(100 - (80 / dynamicMax) * 90));
  const top90 = Math.max(0, Math.round(100 - (90 / dynamicMax) * 90));

  return (
    <div className="absolute inset-x-0 inset-y-0 pointer-events-none">
      {show80 && (
        <div
          className="absolute inset-x-0 border-t border-dashed border-amber-500/50"
          style={{ top: `${top80}%` }}
        />
      )}
      {show90 && (
        <div
          className="absolute inset-x-0 border-t border-dashed border-rose-500/50"
          style={{ top: `${top90}%` }}
        />
      )}
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
}: SystemMonitorTimeSeriesPanelProps) => {
  const isDark = colorMode === 'dark';

  const dynamicMax = useMemo(() => {
    const allValues: number[] = [];
    deployments.forEach((dep) => {
      const points = metrics[dep.id] || [];
      points.forEach((p) => {
        const val = Number(p[metricKey]);
        if (!isNaN(val)) allValues.push(val);
      });
    });
    return calculateDynamicYMax(allValues, maxVal);
  }, [deployments, metrics, metricKey, maxVal]);

  const yScale = useMemo(() => generateYAxisScale(dynamicMax, unit, 3), [dynamicMax, unit]);
  const xTicks = useMemo(() => generateXAxisTicks(interval), [interval]);

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
        {showThresholds && (
          <div className="flex items-center gap-2 text-[9px] font-mono">
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-0.5 bg-amber-400 inline-block" /> 80% Warn
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2 h-0.5 bg-rose-400 inline-block" /> 90% Crit
            </span>
          </div>
        )}
      </div>

      {/* Main Chart Canvas Area */}
      <div className="h-40 w-full bg-[#111217] rounded border border-[#22252b] relative overflow-hidden flex items-center justify-center">
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

        {/* 80% & 90% Dynamic Threshold Lines */}
        {showThresholds && <ThresholdLines dynamicMax={dynamicMax} />}

        {deployments.length === 0 ? (
          <span className="text-xs font-mono text-slate-500">No active workload metrics</span>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 500 140" className="w-full h-full" preserveAspectRatio="none">
            {seriesData.map((s) => (
              <g key={`series-${s.id}`}>
                {/* Area under line */}
                <path
                  d={`M0,140 ${s.svgPoints} L500,140 Z`}
                  fill={s.color}
                  fillOpacity="0.12"
                  className="transition-all duration-300"
                />
                {/* Main Curve */}
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={s.svgPoints}
                  className="transition-all duration-300"
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
