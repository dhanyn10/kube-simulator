import React from 'react';
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';
import { Network, Layers, Eye, EyeOff } from 'lucide-react';

interface InternetConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
}

export const InternetConfig = ({ selectedNode, performUpdate, toggleVisibility }: InternetConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Network size={10} /> Data Traffic
          </label>
          <button onClick={() => toggleVisibility('traffic')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.traffic !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={data.traffic || 0}
            onChange={(e) => performUpdate({ traffic: parseInt(e.target.value) || 0 })}
            className={cn(
              "flex-1 text-[10px] p-2 rounded border outline-none",
              colorMode === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
            )}
          />
          <span className="text-[10px] font-mono text-slate-400">Visits</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Layers size={10} /> Data Duration
          </label>
          <button onClick={() => toggleVisibility('duration')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.duration !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(['second', 'minute', 'hour'] as const).map((unit) => (
            <button
              key={unit}
              onClick={() => performUpdate({ durationUnit: unit })}
              className={cn(
                "text-[9px] py-1 rounded border transition-all capitalize",
                (data.durationUnit || 'minute') === unit
                  ? "bg-blue-600 border-blue-600 text-white"
                  : (colorMode === 'dark' ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-slate-50 border-slate-200 hover:border-slate-300")
              )}
            >
              {unit}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
