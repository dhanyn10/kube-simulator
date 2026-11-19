import { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { BaseSystemMonitorPanelProps } from './types';
import {
  calculateDynamicYMax,
  extractReplicaCounts,
  calculateReplicaSeries,
  parseIntervalMinutes,
} from './chartHelpers';
import {
  SystemMonitorPanelCard,
  SystemMonitorChartCanvas,
  useChartScales,
} from './SystemMonitorChartAxes';
import { SystemMonitorScrubber, type ScrubberSeriesValue } from './SystemMonitorScrubber';
import { SystemMonitorCanvasRenderer, type CanvasSeriesItem } from './SystemMonitorCanvasRenderer';
import { Layers } from 'lucide-react';

export type SystemMonitorReplicasPanelProps = BaseSystemMonitorPanelProps;

export const SystemMonitorReplicasPanel = ({
  deployments,
  metrics,
  colorMode = 'dark',
  interval = '1h',
}: SystemMonitorReplicasPanelProps) => {
  const isDark = colorMode === 'dark';

  const allReplicas = useMemo(() => {
    return extractReplicaCounts(deployments, metrics);
  }, [deployments, metrics]);

  const dynamicMaxReplicas = useMemo(() => {
    return calculateDynamicYMax(allReplicas, 5, 1.25);
  }, [allReplicas]);

  const { yScale, xTicks } = useChartScales(dynamicMaxReplicas, ' pods', interval);

  const replicaSeries = useMemo(() => {
    return calculateReplicaSeries(deployments, metrics, interval, dynamicMaxReplicas);
  }, [deployments, metrics, interval, dynamicMaxReplicas]);

  const capacity = Math.round(1440 / parseIntervalMinutes(interval));

  const canvasSeries: CanvasSeriesItem[] = useMemo(() => {
    return replicaSeries.map((s) => ({
      id: s.id,
      color: s.color,
      data: s.data,
      isArea: false,
      isStepped: true,
      lineWidth: 2,
    }));
  }, [replicaSeries]);

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
    return replicaSeries.map((s) => {
      const len = s.data.length;
      let val = s.current;
      if (len > 0) {
        const idx = Math.min(len - 1, Math.max(0, Math.round((hoverState.percent / 100) * (len - 1))));
        val = s.data[idx] ?? s.current;
      }
      return {
        id: s.id,
        label: s.label,
        color: s.color,
        value: val,
        unit: ' Pods',
      };
    });
  }, [hoverState, replicaSeries]);

  return (
    <SystemMonitorPanelCard
      isDark={isDark}
      headerLeft={
        <div className="flex items-center gap-2">
          <Layers size={14} className={isDark ? "text-cyan-400" : "text-cyan-700"} />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider">HPA & Pod Autoscaling Replicas</h2>
        </div>
      }
      headerRight={
        <span className={cn("text-[9px] font-mono", isDark ? "text-slate-400" : "text-slate-600")}>
          Scale Ceiling: {dynamicMaxReplicas} Pods
        </span>
      }
      footer={
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
        emptyText="No workload deployments active"
      >
        <SystemMonitorCanvasRenderer
          series={canvasSeries}
          maxVal={dynamicMaxReplicas}
          capacity={capacity}
        />
      </SystemMonitorChartCanvas>
    </SystemMonitorPanelCard>
  );
};
