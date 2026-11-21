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

  const { trafficData, currentTrafficRpm, currentLatency } = useMemo(
    () => calculateNetworkMetrics(deployments, metrics, interval),
    [deployments, metrics, interval]
  );

  const dynamicMaxRpm = useMemo(
    () => calculateDynamicYMax(trafficData, 100, 1.2),
    [trafficData]
  );

  const canvasSeries: CanvasSeriesItem[] = useMemo(() => [
    {
      id: 'network-traffic',
      color: '#10b981',
      data: trafficData,
      isArea: true,
      lineWidth: 1.75,
    },
  ], [trafficData]);

  const buildNetworkScrubber = useCallback(
    (hoverPercent: number, capacity: number) => {
      const val = resolveScrubberPointValue(trafficData, currentTrafficRpm, hoverPercent, capacity);
      return [
        {
          id: 'ingress-traffic',
          label: 'Ingress Traffic',
          color: '#10b981',
          value: val.toLocaleString('en-US'),
          unit: ' req/min',
        },
      ];
    },
    [trafficData, currentTrafficRpm]
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
            <Activity size={11} /> {currentTrafficRpm.toLocaleString('en-US')} req/min
          </span>
          <span className={cn("font-bold", isDark ? "text-blue-400" : "text-blue-600")}>{currentLatency} ms</span>
        </div>
      }
      footer={
        <div className={cn("flex items-center justify-between text-[10px] font-mono pt-1", isDark ? "text-slate-400" : "text-slate-600")}>
          <span>Protocol: HTTP/2 (Cluster Ingress)</span>
          <span>Peak Scale: {dynamicMaxRpm.toLocaleString('en-US')} req/min</span>
        </div>
      }
    >
      <SystemMonitorInteractiveChart
        isDark={isDark}
        interval={interval}
        maxVal={dynamicMaxRpm}
        yUnit=" req/min"
        series={canvasSeries}
        buildScrubberValues={buildNetworkScrubber}
        isEmpty={deployments.length === 0}
        emptyText="No active traffic simulation"
      />
    </SystemMonitorPanelCard>
  );
});
