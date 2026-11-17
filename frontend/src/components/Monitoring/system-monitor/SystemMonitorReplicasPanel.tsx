import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SimulationMetricPoint } from '@/store/types';
import { DeploymentSummary } from './types';
import { CHART_PALETTE, buildSvgPoints } from './chartHelpers';
import { Layers } from 'lucide-react';

interface SystemMonitorReplicasPanelProps {
  deployments: DeploymentSummary[];
  metrics: Record<string, SimulationMetricPoint[]>;
  colorMode?: 'dark' | 'light';
}

export const SystemMonitorReplicasPanel = ({
  deployments,
  metrics,
  colorMode = 'dark',
}: SystemMonitorReplicasPanelProps) => {
  const isDark = colorMode === 'dark';

  const replicaSeries = useMemo(() => {
    return deployments.map((dep, idx) => {
      const color = CHART_PALETTE[idx % CHART_PALETTE.length];
      const points = metrics[dep.id] || [];
      const data = points.map(() => dep.replicas || 1);
      const current = dep.replicas || 1;
      const svgPoints = buildSvgPoints(data, 10, 500, 100);
      return { id: dep.id, label: dep.label, color, current, data, svgPoints };
    });
  }, [deployments, metrics]);

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
        <span className="text-[9px] font-mono text-slate-400">Target: Autoscaling</span>
      </div>

      <div className="h-28 w-full bg-[#111217] rounded border border-[#22252b] relative overflow-hidden flex items-center justify-center">
        {deployments.length === 0 ? (
          <span className="text-xs font-mono text-slate-500">No workload deployments active</span>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 500 100" className="w-full h-full" preserveAspectRatio="none">
            {replicaSeries.map((s) => (
              <polyline
                key={`replica-${s.id}`}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
                points={s.svgPoints}
                className="transition-all duration-300"
              />
            ))}
          </svg>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {replicaSeries.map((s) => (
          <div key={`rep-badge-${s.id}`} className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
            <span className="text-slate-300 font-medium">{s.label}:</span>
            <span className="font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              {s.current} Replicas
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
