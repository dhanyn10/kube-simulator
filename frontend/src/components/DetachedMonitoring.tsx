import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Database, AlertTriangle, ZapOff } from 'lucide-react';
import { cn, formatCPU, formatMemory } from '../lib/utils';

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
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className="flex items-center gap-2">
           {valueFormatter && data.length > 0 && (
             <span className="text-[8px] font-mono text-slate-500">
               {valueFormatter(data[data.length - 1])} / {valueFormatter(limitValue || 0)}
             </span>
           )}
           <span className={cn("text-[10px] font-mono font-bold", color === 'blue' ? "text-blue-500" : "text-purple-500")}>
             {data.length > 0 ? Math.round(data[data.length - 1]) : 0}%
           </span>
        </div>
      </div>
      <div className="h-24 w-full bg-slate-950/50 rounded border border-slate-800 relative overflow-hidden pointer-events-none">
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

export const DetachedMonitoring = () => {
  const [metrics, setMetrics] = useState<any>({});
  const [deployments, setDeployments] = useState<any[]>([]);
  const [colorMode, setColorMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    console.log('[DetachedMonitoring] Initializing sync...');
    const channel = new BroadcastChannel('monitoring-data');

    // @ts-ignore
    const runtime = window.runtime;

    const handleUpdate = (data: any) => {
       setMetrics(data.metrics);
       setDeployments(data.deployments);
    };

    const handleTheme = (mode: 'dark' | 'light') => {
       setColorMode(mode);
    };

    // BroadcastChannel backup
    channel.onmessage = (event) => {
      if (event.data.type === 'METRICS_UPDATE') {
        handleUpdate(event.data);
      } else if (event.data.type === 'THEME_SYNC') {
        handleTheme(event.data.colorMode);
      }
    };

    // Wails Events primary (more reliable between webviews)
    if (runtime) {
      runtime.EventsOn('metrics-update', (json: string) => {
         try { handleUpdate(JSON.parse(json)); } catch(e) {}
      });
      runtime.EventsOn('theme-sync', (mode: any) => {
         handleTheme(mode);
      });
    }

    // Notify main window we are open
    channel.postMessage({ type: 'DETACHED_OPEN' });
    if (runtime) runtime.EventsEmit('detached-open');

    return () => {
      channel.postMessage({ type: 'DETACHED_CLOSED' });
      if (runtime) runtime.EventsEmit('detached-closed');
      channel.close();
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorMode === 'dark');
  }, [colorMode]);

  return (
    <div className={cn(
      "min-h-screen w-full flex flex-col transition-colors",
      colorMode === 'dark' ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-800"
    )}>
      {/* Header */}
      <div className={cn(
        "h-12 px-6 flex items-center justify-between border-b sticky top-0 z-10 backdrop-blur-md",
        colorMode === 'dark' ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200"
      )}>
        <div className="flex items-center gap-3">
          <Activity size={18} className="text-blue-500" />
          <h1 className="text-xs font-bold uppercase tracking-[0.2em]">Real-time Monitoring</h1>
        </div>
        <div className="flex items-center gap-2">
           <span className={cn(
             "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
             colorMode === 'dark' ? "bg-blue-500/10 text-blue-400" : "bg-blue-100 text-blue-600"
           )}>Live</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
        {deployments.length === 0 ? (
          <div className="col-span-full h-[60vh] flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
             <Activity size={48} strokeWidth={1} />
             <p className="text-sm font-medium uppercase tracking-widest">Waiting for simulation data...</p>
          </div>
        ) : (
          deployments.map(dep => {
            const points = metrics[dep.id] || [];
            const lastPoint = points[points.length - 1];

            const cpuData = points.map((p: any) => p.cpuPercent);
            const memData = points.map((p: any) => p.memoryPercent);

            return (
              <div key={dep.id} className={cn(
                "p-5 rounded-2xl border shadow-xl flex flex-col gap-4",
                colorMode === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              )}>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                       <span className="text-sm font-mono font-bold tracking-tight">{dep.label}</span>
                       {lastPoint?.isThrottled && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 animate-pulse">
                           <ZapOff size={12} />
                           <span className="text-[10px] font-bold uppercase">Throttled</span>
                        </div>
                      )}
                      {lastPoint?.isOOM && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 animate-bounce">
                           <AlertTriangle size={12} />
                           <span className="text-[10px] font-bold uppercase">OOM Risk</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-800 text-slate-400 uppercase">
                       {dep.replicas || 1} Replicas
                    </span>
                 </div>

                 <div className="space-y-4">
                    <LineChart
                      data={cpuData}
                      color="blue"
                      label="Processor Load (CPU)"
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
        "h-10 px-6 flex items-center justify-between border-t text-[10px] font-mono uppercase",
        colorMode === 'dark' ? "bg-slate-900 border-slate-800 text-slate-500" : "bg-white border-slate-200 text-slate-400"
      )}>
        <div className="flex gap-6">
           <span className="flex items-center gap-2"><Cpu size={12} /> Sync: BroadcastChannel</span>
           <span className="flex items-center gap-2"><Database size={12} /> Node: Multi-Window</span>
        </div>
        <span>v1.0.0-detached</span>
      </div>
    </div>
  );
};
