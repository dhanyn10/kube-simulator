import { cn } from '../../lib/utils';

export const LineChart = ({
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
              {valueFormatter(data.at(-1) || 0)} / {valueFormatter(limitValue || 0)}
            </span>
          )}
          <span className={cn("text-[10px] font-mono font-bold", `text-${color}-500`)}>
            {data.length > 0 ? Math.round(data.at(-1) || 0) : 0}%
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
