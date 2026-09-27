import React from 'react';
import { K8sResourceLimitItem } from '@/types';
import { AttachedResourceListModal } from './AttachedResourceListModal';

interface ResourceLimitListModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly resourceLimits: K8sResourceLimitItem[];
  readonly targetNodeLabel?: string;
  readonly onOpenAddModal: () => void;
  readonly onOpenEditModal: (item: K8sResourceLimitItem) => void;
  readonly onDeleteItem: (itemId: string) => void;
}

export const ResourceLimitListModal: React.FC<ResourceLimitListModalProps> = ({
  isOpen,
  onClose,
  resourceLimits,
  targetNodeLabel,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteItem,
}) => {
  return (
    <AttachedResourceListModal
      isOpen={isOpen}
      onClose={onClose}
      title="Attached Resource Limits"
      subtitle={targetNodeLabel ? `Node: ${targetNodeLabel}` : 'Manage attached CPU & Memory Limits'}
      items={resourceLimits}
      emptyText="No Resource Limits attached to this node."
      addLabel="Add Resource Limit"
      itemTypeName="ResourceLimit"
      badgeColorClass="border-purple-500/30 text-purple-400 bg-purple-500/10"
      getItemDetails={(item) =>
        `CPU: ${item.cpuRequest || '500m'} / ${item.cpuLimit || '1000m'} | Mem: ${item.memoryRequest || '256Mi'} / ${item.memoryLimit || '512Mi'}`
      }
      onOpenAddModal={onOpenAddModal}
      onOpenEditModal={onOpenEditModal}
      onDeleteItem={onDeleteItem}
    />
  );
};
