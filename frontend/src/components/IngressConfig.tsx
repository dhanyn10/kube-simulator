import React from 'react';
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';
import { Globe, Code, Eye, EyeOff } from 'lucide-react';

interface IngressConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
}

export const IngressConfig = ({ selectedNode, performUpdate, toggleVisibility }: IngressConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Globe size={10} /> Host
          </label>
          <button onClick={() => toggleVisibility('host')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.host !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <input
          type="text"
          value={data.ingressHost || ''}
          onChange={(e) => performUpdate({ ingressHost: e.target.value })}
          placeholder="example.com"
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Code size={10} /> Path
          </label>
          <button onClick={() => toggleVisibility('path')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.path !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <input
          type="text"
          value={data.ingressPath || ''}
          onChange={(e) => performUpdate({ ingressPath: e.target.value })}
          placeholder="/"
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        />
      </div>
    </div>
  );
};
