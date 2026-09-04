import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { K8sNodeData, K8sConfigMapItem } from '../../types';
import { ConfigMapModal } from '../Modals/ConfigMapModal';
import { ConfigMapListModal } from '../Modals/ConfigMapListModal';

interface ConfigMapSettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const ConfigMapSettingsSection: React.FC<ConfigMapSettingsSectionProps> = ({ data, nodeId }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const addLog = useFlowStore((state) => state.addLog);

  const [editingConfigMap, setEditingConfigMap] = useState<K8sConfigMapItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const configMaps: K8sConfigMapItem[] = data.configMaps || [];

  const handleOpenEdit = (cm: K8sConfigMapItem) => {
    setEditingConfigMap(cm);
    setIsEditModalOpen(true);
  };

  const handleAddNewConfigMap = () => {
    setEditingConfigMap(null);
    setIsEditModalOpen(true);
  };

  const handleDeleteConfigMap = (cmId: string, cmName: string) => {
    const updated = configMaps.filter((c) => c.id !== cmId);
    updateNodeData(nodeId, { configMaps: updated });
    addLog('info', `[ConfigMap Removed] Removed ConfigMap "${cmName}" from node`, 'UI');
  };

  const handleSaveConfigMap = (cmItem: K8sConfigMapItem) => {
    const existingIndex = configMaps.findIndex((c) => c.id === cmItem.id);
    let updated: K8sConfigMapItem[];
    if (existingIndex >= 0) {
      updated = [...configMaps];
      updated[existingIndex] = cmItem;
    } else {
      updated = [...configMaps, cmItem];
    }
    updateNodeData(nodeId, { configMaps: updated });
    addLog('info', `[ConfigMap Saved] Updated ConfigMap "${cmItem.name}"`, 'UI');
    setIsEditModalOpen(false);
  };

  if (configMaps.length === 0) return null;

  return (
    <>
      {/* Single ConfigMap Hero Item Icon with Notification Count Badge */}
      <div className="relative group inline-block">
        <button
          type="button"
          onClick={() => setIsListModalOpen(true)}
          className={cn(
            "p-2 rounded-md border flex items-center justify-center transition-all cursor-pointer relative shadow-sm hover:scale-105",
            colorMode === 'dark'
              ? "bg-slate-900/80 border-teal-500/50 text-teal-400 hover:border-teal-400"
              : "bg-teal-50 border-teal-200 text-teal-600 hover:border-teal-400"
          )}
          title={`Attached ConfigMaps (${configMaps.length})`}
        >
          <Settings size={18} />

          {/* Notification Badge with Number (Only rendered when count > 1) */}
          {configMaps.length > 1 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-teal-600 text-white text-[9px] font-bold font-mono flex items-center justify-center shadow-md border border-slate-900 animate-in zoom-in-75 duration-150">
              {configMaps.length}
            </span>
          )}
        </button>
      </div>

      {/* ConfigMap List Modal replacing dropdown popover */}
      <ConfigMapListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        targetNodeLabel={data.label || nodeId}
        configMaps={configMaps}
        onEditConfigMap={handleOpenEdit}
        onDeleteConfigMap={handleDeleteConfigMap}
        onAddNewConfigMap={handleAddNewConfigMap}
      />

      {/* ConfigMap Config & Edit Modal */}
      <ConfigMapModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        targetNodeId={nodeId}
        targetNodeLabel={data.label || nodeId}
        initialConfigMap={editingConfigMap}
        onSave={handleSaveConfigMap}
      />
    </>
  );
};
