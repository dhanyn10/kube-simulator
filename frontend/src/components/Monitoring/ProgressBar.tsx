
import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  subLabel?: string;
  color?: string;
  height?: string;
  colorMode?: 'dark' | 'light';
  className?: string;
  barClassName?: string;
}

export const ProgressBar = ({
  value,
  max = 100,
  label,
  subLabel,
  color = "bg-blue-500",
  height = "h-1",
  colorMode = 'dark',
  className = "",
  barClassName = ""
}: ProgressBarProps) => {
  const percentage = Math.min(100, (value / max) * 100);

  return (
    <div className={cn("space-y-1", className)}>
      {(label || subLabel) && (
        <div className="flex justify-between items-center text-[8px] uppercase font-bold text-slate-500">
          {label && <span>{label}</span>}
          {subLabel && <span className="text-slate-400 font-mono">{subLabel}</span>}
        </div>
      )}
      <div className={cn(
        "w-full rounded-full overflow-hidden",
        height,
        colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100",
        barClassName
      )}>
        <div
          className={cn("h-full transition-all duration-500", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
