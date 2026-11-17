import type { CSSProperties } from 'react';
import { Play, Pause, Square, Zap, Clock, RefreshCw, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBackendGateway } from '@/gateway';
import { WindowControls } from '@/components/Layout';
import { TimeRangeFilter } from './types';

interface GrafanaHeaderProps {
  isSimulating: boolean;
  isPaused: boolean;
  simulationSpeed: 1 | 5 | 10;
  timeRange: TimeRangeFilter;
  setTimeRange: (t: TimeRangeFilter) => void;
  sendControl: (action: string, options?: any) => void;
  colorMode: 'dark' | 'light';
}

export const GrafanaHeader = ({
  isSimulating,
  isPaused,
  simulationSpeed,
  timeRange,
  setTimeRange,
  sendControl,
  colorMode,
}: GrafanaHeaderProps) => {
  const isDark = colorMode === 'dark';
  const tickInterval = simulationSpeed === 10 ? '15ms' : simulationSpeed === 5 ? '30ms' : '150ms';

  return (
    <header
      data-testid="grafana-header"
      style={{ '--wails-draggable': 'drag' } as CSSProperties}
      onDoubleClick={() => void getBackendGateway().maximizeWindow()}
      className={cn(
        'h-12 pl-4 pr-0 flex items-center justify-between border-b sticky top-0 z-20 select-none transition-colors',
        isDark ? 'bg-[#181b1f] border-[#22252b] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
      )}
    >
      {/* Left: Grafana Branding & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
          <BarChart2 size={18} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span>Dashboards</span>
            <span>/</span>
            <span className="text-orange-400 font-bold">Kubernetes</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-bold tracking-wide uppercase font-sans">Real-time Monitoring</h1>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">v10.4.0</span>
          </div>
        </div>
      </div>

      {/* Center: Live Status & Simulation Controls */}
      <div className="flex items-center gap-3" style={{ '--wails-draggable': 'no-drag' } as CSSProperties}>
        {/* Live Status Badge */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono border',
            isSimulating && !isPaused
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : isSimulating && isPaused
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-slate-800/60 text-slate-400 border-slate-700/50'
          )}
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isSimulating && !isPaused
                ? 'bg-emerald-400 animate-ping'
                : isSimulating && isPaused
                ? 'bg-amber-400'
                : 'bg-slate-500'
            )}
          />
          <span>{isSimulating && !isPaused ? 'Live' : isSimulating && isPaused ? 'Paused' : 'Idle'}</span>
        </div>

        {/* Play / Pause / Resume Controls */}
        <div className="flex items-center rounded border border-slate-700/60 bg-slate-900/60 p-0.5">
          {!isSimulating ? (
            <button
              type="button"
              onClick={() => sendControl('start', { speed: simulationSpeed })}
              className="px-2.5 py-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
              title="Start Simulation"
            >
              <Play size={12} fill="currentColor" />
              <span>Start</span>
            </button>
          ) : isPaused ? (
            <button
              type="button"
              onClick={() => sendControl('resume')}
              className="px-2.5 py-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
              title="Resume Simulation"
            >
              <Play size={12} fill="currentColor" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => sendControl('pause')}
              className="px-2.5 py-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 rounded transition-colors"
              title="Pause Simulation"
            >
              <Pause size={12} fill="currentColor" />
              <span>Pause</span>
            </button>
          )}

          {isSimulating && (
            <button
              type="button"
              onClick={() => sendControl('stop')}
              className="px-2 py-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded transition-colors"
              title="Stop Simulation"
            >
              <Square size={12} fill="currentColor" />
            </button>
          )}
        </div>

        {/* Speed Selector Pills */}
        <div className="flex items-center rounded border border-slate-700/60 bg-slate-900/60 p-0.5 text-[10px] font-mono font-bold">
          {([1, 5, 10] as const).map((s) => (
            <button
              key={`speed-${s}`}
              type="button"
              onClick={() => sendControl('speed', { speed: s })}
              className={cn(
                'px-2 py-0.5 rounded transition-all',
                simulationSpeed === s
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              )}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Chaos Spike Button */}
        <button
          type="button"
          onClick={() => sendControl('traffic_spike', { multiplier: 2.0 })}
          className="px-2.5 py-1 flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded transition-all active:scale-95"
          title="Inject 2x Traffic Spike (Chaos Test)"
        >
          <Zap size={12} className="text-amber-400" />
          <span>+ Spike 2x</span>
        </button>
      </div>

      {/* Right: Time Range & Refresh Clock & Frameless Window Controls */}
      <div className="flex items-center gap-2" style={{ '--wails-draggable': 'no-drag' } as CSSProperties}>
        {/* Time Range Selector */}
        <div className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700/60 bg-slate-900/40 text-[10px] font-mono text-slate-300">
          <Clock size={12} className="text-slate-400" />
          {(['1m', '5m', '15m', 'all'] as const).map((range) => (
            <button
              key={`range-${range}`}
              type="button"
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-1.5 py-0.5 rounded transition-colors',
                timeRange === range ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {range}
            </button>
          ))}
        </div>

        {/* Sync Rate Indicator */}
        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 px-2 py-1 rounded bg-slate-900/40 border border-slate-800">
          <RefreshCw size={11} className={cn('text-blue-400', isSimulating && !isPaused && 'animate-spin')} />
          <span>{tickInterval}</span>
        </div>

        {/* Window Controls */}
        <WindowControls
          colorMode={colorMode}
          onClose={() => {
            void getBackendGateway().closeSimulationWindow();
            if (process.env.NODE_ENV !== 'test') {
              try {
                globalThis.close?.();
              } catch {
                // Ignore fallback error
              }
            }
          }}
        />
      </div>
    </header>
  );
};
