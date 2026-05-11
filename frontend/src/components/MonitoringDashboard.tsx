import { useState, useRef, useEffect, ReactNode } from 'react';
import { useFlowStore } from '../store';
import { cn } from '../lib/utils';
import { Activity, X, Cpu, Database, ExternalLink, AlertTriangle, ZapOff } from 'lucide-react';
import { formatCPU, formatMemory } from '../lib/utils';

const LineChart = ({
  data,
  color,
  label,
  valueFormatter,
  limitValue,
  isPercent = true
}: {
  data: number[],
  color: string,
  label: string,
  valueFormatter?: (v: number) => string,
  limitValue?: number,
  isPercent?: boolean
}) => {
  const points = data.map((val, i) => `${(i / 29) * 200},${100 - (isPercent ? val : (val / (limitValue || 100)) * 100)}`).join(' ');

  return (
    <div className="flex flex-col gap-1 pointer-events-none">
      <div className="flex justify-between items-center px-1 pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {valueFormatter && data.length > 0 && (
            <span className="text-[8px] font-mono text-slate-500">
              {valueFormatter(data[data.length - 1])} / {valueFormatter(limitValue || 0)}
            </span>
          )}
          <span className={cn("text-[10px] font-mono font-bold", `text-${color}-500`)}>
            {data.length > 0 ? Math.round(data[data.length - 1]) : 0}%
          </span>
        </div>
      </div>
      <div className="h-24 w-full bg-slate-950/50 rounded border border-slate-800 relative overflow-hidden pointer-events-none">
        {/* Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between opacity-10 pointer-events-none">
          <div className="border-t border-slate-500 w-full" />
          <div className="border-t border-slate-500 w-full" />
          <div className="border-t border-slate-500 w-full" />
        </div>
        <svg viewBox="0 0 200 100" className="w-full h-full preserve-3d pointer-events-none" preserveAspectRatio="none">
          {/* Limit Line */}
          <line
            x1="0" y1="0" x2="200" y2="0"
            stroke="#ef4444"
            strokeWidth="1"
            strokeDasharray="4 2"
            className="opacity-50"
          />
          <polyline
            fill="none"
            stroke={color === 'blue' ? '#3b82f6' : '#a855f7'}
            strokeWidth="2"
            points={points}
            className="transition-all duration-1000"
          />
          {/* Area under line */}
          <path
            d={`M0,100 ${points} L200,100 Z`}
            fill={color === 'blue' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(168, 85, 247, 0.1)'}
            className="transition-all duration-1000"
          />
        </svg>
      </div>
    </div>
  );
};

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
    n.type === 'PodGroup' ||
    (n.type === 'Pod' && !n.parentId)
  );

  useEffect(() => {
    const channel = new BroadcastChannel('monitoring-data');
    const runtime = window.runtime;

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
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);

    window.open(
      `${window.location.origin}${window.location.pathname}?mode=monitoring`,
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
      <div
        onMouseDown={(e) => {
          setIsDragging(true);
          dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
          };
        }}
        className={cn(
          "h-10 px-4 flex items-center justify-between cursor-move select-none border-b",
          colorMode === 'dark' ? "bg-slate-800/50 border-slate-700/50" : "bg-slate-100 border-slate-200"
        )}
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-blue-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest">System Monitoring</span>
        </div>
        <button
          onClick={() => setMonitoringOpen(false)}
          className="p-1 hover:bg-red-500 hover:text-white rounded transition-colors"
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
            const lastPoint = points[points.length - 1];

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
