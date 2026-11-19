import { useMemo, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { BaseSystemMonitorPanelProps } from './types';
import {
  resolveScrubberPointValue,
  calculateDynamicYMax,
  calculateNetworkMetrics,
} from './chartHelpers';
import {
  SystemMonitorPanelCard,
  SystemMonitorInteractiveChart,
} from './SystemMonitorChartAxes';
import { type CanvasSeriesItem } from './SystemMonitorCanvasRenderer';
import { Activity, Globe } from 'lucide-react';

export type SystemMonitorNetworkPanelProps = BaseSystemMonitorPanelProps;

export const SystemMonitorNetworkPanel = memo(({
  deployments,
  metrics,
  colorMode = 'dark',
  interval = '1h',
}: SystemMonitorNetworkPanelProps) => {
  const isDark = colorMode === 'dark';

  const { rpsData, currentRps, currentLatency } = useMemo(
    () => calculateNetworkMetrics(deployments, metrics, interval),
    [deployments, metrics, interval]
  );

  const dynamicMaxRps = useMemo(
    () => calculateDynamicYMax(rpsData, 100, 1.2),
    [rpsData]
  );

  const canvasSeries: CanvasSeriesItem[] = useMemo(() => [
    {
      id: 'network-rps',
      color: '#10b981',
      data: rpsData,
      isArea: true,
      lineWidth: 1.75,
    },
  ], [rpsData]);

  const buildNetworkScrubber = useCallback(
    (hoverPercent: number, capacity: number) => {
      const val = resolveScrubberPointValue(rpsData, currentRps, hoverPercent, capacity);
      return [
        {
          id: 'ingress-rps',
          label: 'Ingress Traffic',
          color: '#10b981',
          value: val.toLocaleString('en-US'),
          unit: ' req/s',
        },
      ];
    },
    [rpsData, currentRps]
  );

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
      <SystemMonitorInteractiveChart
        isDark={isDark}
        interval={interval}
        maxVal={dynamicMaxRps}
        yUnit=" req/s"
        series={canvasSeries}
        buildScrubberValues={buildNetworkScrubber}
        isEmpty={deployments.length === 0}
        emptyText="No active traffic simulation"
      />
    </SystemMonitorPanelCard>
  );
});
