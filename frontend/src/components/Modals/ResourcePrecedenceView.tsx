import React, { useState, useEffect, useMemo } from 'react';
import { Search, Settings, Lock, GripVertical, Edit2, Trash2, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OverviewItem } from '@/activities/modals/attachedResourceOverviewHelpers';
import {
  checkIsKeyOverridden,
  reorderItems,
  syncResourcePrecedenceOrder,
} from './configMapPrecedenceHelpers';
import { useFlowStore } from '@/store/useFlowStore';
import { saveConfigMapsToLocal } from '@/activities/modals/configMapStorageHelpers';
import { saveSecretsToLocal } from '@/activities/modals/secretStorageHelpers';

export interface ResourcePrecedenceViewProps {
  readonly resourceType: 'ConfigMap' | 'Secret';
  readonly profileName: string;
  readonly items: readonly OverviewItem[];
  readonly isDark: boolean;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
  readonly onAddNewItem?: () => void;
  readonly accentColor?: 'teal' | 'rose';
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

interface PrecedenceItemRowProps {
  readonly item: OverviewItem;
  readonly kv: { key: string; value: string };
  readonly kvIdx: number;
  readonly isLastRowOfCm: boolean;
  readonly cmIndex: number;
  readonly isOverridden: boolean;
  readonly overriddenByName?: string;
  readonly isDark: boolean;
  readonly isDragging: boolean;
  readonly isDragOver: boolean;
  readonly prefix: string;
  readonly accentColor: 'teal' | 'rose';
  readonly dragHandleButton: React.ReactNode;
  readonly actionButtons: React.ReactNode;
  readonly onDragOver: (e: React.DragEvent, index: number) => void;
  readonly onDrop: (e: React.DragEvent, index: number) => void;
}

const PrecedenceItemRow: React.FC<PrecedenceItemRowProps> = ({
  item,
  kv,
  kvIdx,
  isLastRowOfCm,
  cmIndex,
  isOverridden,
  overriddenByName,
  isDark,
  isDragging,
  isDragOver,
  prefix,
  accentColor,
  dragHandleButton,
  actionButtons,
  onDragOver,
  onDrop,
}) => {
  const activeColor = accentColor === 'rose' ? "text-rose-400 font-semibold" : "text-teal-400 font-semibold";
  const dragOverBorder = accentColor === 'rose' ? "border-t-2 border-rose-500 bg-rose-500/10" : "border-t-2 border-teal-500 bg-teal-500/10";

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
        isDragOver && dragOverBorder
      )}
    >
      <td className="py-2 px-3 font-mono text-[11px]">
        {kvIdx === 0 ? (
          <div className="flex items-center gap-1.5">
            {dragHandleButton}
            <span
              data-testid={`${prefix}-id-${item.id}`}
              className={cn("font-semibold truncate block max-w-[150px]", accentColor === 'rose' ? "text-rose-400" : "text-teal-400")}
            >
              {item.name || item.id}
            </span>
          </div>
        ) : (
          <span className="text-slate-600 text-[10px] pl-6 block">↳</span>
        )}
      </td>
      <td className="py-2 px-3 font-mono">
        {isOverridden ? (
          <span
            data-testid={`${prefix}-key-${kv.key}-overridden`}
            className="line-through decoration-rose-500/80 decoration-2 text-slate-400 font-semibold cursor-help"
            title={`overridden by ${overriddenByName || 'lower item'}`}
          >
            {kv.key}
            <span className="sr-only"> (overridden by {overriddenByName})</span>
          </span>
        ) : (
          <span data-testid={`${prefix}-key-${kv.key}-active`} className={activeColor}>
            {kv.key}
          </span>
        )}
      </td>
      <td className="py-2 px-3 font-mono">
        {isOverridden ? (
          <span
            data-testid={`${prefix}-val-${kv.key}-overridden`}
            className="line-through decoration-rose-500/80 decoration-2 text-slate-400 cursor-help"
            title={`overridden by ${overriddenByName || 'lower item'}`}
          >
            {kv.value}
          </span>
        ) : (
          <span data-testid={`${prefix}-val-${kv.key}-active`} className="text-slate-200">
            {kv.value}
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-right">
        {kvIdx === 0 ? actionButtons : null}
      </td>
    </tr>
  );
};

