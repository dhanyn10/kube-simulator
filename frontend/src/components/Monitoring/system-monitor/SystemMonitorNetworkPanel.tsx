import { useMemo, useState, useCallback } from 'react';
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
import { SystemMonitorScrubber, type ScrubberSeriesValue } from './SystemMonitorScrubber';
import { SystemMonitorCanvasRenderer, type CanvasSeriesItem } from './SystemMonitorCanvasRenderer';
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

  const canvasSeries: CanvasSeriesItem[] = useMemo(() => [
    {
      id: 'network-rps',
      color: '#10b981',
      data: rpsData,
      isArea: true,
      lineWidth: 1.75,
    },
  ], [rpsData]);

  const [hoverState, setHoverState] = useState<{
    percent: number;
    timeLabel: string;
  } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percent = Math.round((x / rect.width) * 1000) / 10;
    const minute = Math.round((percent / 100) * 1440);
    const hh = String(Math.floor(minute / 60)).padStart(2, '0');
    const mm = String(minute % 60).padStart(2, '0');
    setHoverState({ percent, timeLabel: `${hh}:${mm}` });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverState(null);
  }, []);

  const scrubberValues: ScrubberSeriesValue[] = useMemo(() => {
    if (!hoverState) return [];
    const len = rpsData.length;
    let val = currentRps;
    if (len > 0) {
      const idx = Math.min(len - 1, Math.max(0, Math.round((hoverState.percent / 100) * (len - 1))));
      val = rpsData[idx] ?? currentRps;
    }
    return [
      {
        id: 'ingress-rps',
        label: 'Ingress Traffic',
        color: '#10b981',
        value: val.toLocaleString('en-US'),
        unit: ' req/s',
      },
    ];
  }, [hoverState, rpsData, currentRps]);

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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        overlay={hoverState ? <SystemMonitorScrubber hoverPercent={hoverState.percent} timeLabel={hoverState.timeLabel} values={scrubberValues} isDark={isDark} /> : undefined}
        isEmpty={deployments.length === 0}
        emptyText="No active traffic simulation"
      >
        <SystemMonitorCanvasRenderer
          series={canvasSeries}
          maxVal={dynamicMaxRps}
          capacity={capacity}
        />
      </SystemMonitorChartCanvas>
    </SystemMonitorPanelCard>
  );
};
