import React, { useState, useEffect, useMemo } from 'react';
import { Search, Settings, Info, Plus, GripVertical, Edit2, Trash2, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import { checkIsKeyOverridden, reorderItems } from './configMapPrecedenceHelpers';
import { useFlowStore } from '@/store/useFlowStore';
import { saveConfigMapsToLocal } from '@/activities/modals/configMapStorageHelpers';
import { K8sConfigMapItem } from '@/types';

export interface ConfigMapPrecedenceViewProps {
  readonly profileName: string;
  readonly items: readonly OverviewItem[];
  readonly isDark: boolean;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
  readonly onAddNewConfigMap?: () => void;
}

interface ComponentGroup {
  readonly componentId: string;
  readonly componentLabel: string;
  readonly componentType: string;
  readonly isCluster: boolean;
  readonly items: OverviewItem[];
}

const PrecedenceTableHeader: React.FC<{ readonly isDark: boolean }> = ({ isDark }) => (
  <thead
    className={cn(
      "text-[10px] uppercase font-bold tracking-wider select-none border-b",
      isDark ? "bg-slate-900/90 text-slate-400 border-slate-800" : "bg-slate-100 text-slate-600 border-slate-200"
    )}
  >
    <tr>
      <th className="py-2 px-3 font-mono">ID</th>
      <th className="py-2 px-3 font-mono">Key</th>
      <th className="py-2 px-3 font-mono">Value</th>
      <th className="py-2 px-3 text-right">Actions</th>
    </tr>
  </thead>
);

interface ComponentRowGroupProps {
  readonly item: OverviewItem;
  readonly cmIndex: number;
  readonly totalCms: number;
  readonly groupItems: readonly OverviewItem[];
  readonly profileName: string;
  readonly isDark: boolean;
  readonly isDragging: boolean;
  readonly isDragOver: boolean;
  readonly onDragStart: (e: React.DragEvent, index: number) => void;
  readonly onDragOver: (e: React.DragEvent, index: number) => void;
  readonly onDrop: (e: React.DragEvent, index: number) => void;
  readonly onDragEnd: () => void;
  readonly onMoveItem: (from: number, to: number) => void;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
}

const ComponentRowGroup: React.FC<ComponentRowGroupProps> = ({
  item,
  cmIndex,
  totalCms,
  groupItems,
  profileName,
  isDark,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveItem,
  onEditItem,
  onDeleteItem,
}) => {
  const configData: Array<{ key: string; value: string }> = Array.isArray(item.rawItem?.configData)
    ? item.rawItem.configData
    : [];

  const dragHandleButton = (
    <button
      type="button"
      draggable
      onDragStart={(e) => onDragStart(e, cmIndex)}
      onDragEnd={onDragEnd}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' && cmIndex > 0) {
          e.preventDefault();
          onMoveItem(cmIndex, cmIndex - 1);
        } else if (e.key === 'ArrowDown' && cmIndex < totalCms - 1) {
          e.preventDefault();
          onMoveItem(cmIndex, cmIndex + 1);
        }
      }}
      data-testid={`cm-drag-handle-${item.id}`}
      aria-label={`Drag to reorder ${item.id}`}
      title="Drag to reorder ConfigMap (or use Up/Down arrow keys)"
      className={cn(
        "p-1 rounded cursor-grab active:cursor-grabbing transition-all shrink-0",
        "text-slate-400 hover:text-teal-400 hover:bg-teal-500/15",
        "opacity-60 group-hover:opacity-100 focus:opacity-100"
      )}
    >
      <GripVertical size={14} />
    </button>
  );

  const actionButtons = (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        title={`Edit ConfigMap ${item.name || item.id}`}
        onClick={() => onEditItem(item)}
        className="p-1.5 rounded hover:bg-teal-500/10 text-slate-400 hover:text-teal-400 transition-colors cursor-pointer"
      >
        <Edit2 size={13} />
      </button>
      <button
        type="button"
        title={`Delete ConfigMap ${item.name || item.id}`}
        onClick={() => onDeleteItem(item)}
        className="p-1.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );

  if (configData.length === 0) {
    return (
      <tr
        key={`precedence-empty-${item.id}`}
        onDragOver={(e) => onDragOver(e, cmIndex)}
        onDrop={(e) => onDrop(e, cmIndex)}
        className={cn(
          "border-b transition-colors group",
          isDark ? "border-slate-800/80 hover:bg-slate-800/30" : "border-slate-200 hover:bg-slate-50",
          isDragging && "opacity-40",
          isDragOver && "border-t-2 border-teal-500 bg-teal-500/10"
        )}
      >
        <td className="py-2.5 px-3 font-mono text-[11px]">
          <div className="flex items-center gap-1.5">
            {dragHandleButton}
            <span data-testid={`cm-id-${item.id}`} className="text-teal-400 font-semibold truncate block max-w-[150px]">
              {item.id}
            </span>
          </div>
        </td>
        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 italic">(none)</td>
        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 italic">-</td>
        <td className="py-2.5 px-3 text-right">{actionButtons}</td>
      </tr>
    );
  }

  return (
    <>
      {configData.map((kv, kvIdx) => {
        const { isOverridden, overriddenByCmName } = checkIsKeyOverridden(
          kv.key,
          cmIndex,
          groupItems,
          profileName
        );
        const isLastRowOfCm = kvIdx === configData.length - 1;

        return (
          <tr
            key={`precedence-row-${item.id}-${kv.key}-${kvIdx}`}
            onDragOver={(e) => onDragOver(e, cmIndex)}
            onDrop={(e) => onDrop(e, cmIndex)}
            className={cn(
              "text-xs transition-colors group",
              isLastRowOfCm ? "border-b border-slate-700/60" : "border-b border-slate-800/30",
              isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50",
              isDragging && "opacity-40",
              isDragOver && "border-t-2 border-teal-500 bg-teal-500/10"
            )}
          >
            <td className="py-2 px-3 font-mono text-[11px]">
              {kvIdx === 0 ? (
                <div className="flex items-center gap-1.5">
                  {dragHandleButton}
                  <span data-testid={`cm-id-${item.id}`} className="text-teal-400 font-semibold truncate block max-w-[150px]">
                    {item.id}
                  </span>
                </div>
              ) : (
                <span className="text-slate-600 text-[10px] pl-6 block">↳</span>
              )}
            </td>
            <td className="py-2 px-3 font-mono">
              {isOverridden ? (
                <span
                  data-testid={`cm-key-${kv.key}-overridden`}
                  className="line-through decoration-rose-500/80 decoration-2 text-slate-400 font-semibold cursor-help"
                  title={`overridden by ${overriddenByCmName || 'lower ConfigMap'}`}
                >
                  {kv.key}
                  <span className="sr-only"> (overridden by {overriddenByCmName})</span>
                </span>
              ) : (
                <span
                  data-testid={`cm-key-${kv.key}-active`}
                  className="text-teal-400 font-semibold"
                >
                  {kv.key}
                </span>
              )}
            </td>
            <td className="py-2 px-3 font-mono">
              {isOverridden ? (
                <span
                  data-testid={`cm-val-${kv.key}-overridden`}
                  className="line-through decoration-rose-500/80 decoration-2 text-slate-400 cursor-help"
                  title={`overridden by ${overriddenByCmName || 'lower ConfigMap'}`}
                >
                  {kv.value}
                </span>
              ) : (
                <span
                  data-testid={`cm-val-${kv.key}-active`}
                  className="text-slate-200"
                >
                  {kv.value}
                </span>
              )}
            </td>
            <td className="py-2 px-3 text-right">
              {kvIdx === 0 ? actionButtons : null}
            </td>
          </tr>
        );
      })}
    </>
  );
};

