import React, { useState, useRef } from 'react';
import { Search, Edit2, Trash2, SlidersHorizontal, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import { getCurrentSessionAutosaveKey } from '@/store/useFlowStore';
import { useOutsideMouseDown } from '@/hooks/useOutsideMouseDown';

export interface ResourceColumnVisibility {
  profile: boolean;
  component: boolean;
}

export const getInitialResourceColumnVisibility = (
  storageKey: string
): ResourceColumnVisibility => {
  if (globalThis.localStorage !== undefined) {
    const saved = globalThis.localStorage.getItem(storageKey);
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

interface ResourceColumnDropdownProps {
  readonly isOpen: boolean;
  readonly onToggleOpen: () => void;
  readonly columns: ResourceColumnVisibility;
  readonly onToggleColumn: (key: keyof ResourceColumnVisibility) => void;
  readonly isDark: boolean;
  readonly dropdownRef: React.RefObject<HTMLDivElement | null>;
  readonly prefix: string;
  readonly accentColor: 'teal' | 'rose';
}

const ResourceColumnDropdown: React.FC<ResourceColumnDropdownProps> = ({
  isOpen,
  onToggleOpen,
  columns,
  onToggleColumn,
  isDark,
  dropdownRef,
  prefix,
  accentColor,
}) => (
  <div className="relative shrink-0" ref={dropdownRef}>
    <button
      type="button"
      data-testid={`${prefix}column-visibility-toggle-btn`}
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
      <SlidersHorizontal
        size={13}
        className={accentColor === 'rose' ? "text-rose-400" : "text-teal-400"}
      />
      <span>Columns</span>
    </button>

    {isOpen && (
      <div
        data-testid={`${prefix}column-visibility-menu`}
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
          data-testid={`${prefix}column-toggle-profile`}
          onClick={() => onToggleColumn('profile')}
          className={cn(
            "w-full px-2.5 py-1.5 flex items-center justify-between text-xs rounded transition-colors text-left cursor-pointer",
            isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
          )}
        >
          <span className="font-medium">Profile</span>
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {columns.profile && (
              <Check
                size={14}
                className={cn("stroke-[2.5]", accentColor === 'rose' ? "text-rose-400" : "text-teal-400")}
                data-testid={`${prefix}check-profile`}
              />
            )}
          </span>
        </button>

        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={columns.component}
          data-testid={`${prefix}column-toggle-component`}
          onClick={() => onToggleColumn('component')}
          className={cn(
            "w-full px-2.5 py-1.5 flex items-center justify-between text-xs rounded transition-colors text-left cursor-pointer",
            isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
          )}
        >
          <span className="font-medium">Component</span>
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {columns.component && (
              <Check
                size={14}
                className={cn("stroke-[2.5]", accentColor === 'rose' ? "text-rose-400" : "text-teal-400")}
                data-testid={`${prefix}check-component`}
              />
            )}
          </span>
        </button>
      </div>
    )}
  </div>
);

const ResourceTableHeader: React.FC<{
  readonly resourceType: 'ConfigMap' | 'Secret';
  readonly columns: ResourceColumnVisibility;
  readonly isDark: boolean;
}> = ({ resourceType, columns, isDark }) => (
  <thead
    className={cn(
      "sticky top-0 text-[10px] uppercase font-bold tracking-wider select-none z-10 border-b",
      isDark
        ? "bg-slate-900 text-slate-400 border-slate-800"
        : "bg-slate-100 text-slate-500 border-slate-200"
    )}
  >
    <tr>
      <th className="py-2.5 px-3">{resourceType} Name</th>
      {columns.profile && <th className="py-2.5 px-3">Profile</th>}
      {columns.component && <th className="py-2.5 px-3">Component</th>}
      <th className="py-2.5 px-3 text-right">Actions</th>
    </tr>
  </thead>
);

function getProfileBadgeStyle(isRose: boolean, isDark: boolean): string {
  if (isRose) {
    return isDark
      ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
      : "bg-rose-50 text-rose-700 border-rose-200";
  }
  return isDark
    ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
    : "bg-indigo-50 text-indigo-700 border-indigo-200";
}

const ResourceProfileCell: React.FC<{
  readonly item: OverviewItem;
  readonly isDark: boolean;
  readonly profileText: string;
  readonly rowPrefix: string;
  readonly accentColor: 'teal' | 'rose';
  readonly onSelectProfile?: (profileName: string) => void;
}> = ({ item, isDark, profileText, rowPrefix, accentColor, onSelectProfile }) => {
  const isRose = accentColor === 'rose';
  const badgeStyle = getProfileBadgeStyle(isRose, isDark);

  if (onSelectProfile) {
    return (
      <td className="py-2.5 px-3">
        <button
          type="button"
          data-testid={`${rowPrefix}-profile-${item.id}`}
          onClick={() => onSelectProfile(profileText)}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium truncate max-w-[180px] cursor-pointer transition-colors text-left",
            badgeStyle,
            isDark ? "hover:bg-indigo-500/20" : "hover:bg-indigo-100"
          )}
          title={`Canvas Document: ${profileText}`}
        >
          <span className="text-slate-400 font-normal">Profile:</span>
          <span className="font-semibold truncate">{profileText}</span>
        </button>
      </td>
    );
  }

  return (
    <td className="py-2.5 px-3">
      <span
        data-testid={`${rowPrefix}-profile-${item.id}`}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium truncate max-w-[180px]",
          badgeStyle
        )}
        title={`Canvas Document: ${profileText}`}
      >
        <span className="text-slate-400 font-normal">Profile:</span>
        <span className="font-semibold truncate">{profileText}</span>
      </span>
    </td>
  );
};

