import { useMemo, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { BaseSystemMonitorPanelProps } from './types';
import {
  calculateDynamicYMax,
  extractReplicaCounts,
  calculateReplicaSeries,
  resolveScrubberPointValue,
} from './chartHelpers';
import {
  SystemMonitorPanelCard,
  SystemMonitorInteractiveChart,
} from './SystemMonitorChartAxes';
import { type CanvasSeriesItem } from './SystemMonitorCanvasRenderer';
import { Layers } from 'lucide-react';

export type SystemMonitorReplicasPanelProps = BaseSystemMonitorPanelProps;

export const SystemMonitorReplicasPanel = memo(({
  deployments,
  metrics,
  colorMode = 'dark',
  interval = '1h',
}: SystemMonitorReplicasPanelProps) => {
  const isDark = colorMode === 'dark';

  const allReplicas = useMemo(
    () => extractReplicaCounts(deployments, metrics),
    [deployments, metrics]
  );

  const dynamicMaxReplicas = useMemo(
    () => calculateDynamicYMax(allReplicas, 5, 1.25),
    [allReplicas]
  );

  const replicaSeries = useMemo(
    () => calculateReplicaSeries(deployments, metrics, interval, dynamicMaxReplicas),
    [deployments, metrics, interval, dynamicMaxReplicas]
  );

  const canvasSeries: CanvasSeriesItem[] = useMemo(
    () =>
      replicaSeries.map((s) => ({
        id: s.id,
        color: s.color,
        data: s.data,
        isArea: false,
        isStepped: true,
        lineWidth: 2,
      })),
    [replicaSeries]
  );

  const buildReplicaScrubber = useCallback(
    (hoverPercent: number, capacity: number) =>
      replicaSeries.map((s) => ({
        id: s.id,
        label: s.label,
        color: s.color,
        value: resolveScrubberPointValue(s.data, s.current, hoverPercent, capacity),
        unit: ' Pods',
      })),
    [replicaSeries]
  );

  return (
    <SystemMonitorPanelCard
      isDark={isDark}
      headerLeft={
        <div className="flex items-center gap-2">
          <Layers size={14} className={isDark ? "text-cyan-400" : "text-cyan-700"} />
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider">HPA & Pod Autoscaling Replicas</h2>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {replicaSeries.map((s) => (
            <div key={`rep-badge-${s.id}`} className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
              <span className={cn("font-medium", isDark ? "text-slate-300" : "text-slate-600")}>{s.label}:</span>
              <span className={cn(
                "font-bold badge-chip",
                isDark ? "text-white bg-slate-800 border-slate-700" : "text-slate-800 bg-slate-100 border-slate-300"
              )}>
                {s.current} Replicas
              </span>
            </div>
          ))}
        </div>
      }
    >
      <SystemMonitorInteractiveChart
        isDark={isDark}
        interval={interval}
        maxVal={dynamicMaxReplicas}
        yUnit=" pods"
        series={canvasSeries}
        buildScrubberValues={buildReplicaScrubber}
        isEmpty={deployments.length === 0}
        emptyText="No workload deployments active"
      />
    </SystemMonitorPanelCard>
  );
});

SystemMonitorReplicasPanel.displayName = 'SystemMonitorReplicasPanel';
