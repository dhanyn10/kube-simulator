import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GrafanaStatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: ReactNode;
  sparklineData?: number[];
  threshold?: 'normal' | 'warning' | 'critical';
  colorMode?: 'dark' | 'light';
}

export const GrafanaStatCard = ({
  title,
  value,
  unit,
  subtitle,
  icon,
  sparklineData = [],
  threshold = 'normal',
  colorMode = 'dark',
}: GrafanaStatCardProps) => {
  const isDark = colorMode === 'dark';

  const thresholdColor =
    threshold === 'critical'
      ? 'text-rose-400'
      : threshold === 'warning'
      ? 'text-amber-400'
      : 'text-emerald-400';

  const strokeColor =
    threshold === 'critical' ? '#ef4444' : threshold === 'warning' ? '#f59e0b' : '#10b981';

  const sparklinePoints = sparklineData.length > 1
    ? sparklineData
        .map((val, idx) => {
          const max = Math.max(100, ...sparklineData);
          const x = (idx / (sparklineData.length - 1)) * 120;
          const y = 30 - Math.min(26, (val / max) * 26);
          return `${x},${y}`;
        })
        .join(' ')
    : '';

  return (
    <div
      className={cn(
        'p-3.5 rounded-lg border flex flex-col justify-between relative overflow-hidden transition-all',
        isDark ? 'bg-[#181b1f] border-[#22252b]' : 'bg-white border-slate-200'
      )}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-[11px] font-bold uppercase tracking-wider font-mono">{title}</span>
        <div className="opacity-70">{icon}</div>
      </div>

      {/* Main Metric Value */}
      <div className="my-2 flex items-baseline gap-1.5">
        <span className={cn('text-2xl font-bold font-mono tracking-tight', thresholdColor)}>
          {value}
        </span>
        {unit && <span className="text-xs font-mono text-slate-400">{unit}</span>}
      </div>

      {/* Subtitle & Sparkline Footer */}
      <div className="flex items-end justify-between pt-1 border-t border-slate-800/40">
        <span className="text-[10px] text-slate-400 truncate max-w-[120px] font-mono">{subtitle}</span>
        {sparklinePoints && (
          <svg aria-hidden="true" className="w-[80px] h-[24px] overflow-visible" viewBox="0 0 120 30">
            <polyline
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparklinePoints}
            />
          </svg>
        )}
      </div>
    </div>
  );
};
