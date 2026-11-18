import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { BaseSystemMonitorPanelProps } from './types';
import {
  calculateDynamicYMax,
  extractReplicaCounts,
  calculateReplicaSeries,
} from './chartHelpers';
import {
  SystemMonitorPanelCard,
  SystemMonitorChartCanvas,
  useChartScales,
} from './SystemMonitorChartAxes';
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
        isEmpty={deployments.length === 0}
        emptyText="No workload deployments active"
      >
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
      </SystemMonitorChartCanvas>
    </SystemMonitorPanelCard>
  );
};
