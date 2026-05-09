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
        <div className="px-1 py-2">
          <input
            type="range"
            min="0"
            max="20000"
            step="500"
            value={data.traffic || 1000}
            onChange={(e) => performUpdate({ traffic: parseInt(e.target.value) || 1000 })}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-[8px] font-mono text-slate-500 italic">1k</span>
            <span className="text-[10px] font-bold text-blue-500">{(data.traffic || 1000).toLocaleString()} <span className="text-[8px] font-normal opacity-70">visits</span></span>
            <span className="text-[8px] font-mono text-slate-500 italic">1M</span>
          </div>
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
