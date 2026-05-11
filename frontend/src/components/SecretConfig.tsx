import React from 'react';
import { cn } from '../lib/utils';
import { useFlowStore } from '../store';
import { Lock, Plus, Trash2, Key, Shield } from 'lucide-react';

interface SecretConfigProps {
  selectedNode: any;
  performUpdate: (updates: any) => void;
  toggleVisibility: (field: string) => void;
}

export const SecretConfig = ({ selectedNode, performUpdate }: SecretConfigProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const data = selectedNode.data;
  const configData = data.configData || [];

  const addData = () => {
    const newData = [...configData, { key: '', value: '' }];
    performUpdate({ configData: newData });
  };

  const updateData = (index: number, key: string, value: string) => {
    const newData = [...configData];
    newData[index] = { key, value };
    performUpdate({ configData: newData });
  };

  const removeData = (index: number) => {
    const newData = configData.filter((_: any, i: number) => i !== index);
    performUpdate({ configData: newData });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Lock size={10} /> Secrets (Key-Value)
          </label>
          <button
            onClick={addData}
            className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-500 hover:bg-indigo-600 text-white text-[9px] font-bold transition-all"
          >
            <Plus size={10} /> Add Item
          </button>
        </div>

        <div className="space-y-2">
          {configData.length === 0 && (
            <div className={cn(
              "text-center py-6 rounded-lg border border-dashed",
              colorMode === 'dark' ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"
            )}>
              <Lock size={20} className="mx-auto mb-1.5 opacity-20" />
              <p className="text-[9px]">Belum ada data secret</p>
            </div>
          )}

          {configData.map((item: any, idx: number) => (
            <div key={idx} className={cn(
              "p-2 rounded-lg border space-y-2",
              colorMode === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"
            )}>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Key size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="KEY"
                    value={item.key}
                    onChange={(e) => updateData(idx, e.target.value, item.value)}
                    className={cn(
                      "w-full pl-6 pr-2 py-1.5 text-[10px] rounded border outline-none font-mono uppercase",
                      colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200 focus:border-indigo-500/50" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-400"
                    )}
                  />
                </div>
                <button
                  onClick={() => removeData(idx)}
                  className="p-1.5 rounded hover:bg-rose-500/10 text-rose-500 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="relative">
                <Shield size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  placeholder="Secret Value"
                  value={item.value}
                  onChange={(e) => updateData(idx, item.key, e.target.value)}
                  className={cn(
                    "w-full pl-6 pr-2 py-1.5 text-[10px] rounded border outline-none",
                    colorMode === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200 focus:border-indigo-500/50" : "bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-400"
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
