import React, { useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { K8sNodeData } from '../../types';

export interface BaseResourceItem {
  id: string;
  name: string;
}

export interface AttachedResourceSettingsSectionProps<T extends BaseResourceItem> {
  readonly data: K8sNodeData;
  readonly nodeId: string;
  readonly resourceKey: keyof K8sNodeData;
  readonly resourceName: string;
  readonly logResourceName?: string;
  readonly icon: LucideIcon;
  readonly badgeBgColorClass?: string;
  readonly darkBorderColorClass?: string;
  readonly darkTextColorClass?: string;
  readonly darkHoverBorderClass?: string;
  readonly lightBgColorClass?: string;
  readonly lightBorderColorClass?: string;
  readonly lightTextColorClass?: string;
  readonly lightHoverBorderClass?: string;
  readonly renderListModal: (props: {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly targetNodeLabel: string;
    readonly items: readonly T[];
    readonly onEditItem: (item: T) => void;
    readonly onDeleteItem: (itemId: string, itemName: string) => void;
    readonly onAddNewItem: () => void;
  }) => React.ReactElement;
  readonly renderEditModal: (props: {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly targetNodeId: string;
    readonly targetNodeLabel: string;
    readonly initialItem: T | null;
    readonly onSave: (item: T) => void;
  }) => React.ReactElement;
}

export function AttachedResourceSettingsSection<T extends BaseResourceItem>({
  data,
  nodeId,
  resourceKey,
  resourceName,
  logResourceName,
  icon: Icon,
  badgeBgColorClass = "bg-indigo-600",
  darkBorderColorClass = "border-indigo-500/50",
  darkTextColorClass = "text-indigo-400",
  darkHoverBorderClass = "hover:border-indigo-400",
  lightBgColorClass = "bg-indigo-50",
  lightBorderColorClass = "border-indigo-200",
  lightTextColorClass = "text-indigo-600",
  lightHoverBorderClass = "hover:border-indigo-400",
  renderListModal,
  renderEditModal,
}: AttachedResourceSettingsSectionProps<T>): React.ReactElement | null {
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const addLog = useFlowStore((state) => state.addLog);

  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const rawItems = data[resourceKey];
  const items: T[] = Array.isArray(rawItems) ? (rawItems as unknown as T[]) : [];

  const logLabel = logResourceName || resourceName.toLowerCase();

  const handleOpenEdit = (item: T) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setIsEditModalOpen(true);
  };

  const handleDeleteItem = (itemId: string, itemName: string) => {
    const updated = items.filter((item) => item.id !== itemId);
    updateNodeData(nodeId, { [resourceKey]: updated });
    addLog('info', `[${resourceName} Removed] Removed ${logLabel} "${itemName}" from node`, 'UI');
  };

  const handleSaveItem = (item: T) => {
    const existingIndex = items.findIndex((i) => i.id === item.id);
    let updated: T[];
    if (existingIndex >= 0) {
      updated = [...items];
      updated[existingIndex] = item;
    } else {
      updated = [...items, item];
    }
    updateNodeData(nodeId, { [resourceKey]: updated });
    addLog('info', `[${resourceName} Saved] Updated ${logLabel} "${item.name}"`, 'UI');
    setIsEditModalOpen(false);
  };

  if (items.length === 0) return null;

  const targetNodeLabel = data.label || nodeId;

  return (
    <>
      {/* Single Attached Hero Item Trigger Button with Notification Badge */}
      <div className="relative group inline-block">
        <button
          type="button"
          onClick={() => setIsListModalOpen(true)}
          className={cn(
            "p-2 rounded-md border flex items-center justify-center transition-all cursor-pointer relative shadow-sm hover:scale-105",
            colorMode === 'dark'
              ? cn("bg-slate-900/80", darkBorderColorClass, darkTextColorClass, darkHoverBorderClass)
              : cn(lightBgColorClass, lightBorderColorClass, lightTextColorClass, lightHoverBorderClass)
          )}
          title={`Attached ${resourceName}s (${items.length})`}
        >
          <Icon size={18} />

          {/* Notification Badge with Number (Only rendered when count > 1) */}
          {items.length > 1 && (
            <span className={cn(
              "absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full text-white text-[9px] font-bold font-mono flex items-center justify-center shadow-md border border-slate-900 animate-in zoom-in-75 duration-150",
              badgeBgColorClass
            )}>
              {items.length}
            </span>
          )}
        </button>
      </div>

      {/* Resource List Modal */}
      {renderListModal({
        isOpen: isListModalOpen,
        onClose: () => setIsListModalOpen(false),
        targetNodeLabel,
        items,
        onEditItem: handleOpenEdit,
        onDeleteItem: handleDeleteItem,
        onAddNewItem: handleAddNew,
      })}

      {/* Resource Edit Modal */}
      {renderEditModal({
        isOpen: isEditModalOpen,
        onClose: () => setIsEditModalOpen(false),
        targetNodeId: nodeId,
        targetNodeLabel,
        initialItem: editingItem,
        onSave: handleSaveItem,
      })}
    </>
  );
}
