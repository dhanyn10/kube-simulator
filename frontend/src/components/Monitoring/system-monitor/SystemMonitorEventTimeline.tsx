import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, ChevronDown, ChevronUp, Bell, ShieldAlert, Cpu, Layers } from 'lucide-react';
import { DeploymentSummary } from './types';
import { SimulationMetricPoint } from '@/store/types';

export interface ClusterIncidentEvent {
  id: string;
  timestamp: string;
  type: 'scale' | 'throttle' | 'oom' | 'spike' | 'info';
  level: 'info' | 'warn' | 'critical';
  title: string;
  description: string;
}

export interface SystemMonitorEventTimelineProps {
  deployments: DeploymentSummary[];
  metrics: Record<string, SimulationMetricPoint[]>;
  isDark?: boolean;
}

export const SystemMonitorEventTimeline = ({
  deployments,
  metrics,
  isDark = true,
}: SystemMonitorEventTimelineProps) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [filterLevel, setFilterLevel] = useState<'all' | 'warn' | 'critical'>('all');

  const incidents = useMemo(() => {
    const deduplicated: ClusterIncidentEvent[] = [];
    const seen = new Set<string>();

    for (let d = 0; d < deployments.length; d++) {
      const dep = deployments[d];
      const points = metrics[dep.id] || [];
      const len = points.length;
      if (len === 0) continue;

      // Scan backwards from latest points (check recent points first)
      const minBound = Math.max(0, len - 60);
      for (let idx = len - 1; idx >= minBound; idx--) {
        const p = points[idx];
        if (!p.isOOM && !p.isThrottled) continue;

        const type = p.isOOM ? 'oom' : 'throttle';
        const key = `${type}-${dep.id}`;
        if (seen.has(key)) continue;

        seen.add(key);
        const minIdx = typeof p.minuteIndex === 'number' ? ((p.minuteIndex % 1440) + 1440) % 1440 : idx;
        const hh = String(Math.floor(minIdx / 60)).padStart(2, '0');
        const mm = String(minIdx % 60).padStart(2, '0');
        const timeStr = `${hh}:${mm}`;

        if (p.isOOM) {
          deduplicated.push({
            id: `oom-${dep.id}-${minIdx}-${idx}`,
            timestamp: timeStr,
            type: 'oom',
            level: 'critical',
            title: `OOM Risk Detected on ${dep.label}`,
            description: `Memory working set reached ${p.memoryValue || 0} MiB (Limit: ${p.memoryLimit || 256} MiB). Pod eviction imminent.`,
          });
        } else {
          deduplicated.push({
            id: `throttle-${dep.id}-${minIdx}-${idx}`,
            timestamp: timeStr,
            type: 'throttle',
            level: 'warn',
            title: `CPU Throttling on ${dep.label}`,
            description: `CPU utilization hit 100% quota limit (${p.cpuValue || 0}m). CFS bandwidth throttle active.`,
          });
        }

        if (deduplicated.length >= 10) break;
      }
      if (deduplicated.length >= 10) break;
    }

    return deduplicated;
  }, [deployments, metrics]);

  const filteredIncidents = useMemo(() => {
    if (filterLevel === 'all') return incidents;
    return incidents.filter((inc) => inc.level === filterLevel);
  }, [incidents, filterLevel]);

  const getIncidentIcon = (type: ClusterIncidentEvent['type'], level: ClusterIncidentEvent['level']) => {
    if (level === 'critical') {
      return <ShieldAlert size={13} className="text-rose-400 shrink-0" />;
    }
    if (type === 'throttle') {
      return <Cpu size={13} className="text-amber-400 shrink-0" />;
    }
    if (type === 'scale') {
      return <Layers size={13} className="text-purple-400 shrink-0" />;
    }
    return <AlertCircle size={13} className="text-blue-400 shrink-0" />;
  };

  const getIncidentBadgeClass = (level: ClusterIncidentEvent['level']) => {
    if (level === 'critical') {
      return isDark ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-rose-50 text-rose-800 border-rose-300';
    }
    if (level === 'warn') {
      return isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-800 border-amber-300';
    }
    return isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-blue-50 text-blue-800 border-blue-300';
  };

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden transition-all shadow-sm",
        isDark ? "bg-[#181b1f] border-[#22252b]" : "bg-white border-slate-200"
      )}
    >
      {/* Header Bar */}
      <div className={cn(
        "px-4 py-2 flex items-center justify-between border-b select-none",
        isDark ? "bg-[#15171b] border-[#22252b]" : "bg-slate-50 border-slate-200"
      )}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider uppercase cursor-pointer"
        >
          <Bell size={13} className="text-blue-500" />
          <span>Cluster Incidents & Autoscaling Event Timeline</span>
          {incidents.length > 0 && (
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[9px] font-bold border",
              incidents.some(i => i.level === 'critical')
                ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                : "bg-blue-500/20 text-blue-400 border-blue-500/40"
            )}>
              {incidents.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {/* Quick Filter Buttons */}
          <div className="flex items-center text-[9px] font-mono rounded border p-0.5" style={{ borderColor: isDark ? '#2e323b' : '#e2e8f0' }}>
            <button
              type="button"
              onClick={() => setFilterLevel('all')}
              className={cn("px-1.5 py-0.5 rounded transition-colors", filterLevel === 'all' && (isDark ? "bg-slate-700 text-white font-bold" : "bg-slate-200 text-slate-800 font-bold"))}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('warn')}
              className={cn("px-1.5 py-0.5 rounded transition-colors", filterLevel === 'warn' && (isDark ? "bg-amber-900/60 text-amber-300 font-bold" : "bg-amber-100 text-amber-800 font-bold"))}
            >
              Warnings
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('critical')}
              className={cn("px-1.5 py-0.5 rounded transition-colors", filterLevel === 'critical' && (isDark ? "bg-rose-900/60 text-rose-300 font-bold" : "bg-rose-100 text-rose-800 font-bold"))}
            >
              Critical
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-800/40 rounded transition-colors cursor-pointer text-slate-400"
            aria-label={isExpanded ? "Collapse event stream" : "Expand event stream"}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Body List */}
      {isExpanded && (
        <div className="p-3 max-h-[180px] overflow-y-auto space-y-2 font-mono text-[11px] custom-scrollbar">
          {filteredIncidents.length === 0 ? (
            <div className={cn("text-center py-4 text-xs font-mono", isDark ? "text-slate-500" : "text-slate-400")}>
              No active warnings or incidents recorded in this simulation cycle. All pods running within quota.
            </div>
          ) : (
            filteredIncidents.map((inc) => (
              <div
                key={inc.id}
                className={cn(
                  "p-2 rounded border flex items-start justify-between gap-3 transition-colors",
                  isDark ? "bg-[#111217] border-[#22252b]" : "bg-slate-50 border-slate-200"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">{getIncidentIcon(inc.type, inc.level)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{inc.title}</span>
                      <span className={cn("px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider border font-bold", getIncidentBadgeClass(inc.level))}>
                        {inc.level}
                      </span>
                    </div>
                    <p className={cn("text-[10px] mt-0.5", isDark ? "text-slate-400" : "text-slate-600")}>
                      {inc.description}
                    </p>
                  </div>
                </div>

                <span className={cn("text-[9px] shrink-0 font-bold", isDark ? "text-slate-500" : "text-slate-400")}>
                  {inc.timestamp}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
