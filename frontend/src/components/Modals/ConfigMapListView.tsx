import React from 'react';
import { Search, Edit2, Trash2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';

export interface ConfigMapListViewProps {
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly items: readonly OverviewItem[];
  readonly isDark: boolean;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
}

export const ConfigMapListView: React.FC<ConfigMapListViewProps> = ({
  search,
  onSearchChange,
  items,
  isDark,
  onEditItem,
  onDeleteItem,
}) => {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          placeholder="Search ConfigMap by name or target resource..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-colors",
            isDark
              ? "bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-teal-500"
              : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-teal-500"
          )}
        />
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 px-4">
          <Settings size={36} className="mx-auto mb-2 opacity-30 text-teal-400" />
          <p className="text-xs text-slate-400 font-medium">
            No ConfigMaps available. Click "+ Add ConfigMap" below to create one.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1 custom-scrollbar">
          {items.map((item) => {
            const isCluster = item.ownerNode.id === 'cluster-storage';

            return (
              <div
                key={`cm-list-item-${item.ownerNode.id}-${item.id}`}
                className={cn(
                  "p-3 rounded-lg border transition-all flex items-center justify-between gap-3",
                  isDark
                    ? "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                )}
              >
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-semibold text-xs text-slate-200 truncate">
                    {item.name}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded border font-medium truncate max-w-[260px]",
                      isCluster
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-teal-500/10 text-teal-400 border-teal-500/30"
                    )}
                  >
                    {isCluster ? 'Cluster Storage' : item.ownerNode.label}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title={`Edit ConfigMap ${item.name}`}
                    onClick={() => onEditItem(item)}
                    className="p-1.5 rounded hover:bg-teal-500/10 text-slate-400 hover:text-teal-400 transition-colors cursor-pointer"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    title={`Delete ConfigMap ${item.name}`}
                    onClick={() => onDeleteItem(item)}
                    className="p-1.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
