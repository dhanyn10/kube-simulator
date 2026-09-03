import React from 'react';
import { Cpu, HardDrive } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ResourceBudgetControlsProps {
  cpuValue: string;
  memoryValue: string;
  onCpuChange: (val: string) => void;
  onMemoryChange: (val: string) => void;
  colorMode: string;
  cpuLabel?: string;
  memoryLabel?: string;
}

export const ResourceBudgetControls: React.FC<ResourceBudgetControlsProps> = ({
  cpuValue,
  memoryValue,
  onCpuChange,
  onMemoryChange,
  colorMode,
  cpuLabel = 'CPU Allocation / Limit',
  memoryLabel = 'Memory Allocation / Limit',
}) => {
  const isDark = colorMode === 'dark';

  return (
    <div className="space-y-3">
      {/* CPU Control */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={cn("text-[10px] font-bold uppercase tracking-wider flex items-center gap-1", isDark ? "text-slate-400" : "text-slate-600")}>
            <Cpu size={12} className="text-cyan-400" />
            {cpuLabel}
          </label>
          <span className="text-[10px] font-mono font-bold text-cyan-400">{cpuValue || '500m'}</span>
        </div>
        <input
          type="text"
          value={cpuValue || '500m'}
          onChange={(e) => onCpuChange(e.target.value)}
          placeholder="e.g. 500m or 1"
          className={cn(
            "w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono outline-none focus:ring-1 focus:ring-cyan-500/50",
            isDark ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-300 text-slate-800"
          )}
        />
      </div>

      {/* Memory Control */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={cn("text-[10px] font-bold uppercase tracking-wider flex items-center gap-1", isDark ? "text-slate-400" : "text-slate-600")}>
            <HardDrive size={12} className="text-purple-400" />
            {memoryLabel}
          </label>
          <span className="text-[10px] font-mono font-bold text-purple-400">{memoryValue || '256Mi'}</span>
        </div>
        <input
          type="text"
          value={memoryValue || '256Mi'}
          onChange={(e) => onMemoryChange(e.target.value)}
          placeholder="e.g. 256Mi or 1Gi"
          className={cn(
            "w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono outline-none focus:ring-1 focus:ring-purple-500/50",
            isDark ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-300 text-slate-800"
          )}
        />
      </div>
    </div>
  );
};
