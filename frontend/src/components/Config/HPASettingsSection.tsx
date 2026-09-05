import React from 'react';
import { Activity } from 'lucide-react';
import { K8sNodeData, K8sHpaItem } from '../../types';
import { HPAModal } from '../Modals/HPAModal';
import { HPAListModal } from '../Modals/HPAListModal';
import { AttachedResourceSettingsSection } from './AttachedResourceSettingsSection';

interface HPASettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const HPASettingsSection: React.FC<HPASettingsSectionProps> = ({ data, nodeId }) => {
  return (
    <AttachedResourceSettingsSection<K8sHpaItem>
      data={data}
      nodeId={nodeId}
      resourceKey="hpas"
      resourceName="HPA"
      logResourceName="HPA"
      icon={Activity}
      badgeBgColorClass="bg-fuchsia-600"
      darkBorderColorClass="border-fuchsia-500/50"
      darkTextColorClass="text-fuchsia-400"
      darkHoverBorderClass="hover:border-fuchsia-400"
      lightBgColorClass="bg-fuchsia-50"
      lightBorderColorClass="border-fuchsia-200"
      lightTextColorClass="text-fuchsia-600"
      lightHoverBorderClass="hover:border-fuchsia-400"
      renderListModal={({ isOpen, onClose, targetNodeLabel, items, onEditItem, onDeleteItem, onAddNewItem }) => (
        <HPAListModal
          isOpen={isOpen}
          onClose={onClose}
          targetNodeLabel={targetNodeLabel}
          hpas={items}
          onEditHpa={onEditItem}
          onDeleteHpa={onDeleteItem}
          onAddNewHpa={onAddNewItem}
        />
      )}
      renderEditModal={({ isOpen, onClose, targetNodeId, targetNodeLabel, initialItem, onSave }) => (
        <HPAModal
          isOpen={isOpen}
          onClose={onClose}
          targetNodeId={targetNodeId}
          targetNodeLabel={targetNodeLabel}
          initialHpa={initialItem}
          onSave={onSave}
        />
      )}
    />
  );
};
