import React from 'react';
import { Gauge } from 'lucide-react';
import { AttachedResourceListModal } from './AttachedResourceListModal';
import { K8sResourceLimitItem } from '@/types';
import { getPodQoSClass } from '@/lib/utils';

interface ResourceLimitListModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly targetNodeLabel?: string;
  readonly resourceLimits: K8sResourceLimitItem[];
  readonly onOpenAddModal: () => void;
  readonly onOpenEditModal: (item: K8sResourceLimitItem) => void;
  readonly onDeleteItem: (itemId: string, itemName: string) => void;
}

export const ResourceLimitListModal: React.FC<ResourceLimitListModalProps> = ({
  isOpen,
  onClose,
  targetNodeLabel,
  resourceLimits,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteItem,
}) => {
  return (
    <AttachedResourceListModal<K8sResourceLimitItem>
      isOpen={isOpen}
      onClose={onClose}
      title="Attached Resource Limits"
      subtitle={targetNodeLabel ? `Node: ${targetNodeLabel}` : 'Manage attached CPU & Memory Limits'}
      icon={Gauge}
      iconColorClass="text-purple-400"
      buttonBgColorClass="bg-purple-600 hover:bg-purple-500"
      hoverIconColorClass="hover:text-purple-300 hover:bg-purple-500/10"
      items={resourceLimits}
      emptyText="No Resource Limits attached to this node."
      addLabel="Add Resource Limit"
      itemTypeName="ResourceLimit"
      renderItemDetails={(item) => {
        const qos = getPodQoSClass(item);
        return (
          <div className="flex items-center gap-2 mono-muted">
            <span>CPU: {item.cpuRequest || '500m'} / {item.cpuLimit || '1000m'} | Mem: {item.memoryRequest || '256Mi'} / {item.memoryLimit || '512Mi'}</span>
            <span className="text-[9px] badge-chip uppercase border-purple-500/30 text-purple-300 font-sans font-semibold">
              {qos}
            </span>
          </div>
        );
      }}
      onEditItem={onOpenEditModal}
      onDeleteItem={onDeleteItem}
      onAddNewItem={onOpenAddModal}
    />
  );
};
