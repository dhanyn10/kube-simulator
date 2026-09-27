import { useState } from 'react';
import { useFlowStore } from '@/store';
import { K8sNodeData, K8sResourceLimitItem } from '@/types';

/**
 * Custom hook managing business logic and state for ResourceLimitSettingsSection.
 */
export const useResourceLimitSettings = (data: K8sNodeData, nodeId: string) => {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<K8sResourceLimitItem | null>(null);

  const resourceLimits = data.resourceLimits || [];

  const handleSave = (item: K8sResourceLimitItem) => {
    const existingIndex = resourceLimits.findIndex((r) => r.id === item.id);
    let updatedLimits: K8sResourceLimitItem[];
    if (existingIndex >= 0) {
      updatedLimits = [...resourceLimits];
      updatedLimits[existingIndex] = item;
    } else {
      updatedLimits = [...resourceLimits, item];
    }
    updateNodeData(nodeId, {
      resourceLimits: updatedLimits,
      cpuRequest: item.cpuRequest,
      cpuLimit: item.cpuLimit,
      memoryRequest: item.memoryRequest,
      memoryLimit: item.memoryLimit,
    });
  };

  const handleDelete = (itemId: string) => {
    const updatedLimits = resourceLimits.filter((r) => r.id !== itemId);
    const lastItem = updatedLimits[updatedLimits.length - 1];
    updateNodeData(nodeId, {
      resourceLimits: updatedLimits,
      cpuRequest: lastItem?.cpuRequest || undefined,
      cpuLimit: lastItem?.cpuLimit || undefined,
      memoryRequest: lastItem?.memoryRequest || undefined,
      memoryLimit: lastItem?.memoryLimit || undefined,
    });
  };

  const handleOpenAddModal = () => {
    setSelectedItem(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEditModal = (item: K8sResourceLimitItem) => {
    setSelectedItem(item);
    setIsEditModalOpen(true);
  };

  return {
    resourceLimits,
    isListModalOpen,
    setIsListModalOpen,
    isEditModalOpen,
    setIsEditModalOpen,
    selectedItem,
    handleSave,
    handleDelete,
    handleOpenAddModal,
    handleOpenEditModal,
  };
};
