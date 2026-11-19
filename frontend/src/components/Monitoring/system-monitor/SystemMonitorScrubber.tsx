import { memo } from 'react';
import { cn } from '@/lib/utils';
import { ZapOff, AlertTriangle } from 'lucide-react';

export interface ScrubberSeriesValue {
  id: string;
  label: string;
  color: string;
  value: number | string;
  unit?: string;
  isThrottled?: boolean;
  isOOM?: boolean;
}

export interface SystemMonitorScrubberProps {
  readonly hoverPercent: number;
  readonly timeLabel: string;
  readonly values: ScrubberSeriesValue[];
  readonly isDark?: boolean;
}

export const SystemMonitorScrubber = memo(({
  hoverPercent,
  timeLabel,
  values,
  isDark = true,
}: SystemMonitorScrubberProps) => {
  const isNearRightEdge = hoverPercent > 68;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden">
      {/* 1. Vertical Guideline */}
      <div
        className={cn(
          "absolute inset-y-0 w-px border-l-2 border-dashed transition-opacity",
          isDark ? "border-blue-400/80 shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "border-blue-600/80 shadow-[0_0_8px_rgba(37,99,235,0.4)]"
        )}
        style={{ left: `${hoverPercent}%` }}
      />

      {/* 2. Top Time Badge */}
      <div
        className={cn(
          "absolute top-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shadow-md border -translate-x-1/2 whitespace-nowrap z-30 transition-transform",
          isDark
            ? "bg-slate-900/95 border-blue-500/50 text-blue-300"
            : "bg-white/95 border-blue-400 text-blue-700"
        )}
        style={{ left: `${hoverPercent}%` }}
      >
        {timeLabel}
      </div>

      {/* 3. Floating Tooltip Popover */}
      <div
        className={cn(
          "absolute top-7 p-2 rounded-lg border shadow-xl backdrop-blur-md z-30 min-w-[140px] max-w-[220px] transition-transform",
          isNearRightEdge ? "-translate-x-full -ml-3" : "translate-x-0 ml-3",
          isDark
            ? "bg-slate-950/95 border-slate-700/80 text-slate-200"
            : "bg-white/95 border-slate-300 text-slate-800"
        )}
        style={{ left: `${hoverPercent}%` }}
      >
        <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-700/40 text-[9px] font-mono text-slate-400 font-bold">
          <span>Time: {timeLabel}</span>
          <span className="text-[8px] uppercase tracking-wider opacity-75">Snapshot</span>
        </div>

        <div className="space-y-1">
          {values.map((s) => (
            <div key={`scrub-val-${s.id}`} className="flex items-center justify-between gap-2 text-[10px] font-mono">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: s.color }} />
                <span className="truncate max-w-[90px]">{s.label}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 font-bold" style={{ color: s.color }}>
                <span>
                  {s.value}
                  {s.unit}
                </span>
                {s.isThrottled && <ZapOff size={9} className="text-amber-400" />}
                {s.isOOM && <AlertTriangle size={9} className="text-rose-400" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

SystemMonitorScrubber.displayName = 'SystemMonitorScrubber';