interface ComponentRowGroupProps {
  readonly item: OverviewItem;
  readonly cmIndex: number;
  readonly totalCms: number;
  readonly groupItems: readonly OverviewItem[];
  readonly profileName: string;
  readonly isDark: boolean;
  readonly isDragging: boolean;
  readonly isDragOver: boolean;
  readonly prefix: string;
  readonly resourceType: 'ConfigMap' | 'Secret';
  readonly accentColor: 'teal' | 'rose';
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
  prefix,
  resourceType,
  accentColor,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveItem,
  onEditItem,
  onDeleteItem,
}) => {
  const data: Array<{ key: string; value: string }> = Array.isArray(item.rawItem?.secretData)
    ? item.rawItem.secretData
    : Array.isArray(item.rawItem?.configData)
    ? item.rawItem.configData
    : [];

  const dragHover = accentColor === 'rose' ? "hover:text-rose-400 hover:bg-rose-500/15" : "hover:text-teal-400 hover:bg-teal-500/15";
  const dragOverBorder = accentColor === 'rose' ? "border-t-2 border-rose-500 bg-rose-500/10" : "border-t-2 border-teal-500 bg-teal-500/10";
  const editHover = accentColor === 'rose' ? "hover:bg-rose-500/10 hover:text-rose-400" : "hover:bg-teal-500/10 hover:text-teal-400";

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
      data-testid={`${prefix}-drag-handle-${item.id}`}
      aria-label={`Drag to reorder ${item.id}`}
      title={`Drag to reorder ${resourceType} (or use Up/Down arrow keys)`}
      className={cn(
        "p-1 rounded cursor-grab active:cursor-grabbing transition-all shrink-0 text-slate-400 opacity-60 group-hover:opacity-100 focus:opacity-100",
        dragHover
      )}
    >
      <GripVertical size={14} />
    </button>
  );

  const actionButtons = (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        title={`Edit ${resourceType} ${item.name || item.id}`}
        onClick={() => onEditItem(item)}
        className={cn("p-1.5 rounded text-slate-400 transition-colors cursor-pointer", editHover)}
      >
        <Edit2 size={13} />
      </button>
      <button
        type="button"
        title={`Delete ${resourceType} ${item.name || item.id}`}
        onClick={() => onDeleteItem(item)}
        className="p-1.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );

  if (data.length === 0) {
    return (
      <tr
        key={`precedence-empty-${item.id}`}
        onDragOver={(e) => onDragOver(e, cmIndex)}
        onDrop={(e) => onDrop(e, cmIndex)}
        className={cn(
          "border-b transition-colors group",
          isDark ? "border-slate-800/80 hover:bg-slate-800/30" : "border-slate-200 hover:bg-slate-50",
          isDragging && "opacity-40",
          isDragOver && dragOverBorder
        )}
      >
        <td className="py-2.5 px-3 font-mono text-[11px]">
          <div className="flex items-center gap-1.5">
            {dragHandleButton}
            <span
              data-testid={`${prefix}-id-${item.id}`}
              className={cn("font-semibold truncate block max-w-[150px]", accentColor === 'rose' ? "text-rose-400" : "text-teal-400")}
            >
              {item.name || item.id}
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
      {data.map((kv, kvIdx) => {
        const { isOverridden, overriddenByCmName } = checkIsKeyOverridden(
          kv.key,
          cmIndex,
          groupItems,
          profileName
        );
        const isLastRowOfCm = kvIdx === data.length - 1;

        return (
          <PrecedenceItemRow
            key={`precedence-row-${item.id}-${kv.key}-${kvIdx}`}
            item={item}
            kv={kv}
            kvIdx={kvIdx}
            isLastRowOfCm={isLastRowOfCm}
            cmIndex={cmIndex}
            isOverridden={isOverridden}
            overriddenByName={overriddenByCmName}
            isDark={isDark}
            isDragging={isDragging}
            isDragOver={isDragOver}
            prefix={prefix}
            accentColor={accentColor}
            dragHandleButton={dragHandleButton}
            actionButtons={actionButtons}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
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
  readonly prefix: string;
  readonly resourceType: 'ConfigMap' | 'Secret';
  readonly accentColor: 'teal' | 'rose';
  readonly onDragStart: (e: React.DragEvent, compId: string, index: number) => void;
  readonly onDragOver: (e: React.DragEvent, compId: string, index: number) => void;
  readonly onDrop: (e: React.DragEvent, compId: string, index: number) => void;
  readonly onDragEnd: () => void;
  readonly onMoveItem: (compId: string, from: number, to: number) => void;
  readonly onEditItem: (item: OverviewItem) => void;
  readonly onDeleteItem: (item: OverviewItem) => void;
}

function getComponentBoxColor(isCluster: boolean, isRose: boolean): string {
  if (isCluster) {
    return "text-slate-400 shrink-0";
  }
  return isRose ? "text-rose-400 shrink-0" : "text-teal-400 shrink-0";
}

function getComponentBadgeStyle(isCluster: boolean, isRose: boolean): string {
  if (isCluster) {
    return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
  return isRose
    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
    : "bg-teal-500/10 text-teal-400 border-teal-500/20";
}

const ComponentGroupCard: React.FC<ComponentGroupCardProps> = ({
  group,
  profileName,
  isDark,
  draggedIndex,
  dragOverIndex,
  activeDragCompId,
  prefix,
  resourceType,
  accentColor,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveItem,
  onEditItem,
  onDeleteItem,
}) => {
  const isRose = accentColor === 'rose';
  const boxColor = getComponentBoxColor(group.isCluster, isRose);
  const badgeStyle = getComponentBadgeStyle(group.isCluster, isRose);

  return (
    <div
      key={`comp-card-${group.componentId}-${group.componentLabel}`}
      className={cn(
        "rounded-xl border overflow-hidden transition-all shadow-sm",
        isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"
      )}
    >
      <div
        className={cn(
          "px-3.5 py-2.5 border-b flex items-center justify-between gap-2.5",
          isDark ? "bg-slate-900 border-slate-800/80" : "bg-slate-50/80 border-slate-200"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Box size={14} className={boxColor} />
          <h3
            data-testid={`component-title-${group.componentId}`}
            className={cn(
              "text-xs truncate",
              group.isCluster ? "font-normal text-slate-400 italic" : "font-bold text-slate-200"
            )}
          >
            {group.componentLabel}
          </h3>
          {group.componentType ? (
            <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border", badgeStyle)}>
              {group.componentType}
            </span>
          ) : null}
        </div>
        <span className="text-[10px] text-slate-500 font-medium shrink-0">
          {group.items.length} {resourceType}{group.items.length > 1 ? 's' : ''}
        </span>
      </div>

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
                prefix={prefix}
                resourceType={resourceType}
                accentColor={accentColor}
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
};

export const ResourcePrecedenceView: React.FC<ResourcePrecedenceViewProps> = ({
  resourceType,
  profileName,
  items,
  isDark,
  onEditItem,
  onDeleteItem,
  onAddNewItem,
  accentColor,
}) => {
  const isSecret = resourceType === 'Secret';
  const prefix = isSecret ? 'sec' : 'cm';
  const resolvedAccent = accentColor || (isSecret ? 'rose' : 'teal');

  const [orderedItems, setOrderedItems] = useState<OverviewItem[]>(() => [...items]);
  const [search, setSearch] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeDragCompId, setActiveDragCompId] = useState<string | null>(null);

  const nodes = useFlowStore((state) => state.nodes);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const setSavedConfigMaps = useFlowStore((state) => state.setSavedConfigMaps);
  const savedConfigMaps = useFlowStore((state) => state.savedConfigMaps);
  const setSavedSecrets = useFlowStore((state) => state.setSavedSecrets);
  const savedSecrets = useFlowStore((state) => state.savedSecrets);
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

  const componentGroups = useMemo<ComponentGroup[]>(() => {
    const map = new Map<string, ComponentGroup>();
    orderedItems.forEach((item) => {
      const isUnattached =
        !item.ownerNode?.id ||
        item.ownerNode.id === 'cluster-storage' ||
        item.ownerNode.id === 'unattached' ||
        !item.ownerNode?.label ||
        item.ownerNode.label === 'Cluster Storage' ||
        item.ownerNode.label === 'Cluster (Local Storage)';

      const compId = isUnattached ? 'unattached' : item.ownerNode.id;
      const compLabel = isUnattached ? '(No Component)' : item.ownerNode.label;
      const compType = isUnattached ? '' : (item.ownerNode.type || 'Node');
      const isCluster = isUnattached;
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
          const itemData = Array.isArray(item.rawItem?.secretData)
            ? item.rawItem.secretData
            : Array.isArray(item.rawItem?.configData)
            ? item.rawItem.configData
            : [];
          const dataMatch = itemData.some(
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
      const isThisComp =
        item.ownerNode.id === compId ||
        (compId === 'unattached' && (!item.ownerNode.id || item.ownerNode.id === 'cluster-storage' || item.ownerNode.id === 'unattached')) ||
        (compId === 'cluster-storage' && item.ownerNode.id === 'cluster-storage');
      if (isThisComp && nextGroupIdx < nextGroupItems.length) {
        const replacement = nextGroupItems[nextGroupIdx];
        nextGroupIdx += 1;
        return replacement;
      }
      return item;
    });
    setOrderedItems(updatedOrdered);

    if (isSecret) {
      syncResourcePrecedenceOrder({
        resourceType: 'Secret',
        reorderedItems: updatedOrdered,
        nodes,
        updateNodeData,
        savedItems: savedSecrets,
        setSavedItems: setSavedSecrets,
        saveToLocal: saveSecretsToLocal,
        addLog,
      });
    } else {
      syncResourcePrecedenceOrder({
        resourceType: 'ConfigMap',
        reorderedItems: updatedOrdered,
        nodes,
        updateNodeData,
        savedItems: savedConfigMaps,
        setSavedItems: setSavedConfigMaps,
        saveToLocal: saveConfigMapsToLocal,
        addLog,
      });
    }
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

  const isRose = resolvedAccent === 'rose';
  const EmptyIcon = isRose ? Lock : Settings;

  return (
    <div className="space-y-3" data-testid={`${resourceType.toLowerCase()}-precedence-view`}>

      {orderedItems.length > 2 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Filter ${resourceType}s by ID, key, or value...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-colors",
              isDark
                ? "bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
                : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
              isRose ? "focus:border-rose-500" : "focus:border-teal-500"
            )}
          />
        </div>
      )}

      <div className="space-y-4 max-h-[54vh] overflow-y-auto custom-scrollbar pr-1">
        {filteredGroups.length === 0 ? (
          <div
            className={cn(
              "text-center py-12 px-4 rounded-xl border",
              isDark ? "border-slate-800 bg-slate-900/30" : "border-slate-200 bg-slate-50/50"
            )}
          >
            <EmptyIcon size={36} className={cn("mx-auto mb-2.5 opacity-25", isRose ? "text-rose-400" : "text-teal-400")} />
            <p className="text-xs font-medium text-slate-400">
              {search.trim()
                ? `No ${resourceType}s match your filter.`
                : `No ${resourceType}s found in profile "${profileName}". Click "+ Add ${resourceType}" to create one.`}
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
              prefix={prefix}
              resourceType={resourceType}
              accentColor={resolvedAccent}
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