const ResourceComponentCell: React.FC<{
  readonly item: OverviewItem;
  readonly hasComponent: boolean;
  readonly rowPrefix: string;
  readonly accentColor: 'teal' | 'rose';
}> = ({ item, hasComponent, rowPrefix, accentColor }) => {
  if (!hasComponent) {
    return (
      <td className="py-2.5 px-3">
        <span data-testid={`${rowPrefix}-resource-${item.id}`} className="text-slate-500 text-xs italic">
          -
        </span>
      </td>
    );
  }

  const badgeColor = accentColor === 'rose'
    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
    : "bg-teal-500/10 text-teal-400 border-teal-500/30";

  return (
    <td className="py-2.5 px-3">
      <span
        data-testid={`${rowPrefix}-resource-${item.id}`}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium truncate max-w-[200px]",
          badgeColor
        )}
        title={`${item.ownerNode.type}: ${item.ownerNode.label}`}
      >
        <span className="text-slate-400 font-normal">{item.ownerNode.type}:</span>
        <span className="font-semibold truncate">{item.ownerNode.label}</span>
      </span>
    </td>
  );
};

interface ResourceTableRowProps {
  readonly item: OverviewItem;
  readonly columns: ResourceColumnVisibility;
  readonly isDark: boolean;
  readonly resourceType: 'ConfigMap' | 'Secret';
  readonly rowPrefix: string;
  readonly accentColor: 'teal' | 'rose';
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
  readonly onSelectProfile?: (profileName: string) => void;
}

