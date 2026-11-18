import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SimulationMetricPoint } from '@/store/types';
import { DeploymentSummary, TimeRangeFilter } from './types';
import {
  CHART_PALETTE,
  aggregateMetricSeries,
  buildSvgPoints,
  parseIntervalMinutes,
  calculateDynamicYMax,
  generateYAxisScale,
  generateXAxisTicks,
} from './chartHelpers';
import {
  SystemMonitorAxisBottom,
  SystemMonitorYScaleOverlay,
  SystemMonitorVerticalGrid,
} from './SystemMonitorChartAxes';
import { Layers } from 'lucide-react';

interface SystemMonitorReplicasPanelProps {
  deployments: DeploymentSummary[];
  metrics: Record<string, SimulationMetricPoint[]>;
  colorMode?: 'dark' | 'light';
  interval?: TimeRangeFilter;
  isSimulating?: boolean;
}

export const SystemMonitorReplicasPanel = ({
  deployments,
  metrics,
  colorMode = 'dark',
  interval = '1h',
  isSimulating = true,
}: SystemMonitorReplicasPanelProps) => {
  const isDark = colorMode === 'dark';

  const allReplicas = useMemo(() => {
    const counts: number[] = [];
    deployments.forEach((dep) => {
      counts.push(dep.replicas || 1);
      const points = metrics[dep.id] || [];
      points.forEach((p) => {
        if (typeof p.replicas === 'number') counts.push(p.replicas);
      });
    });
    return counts;
  }, [deployments, metrics]);

  const dynamicMaxReplicas = useMemo(() => {
    return calculateDynamicYMax(allReplicas, 5, 1.25);
  }, [allReplicas]);

  const yScale = useMemo(() => generateYAxisScale(dynamicMaxReplicas, ' pods', 3), [dynamicMaxReplicas]);
  const xTicks = useMemo(() => generateXAxisTicks(interval), [interval]);

  const replicaSeries = useMemo(() => {
    return deployments.map((dep, idx) => {
      const color = CHART_PALETTE[idx % CHART_PALETTE.length];
      const points = metrics[dep.id] || [];
      const hasMinuteIndex = points.some((p) => typeof p.minuteIndex === 'number');

      if (!hasMinuteIndex) {
        const data = points.map(() => dep.replicas || 1);
        const current = dep.replicas || 1;
        const capacity = Math.round(1440 / parseIntervalMinutes(interval));
        const svgPoints = buildSvgPoints(data, dynamicMaxReplicas, 500, 100, capacity);
        return {
          id: dep.id,
          label: dep.label,
          color,
          current,
          data,
          svgPoints,
        };
      }

      const aggregated = aggregateMetricSeries(points, 'replicas', interval, dynamicMaxReplicas, 500, 100);
      const current = Math.round(aggregated.currentVal) || dep.replicas || 1;
      return {
        id: dep.id,
        label: dep.label,
        color,
        current,
        data: aggregated.data,
        svgPoints: aggregated.svgPoints,
      };
    });
  }, [deployments, metrics, interval, dynamicMaxReplicas]);

  return (
    <div
      className={cn(
        'p-4 rounded-lg border flex flex-col gap-3 transition-colors',
        isDark ? 'bg-[#181b1f] border-[#22252b] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
      )}
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-cyan-400" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider">HPA & Pod Autoscaling Replicas</h2>
        </div>
        <span className="text-[9px] font-mono text-slate-400">Scale Ceiling: {dynamicMaxReplicas} Pods</span>
      </div>

      <div className={cn(
        "h-28 w-full rounded border relative overflow-hidden flex items-center justify-center transition-colors",
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

        {deployments.length === 0 ? (
          <span className="text-xs font-mono text-slate-500">No workload deployments active</span>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 500 100" className="w-full h-full" preserveAspectRatio="none">
            {replicaSeries.map((s) => (
              <polyline
                key={`replica-${s.id}`}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinecap="square"
                strokeLinejoin="miter"
                points={s.svgPoints}
                className="transition-all duration-150"
              />
            ))}
          </svg>
        )}
      </div>

      {/* Dynamic 24-Hour Timeline Bottom Axis */}
      <SystemMonitorAxisBottom xTicks={xTicks} />

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {replicaSeries.map((s) => (
          <div key={`rep-badge-${s.id}`} className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
            <span className={cn("font-medium", isDark ? "text-slate-300" : "text-slate-600")}>{s.label}:</span>
            <span className={cn(
              "font-bold px-1.5 py-0.5 rounded border",
              isDark ? "text-white bg-slate-800 border-slate-700" : "text-slate-800 bg-slate-100 border-slate-300"
            )}>
              {s.current} Replicas
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
