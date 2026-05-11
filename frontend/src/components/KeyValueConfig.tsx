import React from 'react';
import { cn } from '../lib/utils';
import { Plus, Trash2, Key } from 'lucide-react';

interface KeyValueConfigProps {
  title: string;
  titleIcon: React.ReactNode;
  valueIcon: React.ReactNode;
  configData: Array<{ id?: string; key: string; value: string }>;
  performUpdate: (updates: any) => void;
  colorMode: string;
  addButtonText: string;
  emptyText: string;
  inputType?: 'text' | 'password';
  accentColor: 'teal' | 'indigo';
  valuePlaceholder?: string;
}

export const KeyValueConfig = ({
  title,
  titleIcon,
  valueIcon,
  configData,
  performUpdate,
  colorMode,
  addButtonText,
  emptyText,
  inputType = 'text',
  accentColor,
  valuePlaceholder = 'Value'
}: KeyValueConfigProps) => {
  const addData = () => {
    const newData = [...configData, { id: crypto.randomUUID(), key: '', value: '' }];
    performUpdate({ configData: newData });
  };

  const updateData = (index: number, key: string, value: string) => {
    const newData = [...configData];
    // Ensure ID exists for React keys
    const id = newData[index].id || crypto.randomUUID();
    newData[index] = { id, key, value };
    performUpdate({ configData: newData });
  };

  const removeData = (index: number) => {
    const newData = configData.filter((_, i) => i !== index);
    performUpdate({ configData: newData });
  };

  const colors = {
    teal: {
      btn: "bg-teal-500 hover:bg-teal-600",
      focus: "focus:border-teal-500/50",
      focusLight: "focus:border-teal-400"
    },
    indigo: {
      btn: "bg-indigo-500 hover:bg-indigo-600",
      focus: "focus:border-indigo-500/50",
      focusLight: "focus:border-indigo-400"
    }
  };

  const activeColors = colors[accentColor];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
            {titleIcon} {title}
          </label>
          <button
            onClick={addData}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-white text-[9px] font-bold transition-all",
              activeColors.btn
            )}
          >
            <Plus size={10} /> {addButtonText}
          </button>
        </div>

        <div className="space-y-2">
          {configData.length === 0 && (
            <div className={cn(
              "text-center py-6 rounded-lg border border-dashed",
              colorMode === 'dark' ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"
            )}>
              <div className="opacity-20 flex justify-center mb-1.5">
                {React.cloneElement(titleIcon as React.ReactElement<any>, { size: 20 })}
              </div>
              <p className="text-[9px]">{emptyText}</p>
            </div>
          )}

          {configData.map((item, idx) => (
            <div key={item.id || idx} className={cn(
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
                      colorMode === 'dark' ? `bg-slate-800 border-slate-700 text-slate-200 ${activeColors.focus}` : `bg-slate-50 border-slate-200 text-slate-800 ${activeColors.focusLight}`
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
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500">
                  {valueIcon}
                </div>
                <input
                  type={inputType}
                  placeholder={valuePlaceholder}
                  value={item.value}
                  onChange={(e) => updateData(idx, item.key, e.target.value)}
                  className={cn(
                    "w-full pl-6 pr-2 py-1.5 text-[10px] rounded border outline-none",
                    colorMode === 'dark' ? `bg-slate-800 border-slate-700 text-slate-200 ${activeColors.focus}` : `bg-slate-50 border-slate-200 text-slate-800 ${activeColors.focusLight}`
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
