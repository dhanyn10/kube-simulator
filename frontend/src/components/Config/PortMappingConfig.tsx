import React from 'react';
import { Network } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PortMappingConfigProps {
  port: number | string;
  targetPort?: number | string;
  onPortChange: (val: number) => void;
  onTargetPortChange?: (val: number) => void;
  colorMode: string;
  portLabel?: string;
  targetPortLabel?: string;
}

export const PortMappingConfig: React.FC<PortMappingConfigProps> = ({
  port,
  targetPort,
  onPortChange,
  onTargetPortChange,
  colorMode,
  portLabel = 'Service Port',
  targetPortLabel = 'Target Port (Container)',
}) => {
  const isDark = colorMode === 'dark';

  return (
    <div className="space-y-3">
      {/* Service Port */}
      <div>
        <label className={cn("block text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1", isDark ? "text-slate-400" : "text-slate-600")}>
          <Network size={12} className="text-amber-400" />
          {portLabel}
        </label>
        <input
          type="number"
          min={1}
          max={65535}
          value={port || 80}
          onChange={(e) => onPortChange(Number.parseInt(e.target.value, 10) || 80)}
          className={cn(
            "w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500/50",
            isDark ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-300 text-slate-800"
          )}
        />
      </div>

      {/* Target Port */}
      {onTargetPortChange !== undefined && (
        <div>
          <label className={cn("block text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1", isDark ? "text-slate-400" : "text-slate-600")}>
            <Network size={12} className="text-amber-400" />
            {targetPortLabel}
          </label>
          <input
            type="number"
            min={1}
            max={65535}
            value={targetPort || 80}
            onChange={(e) => onTargetPortChange(Number.parseInt(e.target.value, 10) || 80)}
            className={cn(
              "w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500/50",
              isDark ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-300 text-slate-800"
            )}
          />
        </div>
      )}
    </div>
  );
};
