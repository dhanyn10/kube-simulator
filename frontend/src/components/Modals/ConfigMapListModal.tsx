import React from 'react';
import { Settings } from 'lucide-react';
import { AttachedResourceListModal } from './AttachedResourceListModal';
import { K8sConfigMapItem } from '../../types';

interface ConfigMapListModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeLabel?: string;
  configMaps: K8sConfigMapItem[];
  onEditConfigMap: (cm: K8sConfigMapItem) => void;
  onDeleteConfigMap: (cmId: string, cmName: string) => void;
  onAddNewConfigMap: () => void;
}

export const ConfigMapListModal: React.FC<ConfigMapListModalProps> = ({
  isOpen,
  onClose,
  targetNodeLabel,
  configMaps,
  onEditConfigMap,
  onDeleteConfigMap,
  onAddNewConfigMap,
}) => {
  return (
    <AttachedResourceListModal<K8sConfigMapItem>
      isOpen={isOpen}
      onClose={onClose}
      title="Attached ConfigMaps"
      subtitle={targetNodeLabel ? `Node: ${targetNodeLabel}` : 'Manage attached ConfigMaps'}
      icon={Settings}
      iconColorClass="text-teal-400"
      buttonBgColorClass="bg-teal-600 hover:bg-teal-500"
      hoverIconColorClass="hover:text-teal-300 hover:bg-teal-500/10"
      items={configMaps}
      emptyText="No ConfigMaps attached to this node."
      addLabel="Add ConfigMap"
      itemTypeName="ConfigMap"
      renderItemDetails={(cm) => (
        <div className="text-[11px] text-slate-400 font-mono">
          {cm.configData && cm.configData.length > 0 ? (
            <span>
              {cm.configData.length} key-value pair{cm.configData.length > 1 ? 's' : ''} ({cm.configData.map((d) => d.key).join(', ')})
            </span>
          ) : (
            <span>No data entries</span>
          )}
        </div>
      )}
      onEditItem={onEditConfigMap}
      onDeleteItem={onDeleteConfigMap}
      onAddNewItem={onAddNewConfigMap}
    />
  );
};
