import React from 'react';
import { Layers } from 'lucide-react';
import { K8sNodeData, K8sResourceLimitItem } from '@/types';
import { ResourceLimitModal } from '@/components/Modals/ResourceLimitModal';
import { ResourceLimitListModal } from '@/components/Modals/ResourceLimitListModal';
import { AttachedResourceSettingsSection } from './AttachedResourceSettingsSection';

interface ResourceLimitSettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const ResourceLimitSettingsSection: React.FC<ResourceLimitSettingsSectionProps> = ({ data, nodeId }) => {
  return (
    <AttachedResourceSettingsSection<K8sResourceLimitItem>
      data={data}
      nodeId={nodeId}
      resourceKey="resourceLimits"
      resourceName="Resource Limit"
      logResourceName="Resource Limit"
      icon={Layers}
      badgeBgColorClass="bg-purple-600"
      darkBorderColorClass="border-purple-500/50"
      darkTextColorClass="text-purple-400"
      darkHoverBorderClass="hover:border-purple-400"
      lightBgColorClass="bg-purple-50"
      lightBorderColorClass="border-purple-200"
      lightTextColorClass="text-purple-600"
      lightHoverBorderClass="hover:border-purple-400"
      renderListModal={({ isOpen, onClose, targetNodeLabel, items, onEditItem, onDeleteItem, onAddNewItem }) => (
        <ResourceLimitListModal
          isOpen={isOpen}
          onClose={onClose}
          targetNodeLabel={targetNodeLabel}
          resourceLimits={items as K8sResourceLimitItem[]}
          onOpenAddModal={onAddNewItem}
          onOpenEditModal={onEditItem}
          onDeleteItem={(id) => onDeleteItem(id, 'Resource Limit')}
        />
      )}
      renderEditModal={({ isOpen, onClose, targetNodeId, targetNodeLabel, initialItem, onSave }) => (
        <ResourceLimitModal
          isOpen={isOpen}
          onClose={onClose}
          targetNodeId={targetNodeId}
          targetNodeLabel={targetNodeLabel}
          initialResourceLimit={initialItem}
          onSave={onSave}
        />
      )}
    />
  );
};
