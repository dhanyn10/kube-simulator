import React from 'react';
import { K8sNodeData } from '@/types';
import { AttachedResourceSettingsSection } from './AttachedResourceSettingsSection';
import { ResourceLimitModal } from '../Modals/ResourceLimitModal';
import { ResourceLimitListModal } from '../Modals/ResourceLimitListModal';
import { useResourceLimitSettings } from '@/activities/config';

interface ResourceLimitSettingsSectionProps {
  readonly data: K8sNodeData;
  readonly nodeId: string;
}

export const ResourceLimitSettingsSection: React.FC<ResourceLimitSettingsSectionProps> = ({ data, nodeId }) => {
  const {
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
  } = useResourceLimitSettings(data, nodeId);

  return (
    <>
      <AttachedResourceSettingsSection
        title="Resource Limits"
        iconName="Layers"
        resourceName="Resource Limit"
        logResourceName="Resource Limit"
        targetNodeId={nodeId}
        targetNodeLabel={data.label || nodeId}
        attachedItems={resourceLimits}
        onManageClick={() => setIsListModalOpen(true)}
        onAttachClick={handleOpenAddModal}
      />

      <ResourceLimitListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        resourceLimits={resourceLimits}
        targetNodeLabel={data.label || nodeId}
        onOpenAddModal={handleOpenAddModal}
        onOpenEditModal={handleOpenEditModal}
        onDeleteItem={handleDelete}
      />

      <ResourceLimitModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        targetNodeId={nodeId}
        targetNodeLabel={data.label || nodeId}
        initialResourceLimit={selectedItem}
        onSave={handleSave}
      />
    </>
  );
};
