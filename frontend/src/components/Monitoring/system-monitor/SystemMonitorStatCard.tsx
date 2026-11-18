import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SystemMonitorStatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: ReactNode;
  sparklineData?: number[];
  threshold?: 'normal' | 'warning' | 'critical';
  colorMode?: 'dark' | 'light';
}

const getThresholdStyles = (
  threshold: 'normal' | 'warning' | 'critical',
  isDark: boolean
): { text: string; stroke: string } => {
  if (isDark) {
    if (threshold === 'critical') return { text: 'text-rose-400', stroke: '#ef4444' };
    if (threshold === 'warning') return { text: 'text-amber-400', stroke: '#f59e0b' };
    return { text: 'text-emerald-400', stroke: '#10b981' };
  }

  if (threshold === 'critical') return { text: 'text-rose-700', stroke: '#dc2626' };
  if (threshold === 'warning') return { text: 'text-amber-700', stroke: '#d97706' };
  return { text: 'text-emerald-700', stroke: '#059669' };
};

export const SystemMonitorStatCard = ({
  title,
  value,
  unit,
  subtitle,
  icon,
  sparklineData = [],
  threshold = 'normal',
  colorMode = 'dark',
}: SystemMonitorStatCardProps) => {
  const isDark = colorMode === 'dark';

  const { text: thresholdColor, stroke: strokeColor } = getThresholdStyles(threshold, isDark);

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
      <div className={cn("flex items-center justify-between", isDark ? "text-slate-400" : "text-slate-600")}>
        <span className="text-[11px] font-bold uppercase tracking-wider font-mono">{title}</span>
        <div className="opacity-70">{icon}</div>
      </div>

      {/* Main Metric Value */}
      <div className="my-2 flex items-baseline gap-1.5">
        <span className={cn('text-2xl font-bold font-mono tracking-tight', thresholdColor)}>
          {value}
        </span>
        {unit && <span className={cn("text-xs font-mono", isDark ? "text-slate-400" : "text-slate-600")}>{unit}</span>}
      </div>

      {/* Subtitle & Sparkline Footer */}
      <div className={cn("flex items-end justify-between pt-1 border-t", isDark ? "border-slate-800/40" : "border-slate-200")}>
        <span className={cn("text-[10px] truncate max-w-[120px] font-mono", isDark ? "text-slate-400" : "text-slate-600")}>{subtitle}</span>
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
