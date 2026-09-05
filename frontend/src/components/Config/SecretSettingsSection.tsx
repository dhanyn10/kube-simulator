import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { K8sNodeData, K8sSecretItem } from '../../types';
import { SecretModal } from '../Modals/SecretModal';
import { SecretListModal } from '../Modals/SecretListModal';

interface SecretSettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const SecretSettingsSection: React.FC<SecretSettingsSectionProps> = ({ data, nodeId }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const addLog = useFlowStore((state) => state.addLog);

  const [editingSecret, setEditingSecret] = useState<K8sSecretItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const secrets: K8sSecretItem[] = data.secrets || [];

  const handleOpenEdit = (secret: K8sSecretItem) => {
    setEditingSecret(secret);
    setIsEditModalOpen(true);
  };

  const handleAddNewSecret = () => {
    setEditingSecret(null);
    setIsEditModalOpen(true);
  };

  const handleDeleteSecret = (secretId: string, secretName: string) => {
    const updated = secrets.filter((s) => s.id !== secretId);
    updateNodeData(nodeId, { secrets: updated });
    addLog('info', `[Secret Removed] Removed Secret "${secretName}" from node`, 'UI');
  };

  const handleSaveSecret = (secretItem: K8sSecretItem) => {
    const existingIndex = secrets.findIndex((s) => s.id === secretItem.id);
    let updated: K8sSecretItem[];
    if (existingIndex >= 0) {
      updated = [...secrets];
      updated[existingIndex] = secretItem;
    } else {
      updated = [...secrets, secretItem];
    }
    updateNodeData(nodeId, { secrets: updated });
    addLog('info', `[Secret Saved] Updated Secret "${secretItem.name}"`, 'UI');
    setIsEditModalOpen(false);
  };

  if (secrets.length === 0) return null;

  return (
    <>
      {/* Single Secret Hero Item Icon with Notification Count Badge */}
      <div className="relative group inline-block">
        <button
          type="button"
          onClick={() => setIsListModalOpen(true)}
          className={cn(
            "p-2 rounded-md border flex items-center justify-center transition-all cursor-pointer relative shadow-sm hover:scale-105",
            colorMode === 'dark'
              ? "bg-slate-900/80 border-indigo-500/50 text-indigo-400 hover:border-indigo-400"
              : "bg-indigo-50 border-indigo-200 text-indigo-600 hover:border-indigo-400"
          )}
          title={`Attached Secrets (${secrets.length})`}
        >
          <Lock size={18} />

          {/* Notification Badge with Number (Only rendered when count > 1) */}
          {secrets.length > 1 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold font-mono flex items-center justify-center shadow-md border border-slate-900 animate-in zoom-in-75 duration-150">
              {secrets.length}
            </span>
          )}
        </button>
      </div>

      {/* Secret List Modal */}
      <SecretListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        targetNodeLabel={data.label || nodeId}
        secrets={secrets}
        onEditSecret={handleOpenEdit}
        onDeleteSecret={handleDeleteSecret}
        onAddNewSecret={handleAddNewSecret}
      />

      {/* Secret Config & Edit Modal */}
      <SecretModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        targetNodeId={nodeId}
        targetNodeLabel={data.label || nodeId}
        initialSecret={editingSecret}
        onSave={handleSaveSecret}
      />
    </>
  );
};
