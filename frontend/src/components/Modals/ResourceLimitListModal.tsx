import React from 'react';
import { Layers } from 'lucide-react';
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
      icon={Layers}
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
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span>CPU: {item.cpuRequest || '500m'} / {item.cpuLimit || '1000m'} | Mem: {item.memoryRequest || '256Mi'} / {item.memoryLimit || '512Mi'}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded border uppercase border-purple-500/30 text-purple-300 font-sans font-semibold">
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
