import { ReactNode } from 'react';
import { cn, formatCPU, formatMemory } from '@/lib/utils';
import { Activity, X, Cpu, Database, ExternalLink, AlertTriangle, ZapOff } from 'lucide-react';
import { LineChart } from './LineChart';
import { useMonitoringDashboardHandler } from '@/activities/monitoring';

const getDashboardPanelClass = (isOverloaded: boolean, isDark: boolean): string => {
  if (isOverloaded) {
    return "bg-red-950/95 border-red-500 shadow-red-900/50";
  }
  return isDark ? "bg-slate-900/95 border-slate-700" : "bg-white/95 border-slate-200";
};

const getDashboardHeaderClass = (isOverloaded: boolean, isDark: boolean): string => {
  if (isOverloaded) {
    return "bg-red-900/70 border-red-700";
  }
  return isDark ? "bg-slate-800/60 border-slate-700/50" : "bg-slate-100 border-slate-200";
};

/**
 * Main monitoring dashboard: SystemMonitorPanelCard grid or legacy monitoring view,
 * with open/close controls and store state (position, simulation state).
 */
export const MonitoringDashboard = () => {
  const {
    isMonitoringOpen,
    setMonitoringOpen,
    isMonitoringDetached,
    simulationMetrics,
    colorMode,
    position,
    dashboardRef,
    workloads,
    isSimulating,
    clusterCpuAvg,
    clusterMemAvg,
    isOverloaded,
    handleDetach,
    handleMouseDown,
  } = useMonitoringDashboardHandler();

  if (!isMonitoringOpen || isMonitoringDetached) return null;

  const isDark = colorMode === 'dark';
  const panelClass = getDashboardPanelClass(isOverloaded, isDark);
  const headerClass = getDashboardHeaderClass(isOverloaded, isDark);

  return (
    <div
      ref={dashboardRef}
      style={{ left: position.x, top: position.y }}
      className={cn(
        "fixed w-[420px] rounded-xl shadow-2xl border z-[500] flex flex-col overflow-hidden backdrop-blur-md transition-colors",
        panelClass
      )}
    >
      {/* Header / Drag Handle */}
      <div className={cn(
          "h-10 flex items-center justify-between border-b select-none",
          headerClass
        )}>
        <button
          type="button"
          onMouseDown={handleMouseDown}
          className="flex-1 h-full px-4 flex items-center gap-2 cursor-move select-none outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-blue-500/50"
          aria-label="Drag to move dashboard"
        >
          <Activity size={14} className={isOverloaded ? "text-red-300 animate-pulse" : "text-blue-500"} />
          <span className="text-[11px] font-bold uppercase tracking-widest font-mono">
            {isOverloaded ? 'System Overloaded' : 'System Monitoring'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMonitoringOpen(false)}
          className="p-1 mr-3 hover:bg-red-500 hover:text-white rounded transition-colors shrink-0"
          aria-label="Close dashboard"
        >
          <X size={14} />
        </button>
      </div>

      {/* Task Manager Real-Time Quick Stats Banner */}
      <div className={cn(
        "px-4 py-2 border-b flex items-center justify-between text-[10px] font-mono select-none",
        colorMode === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
      )}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold">
            <span className={cn(
              "w-2 h-2 rounded-full",
              isSimulating ? "bg-emerald-400 animate-ping" : "bg-slate-500"
            )} />
            {isSimulating ? "LIVE" : "IDLE"}
          </span>
          <span className="text-slate-400">
            CPU: <b className="text-blue-400">{clusterCpuAvg}%</b>
          </span>
          <span className="text-slate-400">
            MEM: <b className="text-purple-400">{clusterMemAvg}%</b>
          </span>
        </div>
        <button
          type="button"
          onClick={handleDetach}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors border",
            colorMode === 'dark'
              ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
          )}
          title="Open in separate window"
        >
          <ExternalLink size={9} />
          Detach
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 max-h-[500px] custom-scrollbar">
        {workloads.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-slate-500 gap-2">
            <Activity size={24} className="opacity-20" />
            <p className="text-[10px] uppercase font-bold tracking-tight">No deployments detected</p>
          </div>
        ) : (
          workloads.map(dep => {
            const points = simulationMetrics[dep.id] || [];
            const lastPoint = points.at(-1);

            const cpuData = points.map(p => p.cpuPercent);
            const memData = points.map(p => p.memoryPercent);

            return (
              <div key={dep.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/30 pb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-500" />
                    <span className="text-[11px] font-mono font-bold text-violet-400">{dep.data.label as ReactNode}</span>
                    {lastPoint?.isThrottled && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 animate-pulse">
                        <ZapOff size={10} />
                        <span className="text-[8px] font-bold uppercase">Throttled</span>
                      </div>
                    )}
                    {lastPoint?.isOOM && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 animate-bounce">
                        <AlertTriangle size={10} />
                        <span className="text-[8px] font-bold uppercase">OOM Risk</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                    {(dep.data.replicas || 1) as ReactNode} Replicas
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <LineChart
                    data={cpuData}
                    color="blue"
                    label="CPU Usage"
                    valueFormatter={formatCPU}
                    limitValue={lastPoint?.cpuLimit}
                    isAlert={Boolean(lastPoint?.isThrottled || lastPoint?.isOOM)}
                  />
                  <LineChart
                    data={memData}
                    color="purple"
                    label="Memory Usage"
                    valueFormatter={formatMemory}
                    limitValue={lastPoint?.memoryLimit}
                    isAlert={Boolean(lastPoint?.isThrottled || lastPoint?.isOOM)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className={cn(
        "h-8 px-4 flex items-center justify-between border-t text-[8px] font-mono uppercase",
        colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"
      )}>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><Cpu size={8} /> Real-time tracking</span>
          <span className="flex items-center gap-1"><Database size={8} /> HPA Sync: Active</span>
        </div>
        <span>v1.0.0-mon</span>
      </div>
    </div>
  );
};
