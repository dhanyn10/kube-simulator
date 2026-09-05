import React from 'react';
import { Lock } from 'lucide-react';
import { K8sNodeData, K8sSecretItem } from '../../types';
import { SecretModal } from '../Modals/SecretModal';
import { SecretListModal } from '../Modals/SecretListModal';
import { AttachedResourceSettingsSection } from './AttachedResourceSettingsSection';

interface SecretSettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const SecretSettingsSection: React.FC<SecretSettingsSectionProps> = ({ data, nodeId }) => {
  return (
    <AttachedResourceSettingsSection<K8sSecretItem>
      data={data}
      nodeId={nodeId}
      resourceKey="secrets"
      resourceName="Secret"
      logResourceName="Secret"
      icon={Lock}
      badgeBgColorClass="bg-indigo-600"
      darkBorderColorClass="border-indigo-500/50"
      darkTextColorClass="text-indigo-400"
      darkHoverBorderClass="hover:border-indigo-400"
      lightBgColorClass="bg-indigo-50"
      lightBorderColorClass="border-indigo-200"
      lightTextColorClass="text-indigo-600"
      lightHoverBorderClass="hover:border-indigo-400"
      renderListModal={({ isOpen, onClose, targetNodeLabel, items, onEditItem, onDeleteItem, onAddNewItem }) => (
        <SecretListModal
          isOpen={isOpen}
          onClose={onClose}
          targetNodeLabel={targetNodeLabel}
          secrets={items}
          onEditSecret={onEditItem}
          onDeleteSecret={onDeleteItem}
          onAddNewSecret={onAddNewItem}
        />
      )}
      renderEditModal={({ isOpen, onClose, targetNodeId, targetNodeLabel, initialItem, onSave }) => (
        <SecretModal
          isOpen={isOpen}
          onClose={onClose}
          targetNodeId={targetNodeId}
          targetNodeLabel={targetNodeLabel}
          initialSecret={initialItem}
          onSave={onSave}
        />
      )}
    />
  );
};
