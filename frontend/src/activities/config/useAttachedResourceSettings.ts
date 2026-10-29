import { useState } from 'react';
import { useFlowStore } from '@/store';
import { K8sNodeData } from '@/types';

export interface BaseResourceItem {
  id: string;
  name: string;
}

export function useAttachedResourceSettings<T extends BaseResourceItem>(
  data: K8sNodeData,
  nodeId: string,
  resourceKey: keyof K8sNodeData,
  resourceName: string,
  logResourceName?: string
) {
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
    const cmResourceName = (item as any).resourceName;
    if (resourceKey === 'configMaps') {
      const isAttachedToThisNode = Boolean(
        typeof cmResourceName === 'string' &&
        cmResourceName.split(',').map((s) => s.trim()).some((name) => name === targetNodeLabel || name === nodeId)
      );
      if (!isAttachedToThisNode) {
        const filtered = items.filter((i) => i.id !== item.id && i.name !== item.name);
        updateNodeData(nodeId, { [resourceKey]: filtered });
        addLog('info', `[${resourceName} Removed] Removed ${logLabel} "${item.name}" from node`, 'UI');
        setIsEditModalOpen(false);
        return;
      }
    }

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

  const targetNodeLabel = data.label || nodeId;

  return {
    colorMode,
    items,
    editingItem,
    isEditModalOpen,
    setIsEditModalOpen,
    isListModalOpen,
    setIsListModalOpen,
    targetNodeLabel,
    handleOpenEdit,
    handleAddNew,
    handleDeleteItem,
    handleSaveItem,
  };
}
