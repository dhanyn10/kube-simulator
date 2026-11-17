import type { CSSProperties } from 'react';
import { Play, Pause, Square, Zap, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBackendGateway } from '@/gateway';
import { WindowControls } from '@/components/Layout';
import { TimeRangeFilter } from './types';

interface SystemMonitorHeaderProps {
  isSimulating: boolean;
  isPaused: boolean;
  simulationSpeed: 1 | 5 | 10;
  timeRange: TimeRangeFilter;
  setTimeRange: (t: TimeRangeFilter) => void;
  sendControl: (action: string, options?: any) => void;
  colorMode: 'dark' | 'light';
}

export const SystemMonitorHeader = ({
  isSimulating,
  isPaused,
  simulationSpeed,
  timeRange,
  setTimeRange,
  sendControl,
  colorMode,
}: SystemMonitorHeaderProps) => {
  const isDark = colorMode === 'dark';
  const tickInterval = simulationSpeed === 10 ? '15ms' : simulationSpeed === 5 ? '30ms' : '150ms';

  const handleWindowClose = () => {
    void getBackendGateway().closeSimulationWindow();
    if (process.env.NODE_ENV !== 'test') {
      try {
        globalThis.close?.();
      } catch {
        // Fallback
      }
    }
  };

  return (
    <header className="flex flex-col shrink-0 select-none">
      {/* 1. Native Frameless Titlebar (Identical to main app MenuBar) */}
      <div
        data-testid="system-monitor-header"
        style={{ '--wails-draggable': 'drag' } as CSSProperties}
        onDoubleClick={() => void getBackendGateway().maximizeWindow()}
        className={cn(
          'h-10 border-b flex items-center justify-between pl-3 pr-0 z-50 text-xs transition-colors',
          isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
        )}
      >
        <div className="flex items-center gap-2" style={{ '--wails-draggable': 'no-drag' } as CSSProperties}>
          <svg aria-hidden="true" viewBox="0 0 512 512" className="w-4 h-4 fill-current text-blue-500 shrink-0">
            <path d="M256 316.1c3.5-.1 7.2 2 8.9 5.1L293 371.7c-3.6 1.2-7.3 2.3-11.2 3.1-21.4 4.9-42.7 3.4-62-3.2l27.9-50.4c1.7-3.1 4.9-5 8.2-5.1zm50.5-23.4l57.2 9.7c-8.4 23.5-24.4 43.9-45.8 57.5l-22.2-53.6c-2-4.7 .1-10.4 4.8-12.6 1.9-.9 4.1-1.3 6-.9zm-89.1 7.7c.5 2.1 .3 4.2-.5 6l-21.8 53.3c-20.5-13.2-36.9-32.9-45.7-57.1l56.7-9.6c5.1-.9 10.1 2.4 11.3 7.5zm58.8-41l-3.9 17.1-15.8 7.6-15.9-7.7-4-17.1 11-13.7 17.7 0 11 13.7zm-73.7-16.7c3.9 3.4 4.4 9.5 1.2 13.6-1.3 1.7-3.1 2.8-5 3.3l-55.3 16.2c-2.8-25.7 3.3-50.7 16.1-71.6l43.1 38.6zm150.7-38.5c6.4 10.4 11.2 22 14.1 34.6 2.9 12.4 3.6 24.8 2.4 36.8l-55.6-16c-5-1.4-8.1-6.7-6.9-11.7 .5-2.1 1.6-3.8 3.1-5.1l42.9-38.5zm-113.8 4.4c-.2 5.2-4.7 9.4-9.9 9.4-2.1 0-4.1-.7-5.7-1.8l-47.3-33.4c14.5-14.3 33.1-24.8 54.5-29.7 3.9-.9 7.8-1.6 11.7-2l-3.3 57.6zm30.8-57.6c25 3.1 48.1 14.4 65.8 31.7l-47.1 33.2c-4.2 3-10 2.3-13.3-1.8-1.3-1.7-2-3.6-2.1-5.6l-3.3-57.5zM254.5-1.3c5.9-.3 11.7 .9 17 3.4L455 89.7c4.7 2.3 8.9 5.6 12.2 9.7s5.6 8.8 6.8 13.9l45.3 196.9c1.2 5.1 1.2 10.4 0 15.5s-3.5 9.9-6.8 13.9L385.6 497.6c-3.3 4.1-7.5 7.4-12.2 9.6s-10 3.4-15.2 3.4l-203.6 0c-5.3 0-10.5-1.2-15.2-3.4s-8.9-5.5-12.2-9.6L.2 339.7c-.7-.9-1.4-1.8-2-2.8-2.6-3.9-4.3-8.3-5.1-12.9s-.7-9.3 .3-13.8L38.7 113.4c1.2-5.1 3.5-9.9 6.8-13.9s7.5-7.4 12.2-9.7L241.1 2.1c4.2-2 8.8-3.2 13.4-3.4zm1.8 67c-6.1 0-11 5.5-11 12.2 0 .1 0 .2 0 .3 0 .9-.1 2 0 2.8 .1 3.9 1 6.9 1.5 10.4 .9 7.7 1.7 14 1.2 19.9-.5 2.2-2.1 4.3-3.6 5.7l-.2 4.6c-6.6 .5-13.2 1.6-19.8 3.1-28.5 6.5-53.1 21.1-71.8 41-1.2-.8-3.3-2.3-4-2.8-2 .3-4 .9-6.5-.6-4.9-3.3-9.4-7.9-14.8-13.4-2.5-2.6-4.3-5.1-7.2-7.7-.7-.6-1.7-1.4-2.4-2-2.3-1.8-5-2.8-7.7-2.9-3.4-.1-6.6 1.2-8.8 3.9-3.8 4.7-2.5 12 2.7 16.2 .1 0 .1 .1 .2 .1 .7 .6 1.6 1.3 2.3 1.8 3.1 2.3 6 3.5 9.1 5.3 6.6 4.1 12 7.4 16.3 11.5 1.7 1.8 2 4.9 2.2 6.3l3.5 3.2c-18.8 28.4-27.6 63.4-22.4 99.1l-4.6 1.3c-1.2 1.6-2.9 4-4.7 4.7-5.6 1.8-12 2.4-19.7 3.3-3.6 .3-6.7 .1-10.5 .8-.8 .2-2 .4-2.9 .7l-.1 0-.2 .1c-6.5 1.6-10.7 7.5-9.3 13.4 1.3 5.9 7.7 9.4 14.2 8l.2 0c.1 0 .1-.1 .2-.1 .9-.2 2.1-.4 2.8-.6 3.8-1 6.5-2.5 9.8-3.8 7.3-2.6 13.3-4.8 19.2-5.6 2.4-.2 5 1.5 6.3 2.2l4.8-.8c11 34.1 34.1 61.7 63.3 79.1l-2 4.8c.7 1.9 1.5 4.4 1 6.2-2.1 5.5-5.8 11.4-9.9 17.9-2 3-4.1 5.3-5.9 8.8-.4 .8-1 2.1-1.4 3-2.8 6-.8 13 4.7 15.6 5.5 2.6 12.2-.1 15.2-6.2l0 0c.4-.9 1-2 1.4-2.8 1.6-3.6 2.1-6.6 3.2-10.1 2.9-7.3 4.5-14.9 8.5-19.7 1.1-1.3 2.9-1.8 4.8-2.3l2.5-4.5c25.5 9.8 54 12.4 82.5 5.9 6.5-1.5 12.8-3.4 18.8-5.7 .7 1.2 2 3.6 2.3 4.2 1.9 .6 3.9 .9 5.6 3.4 3 5.1 5 11.2 7.5 18.5 1.1 3.4 1.6 6.5 3.2 10.1 .4 .8 1 2 1.4 2.8 2.9 6.1 9.7 8.8 15.2 6.2 5.4-2.6 7.5-9.6 4.7-15.6-.4-.9-1-2.1-1.4-3-1.8-3.4-3.9-5.7-5.9-8.7-4.2-6.5-7.6-11.9-9.8-17.4-.9-2.8 .2-4.6 .8-6.5-.4-.5-1.3-3.2-1.8-4.4 30.4-17.9 52.8-46.6 63.3-79.6 1.4 .2 3.9 .7 4.7 .8 1.7-1.1 3.2-2.5 6.2-2.3 5.9 .8 11.9 3 19.2 5.6 3.4 1.3 6.1 2.8 9.8 3.8 .8 .2 1.9 .4 2.8 .6 .1 0 .1 0 .2 .1l.2 0c6.5 1.4 12.8-2.2 14.2-8s-2.8-11.8-9.3-13.4c-.9-.2-2.3-.6-3.2-.7-3.8-.7-6.9-.5-10.5-.8-7.7-.8-14-1.4-19.7-3.2-2.3-.9-4-3.7-4.8-4.8l-4.4-1.3c2.3-16.6 1.7-33.9-2.3-51.3-4-17.5-11.1-33.5-20.6-47.6 1.1-1 3.3-2.9 3.9-3.5 .2-2 0-4 2.1-6.2 4.3-4.1 9.8-7.4 16.3-11.5 3.1-1.8 6-3 9.1-5.3 .7-.5 1.7-1.3 2.4-1.9 5.3-4.2 6.5-11.4 2.7-16.2s-11.1-5.2-16.4-1c-.7 .6-1.8 1.4-2.4 2-2.9 2.5-4.8 5-7.2 7.7-5.4 5.5-9.9 10.1-14.8 13.4-2.1 1.2-5.3 .8-6.7 .7l-4.2 3c-23.8-25-56.2-41-91.2-44.1-.1-1.5-.2-4.1-.2-4.9-1.4-1.4-3.2-2.5-3.6-5.5-.5-5.9 .3-12.3 1.3-19.9 .5-3.6 1.4-6.6 1.5-10.4 0-.9 0-2.2 0-3.1 0-6.7-4.9-12.2-11-12.2z" />
          </svg>
          <span className="font-bold text-[11px] tracking-wide">Kube Simulator</span>
          <span className="text-slate-500 text-[11px]">/</span>
          <span className="font-semibold text-[11px] text-blue-400 font-mono">System Monitor</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">Cluster</span>
        </div>

        {/* Center Draggable Spacer */}
        <div className="flex-1 h-full" />

        {/* Right: Window Controls */}
        <WindowControls
          colorMode={colorMode}
          onClose={handleWindowClose}
        />
      </div>

      {/* 2. Simulation & System Monitor Action Ribbon */}
      <div
        className={cn(
          'h-11 px-4 border-b flex items-center justify-between z-40 transition-colors',
          isDark ? 'bg-[#181b1f] border-[#22252b] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
        )}
      >
        {/* Left: Live Status & Simulation Controls */}
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
                    ? 'bg-blue-600 text-white shadow-sm'
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

        {/* Right: Time Range & Refresh Clock */}
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
        </div>
      </div>
    </header>
  );
};