interface ComponentGroupCardProps {
  readonly group: ComponentGroup;
  readonly profileName: string;
  readonly isDark: boolean;
  readonly draggedIndex: number | null;
  readonly dragOverIndex: number | null;
  readonly activeDragCompId: string | null;
  readonly onDragStart: (e: React.DragEvent, compId: string, index: number) => void;
  readonly onDragOver: (e: React.DragEvent, compId: string, index: number) => void;
  readonly onDrop: (e: React.DragEvent, compId: string, index: number) => void;
  readonly onDragEnd: () => void;
  readonly onMoveItem: (compId: string, from: number, to: number) => void;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
}

const ComponentGroupCard: React.FC<ComponentGroupCardProps> = ({
  group,
  profileName,
  isDark,
  draggedIndex,
  dragOverIndex,
  activeDragCompId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveItem,
  onEditItem,
  onDeleteItem,
}) => (
  <div
    key={`comp-card-${group.componentId}-${group.componentLabel}`}
    className={cn(
      "rounded-xl border overflow-hidden transition-all shadow-sm",
      isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"
    )}
  >
    {/* Component Title Header */}
    <div
      className={cn(
        "px-3.5 py-2.5 border-b flex items-center justify-between gap-2.5",
        isDark ? "bg-slate-900 border-slate-800/80" : "bg-slate-50/80 border-slate-200"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Box size={14} className={group.isCluster ? "text-emerald-400 shrink-0" : "text-teal-400 shrink-0"} />
        <h3
          data-testid={`component-title-${group.componentId}`}
          className="font-bold text-xs text-slate-200 truncate"
        >
          {group.componentLabel}
        </h3>
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border",
            group.isCluster
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-teal-500/10 text-teal-400 border-teal-500/20"
          )}
        >
          {group.componentType}
        </span>
      </div>
      <span className="text-[10px] text-slate-500 font-medium shrink-0">
        {group.items.length} ConfigMap{group.items.length > 1 ? 's' : ''}
      </span>
    </div>

    {/* Dedicated Component ConfigMap Table */}
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <PrecedenceTableHeader isDark={isDark} />
        <tbody className="divide-y divide-slate-800/40">
          {group.items.map((item, index) => (
            <ComponentRowGroup
              key={`comp-row-${group.componentId}-${item.id}-${index}`}
              item={item}
              cmIndex={index}
              totalCms={group.items.length}
              groupItems={group.items}
              profileName={profileName}
              isDark={isDark}
              isDragging={activeDragCompId === group.componentId && draggedIndex === index}
              isDragOver={activeDragCompId === group.componentId && dragOverIndex === index}
              onDragStart={(e) => onDragStart(e, group.componentId, index)}
              onDragOver={(e) => onDragOver(e, group.componentId, index)}
              onDrop={(e) => onDrop(e, group.componentId, index)}
              onDragEnd={onDragEnd}
              onMoveItem={(from, to) => onMoveItem(group.componentId, from, to)}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
            />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const ConfigMapPrecedenceView: React.FC<ConfigMapPrecedenceViewProps> = ({
  profileName,
  items,
  isDark,
  onEditItem,
  onDeleteItem,
  onAddNewConfigMap,
}) => {
  const [orderedItems, setOrderedItems] = useState<OverviewItem[]>(() => [...items]);
  const [search, setSearch] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeDragCompId, setActiveDragCompId] = useState<string | null>(null);

  const nodes = useFlowStore((state) => state.nodes);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const savedConfigMaps = useFlowStore((state) => state.savedConfigMaps);
  const setSavedConfigMaps = useFlowStore((state) => state.setSavedConfigMaps);
  const addLog = useFlowStore((state) => state.addLog);

  useEffect(() => {
    setOrderedItems((prev) => {
      const prevIds = prev.map((x) => x.id).join(',');
      const currentIds = items.map((x) => x.id).join(',');
      if (prevIds !== currentIds || prev.length !== items.length) {
        return [...items];
      }
      const itemMap = new Map(items.map((it) => [it.id, it]));
      return prev.map((it) => itemMap.get(it.id) || it);
    });
  }, [items]);

  // Group items by component
  const componentGroups = useMemo<ComponentGroup[]>(() => {
    const map = new Map<string, ComponentGroup>();
    orderedItems.forEach((item) => {
      const compId = item.ownerNode.id || 'cluster-storage';
      const compLabel = item.ownerNode.id === 'cluster-storage' ? 'Cluster Storage' : item.ownerNode.label;
      const compType = item.ownerNode.type || (item.ownerNode.id === 'cluster-storage' ? 'Cluster' : 'Node');
      const isCluster = item.ownerNode.id === 'cluster-storage';
      const key = `${compId}::${compLabel}`;

      if (!map.has(key)) {
        map.set(key, {
          componentId: compId,
          componentLabel: compLabel,
          componentType: compType,
          isCluster,
          items: [],
        });
      }
      map.get(key)!.items.push(item);
    });
    return Array.from(map.values());
  }, [orderedItems]);

  const filteredGroups = useMemo<ComponentGroup[]>(() => {
    if (!search.trim()) return componentGroups;
    const q = search.toLowerCase();
    return componentGroups
      .map((grp) => ({
        ...grp,
        items: grp.items.filter((item) => {
          const idMatch = item.id.toLowerCase().includes(q);
          const nameMatch = item.name.toLowerCase().includes(q);
          const compMatch = grp.componentLabel.toLowerCase().includes(q);
          const dataMatch = Array.isArray(item.rawItem?.configData) && item.rawItem.configData.some(
            (kv: { key?: string; value?: string }) =>
              kv?.key?.toLowerCase().includes(q) || kv?.value?.toLowerCase().includes(q)
          );
          return idMatch || nameMatch || compMatch || dataMatch;
        }),
      }))
      .filter((grp) => grp.items.length > 0);
  }, [componentGroups, search]);

  const handleMoveInComponent = (compId: string, fromIndex: number, toIndex: number) => {
    const targetGroup = componentGroups.find((g) => g.componentId === compId);
    if (!targetGroup) return;

    const nextGroupItems = reorderItems(targetGroup.items, fromIndex, toIndex);
    let nextGroupIdx = 0;
    const updatedOrdered = orderedItems.map((item) => {
      const isThisComp = item.ownerNode.id === compId || (compId === 'cluster-storage' && item.ownerNode.id === 'cluster-storage');
      if (isThisComp && nextGroupIdx < nextGroupItems.length) {
        const replacement = nextGroupItems[nextGroupIdx];
        nextGroupIdx += 1;
        return replacement;
      }
      return item;
    });
    setOrderedItems(updatedOrdered);

    // Sync node data or savedConfigMaps
    const targetNode = nodes.find((n) => n.id === compId);
    if (targetNode) {
      const rawCms: K8sConfigMapItem[] = nextGroupItems.map((it) => it.rawItem);
      updateNodeData(targetNode.id, { configMaps: rawCms });
    } else if (compId === 'cluster-storage') {
      const rawSaved: K8sConfigMapItem[] = nextGroupItems.map((it) => it.rawItem);
      setSavedConfigMaps(rawSaved);
      void saveConfigMapsToLocal(rawSaved);
    }

    addLog?.(
      'info',
      `[ConfigMap Precedence] Reordered ConfigMaps for component "${targetGroup.componentLabel}"`,
      'UI'
    );
  };

  const handleDragStart = (e: React.DragEvent, compId: string, index: number) => {
    setActiveDragCompId(compId);
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ compId, index }));
  };

  const handleDragOver = (e: React.DragEvent, compId: string, index: number) => {
    if (activeDragCompId !== compId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, compId: string, targetIndex: number) => {
    e.preventDefault();
    try {
      const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (payload?.compId === compId && typeof payload?.index === 'number' && payload.index !== targetIndex) {
        handleMoveInComponent(compId, payload.index, targetIndex);
      }
    } catch {
      if (activeDragCompId === compId && draggedIndex !== null && draggedIndex !== targetIndex) {
        handleMoveInComponent(compId, draggedIndex, targetIndex);
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    setActiveDragCompId(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setActiveDragCompId(null);
  };

  return (
    <div className="space-y-3" data-testid="configmap-precedence-view">
      {/* Profile & Order Precedence Info Banner */}
      <div
        className={cn(
          "px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs",
          isDark
            ? "bg-slate-900/80 border-slate-800 text-slate-300"
            : "bg-teal-50/60 border-teal-200/80 text-teal-900"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Info size={15} className="text-teal-400 shrink-0" />
          <div className="truncate">
            <span className="font-semibold">Profile: </span>
            <span
              data-testid="precedence-profile-badge"
              className="font-mono px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold"
            >
              {profileName}
            </span>
            <span className="ml-2 text-[11px] opacity-75 hidden sm:inline">
              Evaluated top-to-bottom per component. Upper variables are overridden by matching keys below.
            </span>
          </div>
        </div>

        {onAddNewConfigMap && (
          <button
            type="button"
            onClick={onAddNewConfigMap}
            data-testid="precedence-add-cm-btn"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-all cursor-pointer shrink-0 shadow-sm"
          >
            <Plus size={13} />
            <span>Add ConfigMap</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      {orderedItems.length > 2 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter ConfigMaps by ID, key, or value..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-colors",
              isDark
                ? "bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-teal-500"
                : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-teal-500"
            )}
          />
        </div>
      )}

      {/* Component-Separated Precedence Tables List */}
      <div className="space-y-4 max-h-[54vh] overflow-y-auto custom-scrollbar pr-1">
        {filteredGroups.length === 0 ? (
          <div
            className={cn(
              "text-center py-12 px-4 rounded-xl border",
              isDark ? "border-slate-800 bg-slate-900/30" : "border-slate-200 bg-slate-50/50"
            )}
          >
            <Settings size={36} className="mx-auto mb-2.5 opacity-25 text-teal-400" />
            <p className="text-xs font-medium text-slate-400">
              {search.trim()
                ? "No ConfigMaps match your filter."
                : `No ConfigMaps found in profile "${profileName}". Click "+ Add ConfigMap" to create one.`}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <ComponentGroupCard
              key={`comp-card-${group.componentId}-${group.componentLabel}`}
              group={group}
              profileName={profileName}
              isDark={isDark}
              draggedIndex={draggedIndex}
              dragOverIndex={dragOverIndex}
              activeDragCompId={activeDragCompId}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onMoveItem={handleMoveInComponent}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
            />
          ))
        )}
      </div>
    </div>
  );
};
