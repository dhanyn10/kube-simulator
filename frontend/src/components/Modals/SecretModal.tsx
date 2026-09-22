import React from 'react';
import { Lock } from 'lucide-react';
import { Modal } from './Modal';
import { K8sSecretItem } from '@/types';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';
import { KeyValueFormSection } from './KeyValueFormSection';
import { useSecretModal } from '@/activities/modals';

interface SecretModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly targetNodeId: string | null;
  readonly targetNodeLabel?: string;
  readonly initialSecret?: K8sSecretItem | null;
  readonly onSave: (secretItem: K8sSecretItem) => void;
}

export const SecretModal: React.FC<SecretModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  initialSecret,
  onSave,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  const {
    secretName,
    setSecretName,
    secretType,
    setSecretType,
    dataItems,
    handleAddField,
    handleRemoveField,
    handleUpdateField,
    handleSave,
  } = useSecretModal(isOpen, targetNodeId, initialSecret, onSave, onClose);

  if (!isOpen) return null;

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border cursor-pointer",
          colorMode === 'dark'
            ? "border-slate-700 hover:bg-slate-800 text-slate-300"
            : "border-slate-300 hover:bg-slate-100 text-slate-700"
        )}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSave}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all cursor-pointer"
      >
        {initialSecret ? 'Update Secret' : 'Attach Secret'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialSecret ? 'Edit Secret' : 'Attach Secret'}
      subtitle={targetNodeLabel ? `Target card: ${targetNodeLabel}` : 'Configure Sensitive Key-Value Data'}
      icon={Lock}
      iconColorClass="text-indigo-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[70vh]"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Secret Name & Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="secret-name-input" className="block text-xs font-semibold mb-1 text-slate-400">
              Secret Name
            </label>
            <input
              id="secret-name-input"
              type="text"
              value={secretName}
              onChange={(e) => setSecretName(e.target.value)}
              placeholder="e.g. app-secret"
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all",
                colorMode === 'dark'
                  ? "bg-slate-950 border-slate-800 text-slate-100"
                  : "bg-slate-50 border-slate-300 text-slate-900"
              )}
            />
          </div>
          <div>
            <label htmlFor="secret-type-select" className="block text-xs font-semibold mb-1 text-slate-400">
              Secret Type
            </label>
            <select
              id="secret-type-select"
              value={secretType}
              onChange={(e) => setSecretType(e.target.value)}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all",
                colorMode === 'dark'
                  ? "bg-slate-950 border-slate-800 text-slate-100"
                  : "bg-slate-50 border-slate-300 text-slate-900"
              )}
            >
              <option value="Opaque">Opaque</option>
              <option value="kubernetes.io/service-account-token">Service Account Token</option>
              <option value="kubernetes.io/dockercfg">Docker Config</option>
              <option value="kubernetes.io/basic-auth">Basic Auth</option>
              <option value="kubernetes.io/ssh-auth">SSH Auth</option>
              <option value="kubernetes.io/tls">TLS</option>
            </select>
          </div>
        </div>

        {/* Key-Value Data Section */}
        <KeyValueFormSection
          items={dataItems}
          colorMode={colorMode}
          accentColor="indigo"
          onAddField={handleAddField}
          onRemoveField={handleRemoveField}
          onUpdateField={handleUpdateField}
          keyPlaceholder="KEY (e.g. DB_PASSWORD)"
          valuePlaceholder="Secret Value"
          valueInputType="text"
          sectionTitle="Secret Data (Key - Value Pairs)"
        />
      </div>
    </Modal>
  );
};
