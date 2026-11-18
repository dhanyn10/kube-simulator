import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { BaseSystemMonitorPanelProps } from './types';
import {
  buildSvgPoints,
  buildAreaPath,
  parseIntervalMinutes,
  calculateDynamicYMax,
  calculateNetworkMetrics,
} from './chartHelpers';
import {
  SystemMonitorPanelCard,
  SystemMonitorChartCanvas,
  useChartScales,
} from './SystemMonitorChartAxes';
import { Activity, Globe } from 'lucide-react';

export type SystemMonitorNetworkPanelProps = BaseSystemMonitorPanelProps;

export const SystemMonitorNetworkPanel = ({
  deployments,
  metrics,
  colorMode = 'dark',
  interval = '1h',
}: SystemMonitorNetworkPanelProps) => {
  const isDark = colorMode === 'dark';

  const { rpsData, currentRps, currentLatency } = useMemo(() => {
    return calculateNetworkMetrics(deployments, metrics, interval);
  }, [deployments, metrics, interval]);

  const dynamicMaxRps = useMemo(() => {
    return calculateDynamicYMax(rpsData, 100, 1.2);
  }, [rpsData]);

  const capacity = Math.round(1440 / parseIntervalMinutes(interval));
  const rpsPoints = buildSvgPoints(rpsData, dynamicMaxRps, 500, 100, capacity);
  const areaPath = buildAreaPath(rpsPoints, 500, 100);
  const { yScale, xTicks } = useChartScales(dynamicMaxRps, ' req/s', interval);

  return (
    <SystemMonitorPanelCard
      isDark={isDark}
      headerLeft={
        <div className="flex items-center gap-2">
          <Globe size={14} className={isDark ? "text-emerald-400" : "text-emerald-600"} />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider">Network Ingress & Response Latency</h2>
        </div>
      }
      headerRight={
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className={cn("flex items-center gap-1 font-bold", isDark ? "text-emerald-400" : "text-emerald-700")}>
            <Activity size={11} /> {currentRps.toLocaleString('en-US')} req/s
          </span>
          <span className={cn("font-bold", isDark ? "text-blue-400" : "text-blue-600")}>{currentLatency} ms</span>
        </div>
      }
      footer={
        <div className={cn("flex items-center justify-between text-[10px] font-mono pt-1", isDark ? "text-slate-400" : "text-slate-600")}>
          <span>Protocol: HTTP/2 (Cluster Ingress)</span>
          <span>Peak Scale: {dynamicMaxRps.toLocaleString('en-US')} req/s</span>
        </div>
      }
    >
      <SystemMonitorChartCanvas
        isDark={isDark}
        xTicks={xTicks}
        yScaleTicks={yScale.ticks}
        isEmpty={deployments.length === 0}
        emptyText="No active traffic simulation"
      >
        <svg aria-hidden="true" viewBox="0 0 500 100" className="w-full h-full" preserveAspectRatio="none">
          <path
            d={areaPath}
            fill="#10b981"
            fillOpacity="0.15"
            className="transition-all duration-150"
          />
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
      </SystemMonitorChartCanvas>
    </SystemMonitorPanelCard>
  );
};
