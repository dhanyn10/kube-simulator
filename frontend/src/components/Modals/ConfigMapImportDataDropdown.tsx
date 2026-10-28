import React from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { K8sConfigMapItem } from '@/types';

export interface ConfigMapImportDataDropdownProps {
  readonly isOpen: boolean;
  readonly onToggleOpen: () => void;
  readonly existingConfigMaps: readonly K8sConfigMapItem[];
  readonly onImport: (cm: K8sConfigMapItem) => void;
  readonly isDark: boolean;
  readonly dropdownRef: React.RefObject<HTMLDivElement | null>;
}

export const ConfigMapImportDataDropdown: React.FC<ConfigMapImportDataDropdownProps> = ({
  isOpen,
  onToggleOpen,
  existingConfigMaps,
  onImport,
  isDark,
  dropdownRef,
}) => {
  if (existingConfigMaps.length === 0) return null;

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        data-testid="btn-add-from-existing-cm"
        onClick={onToggleOpen}
        className={cn(
          "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer font-medium",
          isDark
            ? "bg-slate-900 border-slate-700 text-teal-400 hover:bg-slate-800"
            : "bg-white border-slate-300 text-teal-600 hover:bg-slate-50"
        )}
        title="Add key-value pairs from an existing ConfigMap"
      >
        <Layers size={13} />
        <span>Add from Existing</span>
      </button>

      {isOpen && (
        <div
          data-testid="import-existing-cm-menu"
          className={cn(
            "absolute right-0 mt-1.5 w-64 rounded-lg shadow-2xl border p-1 z-30 text-xs animate-in fade-in-50 zoom-in-95 duration-100 max-h-52 overflow-y-auto custom-scrollbar",
            isDark
              ? "bg-slate-900 border-slate-700 text-slate-200 divide-y divide-slate-800"
              : "bg-white border-slate-200 text-slate-800 divide-slate-100"
          )}
        >
          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Select ConfigMap to Add Data
          </div>
          <div className="py-0.5">
            {existingConfigMaps.map((cm) => (
              <button
                key={`import-cm-item-${cm.id}`}
                type="button"
                data-testid={`import-option-${cm.name}`}
                onClick={() => onImport(cm)}
                className={cn(
                  "w-full px-2.5 py-1.5 flex items-center justify-between text-left rounded transition-colors cursor-pointer",
                  isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
                )}
              >
                <div className="overflow-hidden pr-2">
                  <div className="font-semibold text-xs text-teal-400 truncate">{cm.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {cm.configData.length} key-value pair{cm.configData.length > 1 ? 's' : ''}
                  </div>
                </div>
                <span className="text-[9px] font-mono text-slate-500 shrink-0">
                  +{cm.configData.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
