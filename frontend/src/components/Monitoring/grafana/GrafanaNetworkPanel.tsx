import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SimulationMetricPoint } from '@/store/types';
import { DeploymentSummary } from './types';
import { buildSvgPoints } from './chartHelpers';
import { Activity, Globe } from 'lucide-react';

interface GrafanaNetworkPanelProps {
  deployments: DeploymentSummary[];
  metrics: Record<string, SimulationMetricPoint[]>;
  colorMode?: 'dark' | 'light';
}

export const GrafanaNetworkPanel = ({
  deployments,
  metrics,
  colorMode = 'dark',
}: GrafanaNetworkPanelProps) => {
  const isDark = colorMode === 'dark';

  const { rpsData, latencyData, currentRps, currentLatency } = useMemo(() => {
    let rpsArr: number[] = [];
    let latArr: number[] = [];

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

    const cRps = rpsArr.at(-1) || 0;
    const cLat = latArr.at(-1) || 0;

    return {
      rpsData: rpsArr,
      latencyData: latArr,
      currentRps: cRps,
      currentLatency: cLat,
    };
  }, [deployments, metrics]);

  const maxRps = Math.max(2000, ...rpsData);
  const rpsPoints = buildSvgPoints(rpsData, maxRps, 500, 100);

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
          <span className="text-emerald-400 font-bold">{currentRps} req/s</span>
          <span className="text-amber-400 font-bold">{currentLatency} ms avg</span>
        </div>
      </div>

      <div className="h-28 w-full bg-[#111217] rounded border border-[#22252b] relative overflow-hidden flex items-center justify-center">
        {rpsData.length === 0 ? (
          <span className="text-xs font-mono text-slate-500">Waiting for gateway traffic...</span>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 500 100" className="w-full h-full" preserveAspectRatio="none">
            <path
              d={`M0,100 ${rpsPoints} L500,100 Z`}
              fill="#10b981"
              fillOpacity="0.12"
            />
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={rpsPoints}
            />
          </svg>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
        <span className="flex items-center gap-1.5">
          <Activity size={11} className="text-emerald-400" />
          Throughput: Ingress Controller (HTTP 200/OK)
        </span>
        <span>Peak: {maxRps} rps</span>
      </div>
    </div>
  );
};
