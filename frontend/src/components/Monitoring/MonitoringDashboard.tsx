import { useState, useRef, useEffect, ReactNode } from 'react';
import { useFlowStore } from '../../store';
import { cn, formatCPU, formatMemory } from '../../lib/utils';
import { Activity, X, Cpu, Database, ExternalLink, AlertTriangle, ZapOff } from 'lucide-react';
import { LineChart } from './LineChart';

export const MonitoringDashboard = () => {
  const isMonitoringOpen = useFlowStore((state) => state.isMonitoringOpen);
  const setMonitoringOpen = useFlowStore((state) => state.setMonitoringOpen);
  const isMonitoringDetached = useFlowStore((state) => state.isMonitoringDetached);
  const setMonitoringDetached = useFlowStore((state) => state.setMonitoringDetached);
  const simulationMetrics = useFlowStore((state) => state.simulationMetrics);
  const nodes = useFlowStore((state) => state.nodes);
  const colorMode = useFlowStore((state) => state.colorMode);

  const [position, setPosition] = useState({ x: 400, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dashboardRef = useRef<HTMLDivElement>(null);

  const workloads = nodes.filter(n =>
    n.type === 'Deployment' ||
    n.type === 'ReplicaSet' ||
    (n.type === 'Pod' && !n.parentId)
  );

  useEffect(() => {
    const channel = new BroadcastChannel('monitoring-data');
    const runtime = globalThis.runtime;

    const handleOpen = () => {
      setMonitoringDetached(true);
      setMonitoringOpen(false);
    };

    const handleClose = () => {
      setMonitoringDetached(false);
    };

    channel.onmessage = (event) => {
      if (event.data.type === 'DETACHED_OPEN') {
        handleOpen();
      } else if (event.data.type === 'DETACHED_CLOSED') {
        handleClose();
      }
    };

    if (runtime) {
      runtime.EventsOn('detached-open', handleOpen);
      runtime.EventsOn('detached-closed', handleClose);
    }

    return () => channel.close();
  }, [setMonitoringDetached, setMonitoringOpen]);

  const handleDetach = () => {
    const width = 800;
    const height = 600;
    const left = (globalThis.screen.width / 2) - (width / 2);
    const top = (globalThis.screen.height / 2) - (height / 2);

    globalThis.open(
      `${globalThis.location.origin}${globalThis.location.pathname}?mode=monitoring`,
      '_blank',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isMonitoringOpen || isMonitoringDetached) return null;

  return (
    <div
      ref={dashboardRef}
      style={{ left: position.x, top: position.y }}
      className={cn(
        "fixed w-[400px] rounded-xl shadow-2xl border z-[1000] flex flex-col overflow-hidden backdrop-blur-md",
        colorMode === 'dark' ? "bg-slate-900/90 border-slate-700" : "bg-white/90 border-slate-200"
      )}
    >
      {/* Header / Drag Handle */}
      <div className={cn(
          "h-10 flex items-center justify-between border-b",
          colorMode === 'dark' ? "bg-slate-800/50 border-slate-700/50" : "bg-slate-100 border-slate-200"
        )}>
        <button
          type="button"
          onMouseDown={(e) => {
            setIsDragging(true);
            dragStart.current = {
              x: e.clientX - position.x,
              y: e.clientY - position.y
            };
          }}
          className="flex-1 h-full px-4 flex items-center gap-2 cursor-move select-none outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-blue-500/50"
          aria-label="Drag to move dashboard"
        >
          <Activity size={14} className="text-blue-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest">System Monitoring</span>
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

      <div className={cn(
        "px-4 py-2 border-b flex items-center justify-between",
        colorMode === 'dark' ? "bg-blue-500/5" : "bg-blue-50"
      )}>
        <span className="text-[10px] text-slate-500">View on separate window?</span>
        <button
          type="button"
          onClick={handleDetach}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-colors"
        >
          <ExternalLink size={10} />
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
                  />
                  <LineChart
                    data={memData}
                    color="purple"
                    label="Memory Usage"
                    valueFormatter={formatMemory}
                    limitValue={lastPoint?.memoryLimit}
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
