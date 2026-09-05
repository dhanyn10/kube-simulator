import React from 'react';
import { Settings } from 'lucide-react';
import { K8sNodeData, K8sConfigMapItem } from '../../types';
import { ConfigMapModal } from '../Modals/ConfigMapModal';
import { ConfigMapListModal } from '../Modals/ConfigMapListModal';
import { AttachedResourceSettingsSection } from './AttachedResourceSettingsSection';

interface ConfigMapSettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const ConfigMapSettingsSection: React.FC<ConfigMapSettingsSectionProps> = ({ data, nodeId }) => {
  return (
    <AttachedResourceSettingsSection<K8sConfigMapItem>
      data={data}
      nodeId={nodeId}
      resourceKey="configMaps"
      resourceName="ConfigMap"
      logResourceName="ConfigMap"
      icon={Settings}
      badgeBgColorClass="bg-teal-600"
      darkBorderColorClass="border-teal-500/50"
      darkTextColorClass="text-teal-400"
      darkHoverBorderClass="hover:border-teal-400"
      lightBgColorClass="bg-teal-50"
      lightBorderColorClass="border-teal-200"
      lightTextColorClass="text-teal-600"
      lightHoverBorderClass="hover:border-teal-400"
      renderListModal={({ isOpen, onClose, targetNodeLabel, items, onEditItem, onDeleteItem, onAddNewItem }) => (
        <ConfigMapListModal
          isOpen={isOpen}
          onClose={onClose}
          targetNodeLabel={targetNodeLabel}
          configMaps={items}
          onEditConfigMap={onEditItem}
          onDeleteConfigMap={onDeleteItem}
          onAddNewConfigMap={onAddNewItem}
        />
      )}
      renderEditModal={({ isOpen, onClose, targetNodeId, targetNodeLabel, initialItem, onSave }) => (
        <ConfigMapModal
          isOpen={isOpen}
          onClose={onClose}
          targetNodeId={targetNodeId}
          targetNodeLabel={targetNodeLabel}
          initialConfigMap={initialItem}
          onSave={onSave}
        />
      )}
    />
  );
};
