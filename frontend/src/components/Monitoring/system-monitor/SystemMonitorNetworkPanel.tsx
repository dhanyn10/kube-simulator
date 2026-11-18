import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SimulationMetricPoint } from '@/store/types';
import { DeploymentSummary, TimeRangeFilter } from './types';
import {
  buildSvgPoints,
  buildAreaPath,
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
import { Activity, Globe } from 'lucide-react';

interface SystemMonitorNetworkPanelProps {
  deployments: DeploymentSummary[];
  metrics: Record<string, SimulationMetricPoint[]>;
  colorMode?: 'dark' | 'light';
  interval?: TimeRangeFilter;
  isSimulating?: boolean;
}

export const SystemMonitorNetworkPanel = ({
  deployments,
  metrics,
  colorMode = 'dark',
  interval = '1h',
  isSimulating = true,
}: SystemMonitorNetworkPanelProps) => {
  const isDark = colorMode === 'dark';

  const { rpsData, currentRps, currentLatency } = useMemo(() => {
    const intervalMinutes = parseIntervalMinutes(interval);
    let rpsArr: number[] = [];
    let latArr: number[] = [];

    const allPoints = Object.values(metrics).flat();
    const hasMinuteIndex = allPoints.some((p) => typeof p.minuteIndex === 'number');

    if (!hasMinuteIndex) {
      deployments.forEach((dep) => {
        const points = metrics[dep.id] || [];
        const replicas = dep.replicas || 1;
        points.forEach((p, idx) => {
          const rps = Math.round((p.cpuPercent || 0) * 15 * replicas);
          const lat = Math.round(5 + (p.cpuPercent || 0) * 0.4);
          rpsArr[idx] = (rpsArr[idx] || 0) + rps;
          latArr[idx] = Math.max(latArr[idx] || 0, lat);
        });
      });
    } else {
      const bucketRpsMap = new Map<number, number>();
      const bucketLatMap = new Map<number, number>();

      deployments.forEach((dep) => {
        const points = metrics[dep.id] || [];
        const replicas = dep.replicas || 1;
        points.forEach((p) => {
          const minIdx = ((p.minuteIndex ?? 0) % 1440 + 1440) % 1440;
          const bIdx = Math.floor(minIdx / intervalMinutes);
          const rps = Math.round((p.cpuPercent || 0) * 15 * replicas);
          const lat = Math.round(5 + (p.cpuPercent || 0) * 0.4);

          bucketRpsMap.set(bIdx, (bucketRpsMap.get(bIdx) || 0) + rps);
          bucketLatMap.set(bIdx, Math.max(bucketLatMap.get(bIdx) || 0, lat));
        });
      });

      const sortedIndices = Array.from(bucketRpsMap.keys()).sort((a, b) => a - b);
      if (sortedIndices.length > 0) {
        const maxB = sortedIndices.at(-1)!;
        for (let b = 0; b <= maxB; b++) {
          rpsArr.push(bucketRpsMap.get(b) || 0);
          latArr.push(bucketLatMap.get(b) || 0);
        }
      }
    }

    const cRps = rpsArr.at(-1) || 0;
    const cLat = latArr.at(-1) || 0;

    return {
      rpsData: rpsArr,
      currentRps: cRps,
      currentLatency: cLat,
    };
  }, [deployments, metrics, interval]);

  const dynamicMaxRps = useMemo(() => {
    return calculateDynamicYMax(rpsData, 100, 1.2);
  }, [rpsData]);

  const capacity = Math.round(1440 / parseIntervalMinutes(interval));
  const rpsPoints = buildSvgPoints(rpsData, dynamicMaxRps, 500, 100, capacity);
  const areaPath = buildAreaPath(rpsPoints, 500, 100);
  const yScale = useMemo(() => generateYAxisScale(dynamicMaxRps, ' req/s', 3), [dynamicMaxRps]);
  const xTicks = useMemo(() => generateXAxisTicks(interval), [interval]);

  return (
    <div
      className={cn(
        'p-4 rounded-lg border flex flex-col gap-3 transition-colors',
        isDark ? 'bg-[#181b1f] border-[#22252b] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
      )}
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-emerald-400" />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider">Network Ingress & Response Latency</h2>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="text-emerald-400 flex items-center gap-1 font-bold">
            <Activity size={11} /> {currentRps.toLocaleString('en-US')} req/s
          </span>
          <span className="text-blue-400 font-bold">{currentLatency} ms</span>
        </div>
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
          <span className="text-xs font-mono text-slate-500">No active traffic simulation</span>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 500 100" className="w-full h-full" preserveAspectRatio="none">
            {/* Area under line */}
            <path
              d={areaPath}
              fill="#10b981"
              fillOpacity="0.15"
              className="transition-all duration-150"
            />
            {/* Crisp angular polyline matching Windows 11 Task Manager */}
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={rpsPoints}
              className="transition-all duration-150"
            />
          </svg>
        )}
      </div>

      {/* Dynamic 24-Hour Timeline Bottom Axis */}
      <SystemMonitorAxisBottom xTicks={xTicks} />

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
        <span>Protocol: HTTP/2 (Cluster Ingress)</span>
        <span>Peak Scale: {dynamicMaxRps.toLocaleString('en-US')} req/s</span>
      </div>
    </div>
  );
};
