import React from 'react';
import { cn } from '../lib/utils';

interface ProgressBarSegment {
  value: number;
  color: string;
  title?: string;
  className?: string;
}

interface MultiProgressBarProps {
  segments: ProgressBarSegment[];
  height?: string;
  colorMode?: 'dark' | 'light';
  className?: string;
}

export const MultiProgressBar = ({
  segments,
  height = "h-2.5",
  colorMode = 'dark',
  className = ""
}: MultiProgressBarProps) => {
  return (
    <div className={cn(
      "rounded-full overflow-hidden flex relative",
      height,
      colorMode === 'dark' ? "bg-slate-800" : "bg-slate-100",
      className
    )}>
      {segments.map((segment, idx) => (
        <div
          key={idx}
          className={cn("h-full transition-all duration-500", segment.color, segment.className)}
          style={{ width: `${segment.value}%` }}
          title={segment.title}
        />
      ))}
    </div>
  );
};
