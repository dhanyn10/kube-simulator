import React from 'react';
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';
import { Database, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface PVCConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
}

export const PVCConfig = ({ selectedNode, performUpdate, toggleVisibility }: PVCConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;

  const accessModes = [
    { value: 'ReadWriteOnce', label: 'RWO', desc: 'ReadWriteOnce: Bisa diakses 1 Pod (Read/Write)' },
    { value: 'ReadOnlyMany', label: 'ROX', desc: 'ReadOnlyMany: Banyak Pod bisa baca saja' },
    { value: 'ReadWriteMany', label: 'RWX', desc: 'ReadWriteMany: Banyak Pod bisa Read/Write' },
  ];

  return (
    <div className="space-y-4">
      {/* Capacity */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Database size={10} /> Kapasitas (Storage)
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['1Gi', '5Gi', '10Gi'].map((size) => (
            <button
              key={size}
              onClick={() => performUpdate({ storageCapacity: size })}
              className={cn(
                "py-1.5 text-[10px] font-bold rounded border transition-all",
                data.storageCapacity === size
                  ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : (colorMode === 'dark'
                      ? "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300")
              )}
            >
              {size}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={data.storageCapacity || '1Gi'}
          onChange={(e) => performUpdate({ storageCapacity: e.target.value })}
          placeholder="Custom (misal: 20Gi)"
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        />
      </div>

      {/* Access Mode */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <ShieldCheck size={10} /> Mode Akses
          </label>
        </div>
        <div className="flex flex-col gap-2">
          {accessModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => performUpdate({ accessMode: mode.value })}
              className={cn(
                "flex flex-col items-start p-2 rounded border text-left transition-all",
                data.accessMode === mode.value
                  ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : (colorMode === 'dark'
                      ? "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300")
              )}
            >
              <span className="text-[10px] font-bold">{mode.label}</span>
              <span className={cn(
                "text-[8px] leading-tight mt-0.5",
                data.accessMode === mode.value ? "text-orange-100" : "text-slate-500"
              )}>
                {mode.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Storage Class */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Database size={10} /> Storage Class
          </label>
          <button onClick={() => toggleVisibility('storageClass')} className="text-slate-500 hover:text-blue-500 transition-colors">
            {(data.displaySettings?.storageClass !== false) ? <Eye size={10} /> : <EyeOff size={10} />}
          </button>
        </div>
        <select
          value={data.storageClass || 'standard'}
          onChange={(e) => performUpdate({ storageClass: e.target.value })}
          className={cn(
            "w-full text-[10px] p-2 rounded border outline-none",
            colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
          )}
        >
          <option value="standard">Standard (HDD)</option>
          <option value="ssd">Fast (SSD)</option>
          <option value="cloud-nfs">Cloud Storage (NFS)</option>
          <option value="local-storage">Local Storage</option>
        </select>
      </div>
    </div>
  );
};
