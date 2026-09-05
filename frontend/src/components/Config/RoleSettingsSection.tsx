import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { K8sNodeData, K8sRoleItem } from '../../types';
import { RoleModal } from '../Modals/RoleModal';
import { RoleListModal } from '../Modals/RoleListModal';
import { AttachedResourceSettingsSection } from './AttachedResourceSettingsSection';

interface RoleSettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const RoleSettingsSection: React.FC<RoleSettingsSectionProps> = ({ data, nodeId }) => {
  return (
    <AttachedResourceSettingsSection<K8sRoleItem>
      data={data}
      nodeId={nodeId}
      resourceKey="roles"
      resourceName="Role"
      logResourceName="role"
      icon={ShieldCheck}
      badgeBgColorClass="bg-indigo-600"
      darkBorderColorClass="border-indigo-500/50"
      darkTextColorClass="text-indigo-400"
      darkHoverBorderClass="hover:border-indigo-400"
      lightBgColorClass="bg-indigo-50"
      lightBorderColorClass="border-indigo-200"
      lightTextColorClass="text-indigo-600"
      lightHoverBorderClass="hover:border-indigo-400"
      renderListModal={({ isOpen, onClose, targetNodeLabel, items, onEditItem, onDeleteItem, onAddNewItem }) => (
        <RoleListModal
          isOpen={isOpen}
          onClose={onClose}
          targetNodeLabel={targetNodeLabel}
          roles={items}
          onEditRole={onEditItem}
          onDeleteRole={onDeleteItem}
          onAddNewRole={onAddNewItem}
        />
      )}
      renderEditModal={({ isOpen, onClose, targetNodeId, targetNodeLabel, initialItem, onSave }) => (
        <RoleModal
          isOpen={isOpen}
          onClose={onClose}
          targetNodeId={targetNodeId}
          targetNodeLabel={targetNodeLabel}
          initialRole={initialItem}
          onSave={onSave}
        />
      )}
    />
  );
};