const ResourceTableRow: React.FC<ResourceTableRowProps> = ({
  item,
  columns,
  isDark,
  resourceType,
  rowPrefix,
  accentColor,
  onEditItem,
  onDeleteItem,
  onSelectProfile,
}) => {
  const hasComponent = Boolean(
    item.ownerNode?.label &&
    item.ownerNode.label !== 'Cluster Storage' &&
    item.ownerNode.label !== 'Cluster (Local Storage)' &&
    item.ownerNode.id !== 'cluster-storage' &&
    item.ownerNode.id !== ''
  );
  const profileText =
    item.profileName && item.profileName !== 'Default Profile'
      ? item.profileName
      : getCurrentSessionAutosaveKey();

  const actionHoverStyle = accentColor === 'rose'
    ? "hover:bg-rose-500/10 text-slate-400 hover:text-rose-400"
    : "hover:bg-teal-500/10 text-slate-400 hover:text-teal-400";

  return (
    <tr
      key={`${rowPrefix}-table-row-${item.ownerNode.id}-${item.id}`}
      className={cn(
        "border-b transition-colors",
        isDark ? "border-slate-800/80 hover:bg-slate-800/30" : "border-slate-100 hover:bg-slate-50"
      )}
    >
      <td className="py-2.5 px-3">
        <span className="font-semibold text-xs text-slate-200 truncate block max-w-[200px]">
          {item.name}
        </span>
      </td>

      {columns.profile && (
        <ResourceProfileCell
          item={item}
          isDark={isDark}
          profileText={profileText}
          rowPrefix={rowPrefix}
          accentColor={accentColor}
          onSelectProfile={onSelectProfile}
        />
      )}

      {columns.component && (
        <ResourceComponentCell
          item={item}
          hasComponent={hasComponent}
          rowPrefix={rowPrefix}
          accentColor={accentColor}
        />
      )}

      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            title={`Edit ${resourceType} ${item.name}`}
            onClick={() => onEditItem(item)}
            className={cn("p-1.5 rounded transition-colors cursor-pointer", actionHoverStyle)}
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            title={`Delete ${resourceType} ${item.name}`}
            onClick={() => onDeleteItem(item)}
            className={cn("p-1.5 rounded transition-colors cursor-pointer", actionHoverStyle)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export interface ResourceListViewProps {
  readonly resourceType: 'ConfigMap' | 'Secret';
  readonly storageKey: string;
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly items: readonly OverviewItem[];
  readonly isDark: boolean;
  readonly emptyIcon: React.ComponentType<{ size?: number; className?: string }>;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
  readonly onSelectProfile?: (profileName: string) => void;
  readonly accentColor?: 'teal' | 'rose';
}

export const ResourceListView: React.FC<ResourceListViewProps> = ({
  resourceType,
  storageKey,
  search,
  onSearchChange,
  items,
  isDark,
  emptyIcon: EmptyIcon,
  onEditItem,
  onDeleteItem,
  onSelectProfile,
  accentColor = 'teal',
}) => {
  const [columns, setColumns] = useState<ResourceColumnVisibility>(() =>
    getInitialResourceColumnVisibility(storageKey)
  );
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const prefix = resourceType === 'Secret' ? 'secret-' : '';
  const rowPrefix = resourceType === 'Secret' ? 'sec' : 'cm';

  const toggleColumn = (key: keyof ResourceColumnVisibility) => {
    setColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (globalThis.localStorage !== undefined) {
        globalThis.localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return next;
    });
  };

  useOutsideMouseDown(dropdownRef, isColumnDropdownOpen, () => {
    setIsColumnDropdownOpen(false);
  });

  const colSpanCount = 2 + (columns.profile ? 1 : 0) + (columns.component ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${resourceType} by name, profile, or resource...`}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-colors",
              isDark
                ? "bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
                : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
              accentColor === 'rose' ? "focus:border-rose-500" : "focus:border-teal-500"
            )}
          />
        </div>

        <ResourceColumnDropdown
          isOpen={isColumnDropdownOpen}
          onToggleOpen={() => setIsColumnDropdownOpen((prev) => !prev)}
          columns={columns}
          onToggleColumn={toggleColumn}
          isDark={isDark}
          dropdownRef={dropdownRef}
          prefix={prefix}
          accentColor={accentColor}
        />
      </div>

      <div
        className={cn(
          "rounded-lg border overflow-hidden max-h-[50vh] overflow-y-auto custom-scrollbar",
          isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white"
        )}
      >
        <table className="w-full text-left border-collapse text-xs">
          <ResourceTableHeader resourceType={resourceType} columns={columns} isDark={isDark} />
          <tbody className="divide-y divide-slate-800/40">
            {items.length === 0 ? (
              <tr>
                <td colSpan={colSpanCount} className="text-center py-10 px-4">
                  <EmptyIcon
                    size={32}
                    className={cn(
                      "mx-auto mb-2 opacity-30",
                      accentColor === 'rose' ? "text-rose-400" : "text-teal-400"
                    )}
                  />
                  <p className="text-xs text-slate-400 font-medium">
                    {`No ${resourceType}s available. Click "+ Add ${resourceType}" below to create one.`}
                  </p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <ResourceTableRow
                  key={`${rowPrefix}-row-${item.ownerNode.id}-${item.id}`}
                  item={item}
                  columns={columns}
                  isDark={isDark}
                  resourceType={resourceType}
                  rowPrefix={rowPrefix}
                  accentColor={accentColor}
                  onEditItem={onEditItem}
                  onDeleteItem={onDeleteItem}
                  onSelectProfile={onSelectProfile}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
