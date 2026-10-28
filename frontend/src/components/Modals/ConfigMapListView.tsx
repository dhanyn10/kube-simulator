import React, { useState, useEffect, useRef } from 'react';
import { Search, Edit2, Trash2, Settings, SlidersHorizontal, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import { getCurrentSessionAutosaveKey } from '@/store/useFlowStore';

export interface ColumnVisibility {
  profile: boolean;
  component: boolean;
}

export interface ConfigMapListViewProps {
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly items: readonly OverviewItem[];
  readonly isDark: boolean;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
}

const STORAGE_COLUMN_KEY = 'k8s_configmap_table_columns';

export const getInitialColumnVisibility = (): ColumnVisibility => {
  if (globalThis.localStorage !== undefined) {
    const saved = globalThis.localStorage.getItem(STORAGE_COLUMN_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.profile === 'boolean' && typeof parsed?.component === 'boolean') {
          return parsed;
        }
      } catch {
        // Fallback to default
      }
    }
  }
  return { profile: true, component: true };
};

interface ColumnDropdownProps {
  readonly isOpen: boolean;
  readonly onToggleOpen: () => void;
  readonly columns: ColumnVisibility;
  readonly onToggleColumn: (key: keyof ColumnVisibility) => void;
  readonly isDark: boolean;
  readonly dropdownRef: React.RefObject<HTMLDivElement | null>;
}

const ColumnDropdown: React.FC<ColumnDropdownProps> = ({
  isOpen,
  onToggleOpen,
  columns,
  onToggleColumn,
  isDark,
  dropdownRef,
}) => (
  <div className="relative shrink-0" ref={dropdownRef}>
    <button
      type="button"
      data-testid="column-visibility-toggle-btn"
      onClick={onToggleOpen}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border font-medium transition-colors cursor-pointer",
        isDark
          ? "border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200"
          : "border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
      )}
      title="Toggle Column Visibility"
      aria-label="Toggle Column Visibility"
    >
      <SlidersHorizontal size={13} className="text-teal-400" />
      <span>Columns</span>
    </button>

    {isOpen && (
      <div
        data-testid="column-visibility-menu"
        className={cn(
          "absolute right-0 mt-1.5 w-40 rounded-lg shadow-xl border p-1 z-30 text-xs animate-in fade-in-50 zoom-in-95 duration-100",
          isDark
            ? "bg-slate-900 border-slate-700 text-slate-200 divide-slate-800"
            : "bg-white border-slate-200 text-slate-800 divide-slate-100"
        )}
      >
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={columns.profile}
          data-testid="column-toggle-profile"
          onClick={() => onToggleColumn('profile')}
          className={cn(
            "w-full px-2.5 py-1.5 flex items-center justify-between text-xs rounded transition-colors text-left cursor-pointer",
            isDark
              ? "hover:bg-slate-800 text-slate-200"
              : "hover:bg-slate-100 text-slate-700"
          )}
        >
          <span className="font-medium">Profile</span>
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {columns.profile && (
              <Check size={14} className="text-teal-400 stroke-[2.5]" data-testid="check-profile" />
            )}
          </span>
        </button>

        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={columns.component}
          data-testid="column-toggle-component"
          onClick={() => onToggleColumn('component')}
          className={cn(
            "w-full px-2.5 py-1.5 flex items-center justify-between text-xs rounded transition-colors text-left cursor-pointer",
            isDark
              ? "hover:bg-slate-800 text-slate-200"
              : "hover:bg-slate-100 text-slate-700"
          )}
        >
          <span className="font-medium">Component</span>
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {columns.component && (
              <Check size={14} className="text-teal-400 stroke-[2.5]" data-testid="check-component" />
            )}
          </span>
        </button>
      </div>
    )}
  </div>
);

const ConfigMapTableHeader: React.FC<{
  readonly columns: ColumnVisibility;
  readonly isDark: boolean;
}> = ({ columns, isDark }) => (
  <thead
    className={cn(
      "sticky top-0 text-[10px] uppercase font-bold tracking-wider select-none z-10 border-b",
      isDark
        ? "bg-slate-900 text-slate-400 border-slate-800"
        : "bg-slate-100 text-slate-500 border-slate-200"
    )}
  >
    <tr>
      <th className="py-2.5 px-3">ConfigMap Name</th>
      {columns.profile && <th className="py-2.5 px-3">Profile</th>}
      {columns.component && <th className="py-2.5 px-3">Component</th>}
      <th className="py-2.5 px-3 text-right">Actions</th>
    </tr>
  </thead>
);

