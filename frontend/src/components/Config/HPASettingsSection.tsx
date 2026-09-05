import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { K8sNodeData, K8sHpaItem } from '../../types';
import { HPAModal } from '../Modals/HPAModal';
import { HPAListModal } from '../Modals/HPAListModal';

interface HPASettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const HPASettingsSection: React.FC<HPASettingsSectionProps> = ({ data, nodeId }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const addLog = useFlowStore((state) => state.addLog);

  const [editingHpa, setEditingHpa] = useState<K8sHpaItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const hpas: K8sHpaItem[] = data.hpas || [];

  const handleOpenEdit = (hpa: K8sHpaItem) => {
    setEditingHpa(hpa);
    setIsEditModalOpen(true);
  };

  const handleAddNewHpa = () => {
    setEditingHpa(null);
    setIsEditModalOpen(true);
  };

  const handleDeleteHpa = (hpaId: string, hpaName: string) => {
    const updated = hpas.filter((h) => h.id !== hpaId);
    updateNodeData(nodeId, { hpas: updated });
    addLog('info', `[HPA Removed] Removed HPA "${hpaName}" from node`, 'UI');
  };

  const handleSaveHpa = (hpaItem: K8sHpaItem) => {
    const existingIndex = hpas.findIndex((h) => h.id === hpaItem.id);
    let updated: K8sHpaItem[];
    if (existingIndex >= 0) {
      updated = [...hpas];
      updated[existingIndex] = hpaItem;
    } else {
      updated = [...hpas, hpaItem];
    }
    updateNodeData(nodeId, { hpas: updated });
    addLog('info', `[HPA Saved] Updated HPA "${hpaItem.name}"`, 'UI');
    setIsEditModalOpen(false);
  };

  if (hpas.length === 0) return null;

  return (
    <>
      {/* Single HPA Hero Item Icon with Notification Count Badge */}
      <div className="relative group inline-block">
        <button
          type="button"
          onClick={() => setIsListModalOpen(true)}
          className={cn(
            "p-2 rounded-md border flex items-center justify-center transition-all cursor-pointer relative shadow-sm hover:scale-105",
            colorMode === 'dark'
              ? "bg-slate-900/80 border-fuchsia-500/50 text-fuchsia-400 hover:border-fuchsia-400"
              : "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600 hover:border-fuchsia-400"
          )}
          title={`Attached HPAs (${hpas.length})`}
        >
          <Activity size={18} />

          {/* Notification Badge with Number (Only rendered when count > 1) */}
          {hpas.length > 1 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-fuchsia-600 text-white text-[9px] font-bold font-mono flex items-center justify-center shadow-md border border-slate-900 animate-in zoom-in-75 duration-150">
              {hpas.length}
            </span>
          )}
        </button>
      </div>

      {/* HPA List Modal */}
      <HPAListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        targetNodeLabel={data.label || nodeId}
        hpas={hpas}
        onEditHpa={handleOpenEdit}
        onDeleteHpa={handleDeleteHpa}
        onAddNewHpa={handleAddNewHpa}
      />

      {/* HPA Config & Edit Modal */}
      <HPAModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        targetNodeId={nodeId}
        targetNodeLabel={data.label || nodeId}
        initialHpa={editingHpa}
        onSave={handleSaveHpa}
      />
    </>
  );
};
