import React from 'react';
import { cn } from '../../lib/utils';
import { Plus, Trash2 } from 'lucide-react';

export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
}

interface KeyValueFormSectionProps {
  items: KeyValueItem[];
  colorMode: string;
  accentColor: 'indigo' | 'teal';
  onAddField: () => void;
  onRemoveField: (id: string) => void;
  onUpdateField: (id: string, field: 'key' | 'value', value: string) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  valueInputType?: 'text' | 'password';
  sectionTitle?: string;
}

export const KeyValueFormSection: React.FC<KeyValueFormSectionProps> = ({
  items,
  colorMode,
  accentColor,
  onAddField,
  onRemoveField,
  onUpdateField,
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'Value',
  valueInputType = 'text',
  sectionTitle = 'Data (Key - Value Pairs)',
}) => {
  const isIndigo = accentColor === 'indigo';
  const textColor = isIndigo ? 'text-indigo-400 hover:text-indigo-300' : 'text-teal-400 hover:text-teal-300';
  const ringColor = isIndigo ? 'focus:ring-indigo-500' : 'focus:ring-teal-500';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400">{sectionTitle}</span>
        <button
          type="button"
          onClick={onAddField}
          className={cn("flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer", textColor)}
        >
          <Plus size={13} /> Add Key-Value
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg border",
              colorMode === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
            )}
          >
            <input
              type="text"
              value={item.key}
              onChange={(e) => onUpdateField(item.id, 'key', e.target.value)}
              placeholder={keyPlaceholder}
              className={cn(
                "flex-1 px-2.5 py-1.5 rounded-md border text-xs font-mono outline-none focus:ring-1",
                ringColor,
                colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
              )}
            />
            <span className="text-slate-500 font-mono text-xs">=</span>
            <input
              type={valueInputType}
              value={item.value}
              onChange={(e) => onUpdateField(item.id, 'value', e.target.value)}
              placeholder={valuePlaceholder}
              className={cn(
                "flex-1 px-2.5 py-1.5 rounded-md border text-xs font-mono outline-none focus:ring-1",
                ringColor,
                colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
              )}
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveField(item.id)}
                className="p-1.5 text-red-400 hover:text-red-300 rounded transition-colors cursor-pointer"
                title="Remove Pair"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