interface ConfigMapTableRowProps {
  readonly item: OverviewItem;
  readonly columns: ColumnVisibility;
  readonly isDark: boolean;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
}

const ConfigMapTableRow: React.FC<ConfigMapTableRowProps> = ({
  item,
  columns,
  isDark,
  onEditItem,
  onDeleteItem,
}) => {
  const isCluster = item.ownerNode.id === 'cluster-storage';
  const profileText =
    item.profileName && item.profileName !== 'Default Profile'
      ? item.profileName
      : getCurrentSessionAutosaveKey();

  return (
    <tr
      key={`cm-table-row-${item.ownerNode.id}-${item.id}`}
      className={cn(
        "border-b transition-colors",
        isDark
          ? "border-slate-800/80 hover:bg-slate-800/30"
          : "border-slate-100 hover:bg-slate-50"
      )}
    >
      <td className="py-2.5 px-3">
        <span className="font-semibold text-xs text-slate-200 truncate block max-w-[200px]">
          {item.name}
        </span>
      </td>

      {columns.profile && (
        <td className="py-2.5 px-3">
          <span
            data-testid={`cm-profile-${item.id}`}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium truncate max-w-[180px]",
              isDark
                ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                : "bg-indigo-50 text-indigo-700 border-indigo-200"
            )}
            title={`Canvas Document: ${profileText}`}
          >
            <span className="text-slate-400 font-normal">Profile:</span>
            <span className="font-semibold truncate">{profileText}</span>
          </span>
        </td>
      )}

      {columns.component && (
        <td className="py-2.5 px-3">
          <span
            data-testid={`cm-resource-${item.id}`}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium truncate max-w-[200px]",
              isCluster
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-teal-500/10 text-teal-400 border-teal-500/30"
            )}
            title={isCluster ? 'Cluster Storage' : `${item.ownerNode.type}: ${item.ownerNode.label}`}
          >
            {isCluster ? (
              <span>Cluster Storage</span>
            ) : (
              <>
                <span className="text-slate-400 font-normal">{item.ownerNode.type}:</span>
                <span className="font-semibold truncate">{item.ownerNode.label}</span>
              </>
            )}
          </span>
        </td>
      )}

      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center justify-end gap-1">
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
      </td>
    </tr>
  );
};

export const ConfigMapListView: React.FC<ConfigMapListViewProps> = ({
  search,
  onSearchChange,
  items,
  isDark,
  onEditItem,
  onDeleteItem,
}) => {
  const [columns, setColumns] = useState<ColumnVisibility>(getInitialColumnVisibility);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleColumn = (key: keyof ColumnVisibility) => {
    setColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (globalThis.localStorage !== undefined) {
        globalThis.localStorage.setItem(STORAGE_COLUMN_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
    };
    if (isColumnDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isColumnDropdownOpen]);

  const colSpanCount = 2 + (columns.profile ? 1 : 0) + (columns.component ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search ConfigMap by name, profile, or resource..."
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

        <ColumnDropdown
          isOpen={isColumnDropdownOpen}
          onToggleOpen={() => setIsColumnDropdownOpen((prev) => !prev)}
          columns={columns}
          onToggleColumn={toggleColumn}
          isDark={isDark}
          dropdownRef={dropdownRef}
        />
      </div>

      <div
        className={cn(
          "rounded-lg border overflow-hidden max-h-[50vh] overflow-y-auto custom-scrollbar",
          isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white"
        )}
      >
        <table className="w-full text-left border-collapse text-xs">
          <ConfigMapTableHeader columns={columns} isDark={isDark} />
          <tbody className="divide-y divide-slate-800/40">
            {items.length === 0 ? (
              <tr>
                <td colSpan={colSpanCount} className="text-center py-10 px-4">
                  <Settings size={32} className="mx-auto mb-2 opacity-30 text-teal-400" />
                  <p className="text-xs text-slate-400 font-medium">
                    No ConfigMaps available. Click "+ Add ConfigMap" below to create one.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <ConfigMapTableRow
                  key={`cm-row-${item.ownerNode.id}-${item.id}`}
                  item={item}
                  columns={columns}
                  isDark={isDark}
                  onEditItem={onEditItem}
                  onDeleteItem={onDeleteItem}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
