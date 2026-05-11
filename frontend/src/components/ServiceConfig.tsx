import React from 'react';
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';
import { Box, Network, Eye, EyeOff } from 'lucide-react';

interface ServiceConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
}

export const ServiceConfig = ({ selectedNode, performUpdate, toggleVisibility }: ServiceConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Network size={10} /> Port
          </label>
          <button onClick={() => toggleVisibility('port')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.port !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <input
          type="number"
          value={data.port || 80}
          onChange={(e) => performUpdate({ port: Number.parseInt(e.target.value) || 80 })}
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Network size={10} /> Target Port
          </label>
          <button onClick={() => toggleVisibility('targetPort')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.targetPort !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <input
          type="number"
          value={data.targetPort || 80}
          onChange={(e) => performUpdate({ targetPort: Number.parseInt(e.target.value) || 80 })}
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Box size={10} /> Selector (app)
          </label>
          <button onClick={() => toggleVisibility('selector')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.selector !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <input
          type="text"
          value={data.selector || ''}
          onChange={(e) => performUpdate({ selector: e.target.value })}
          placeholder="app-label"
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        />
      </div>
    </div>
  );
};
