import React from 'react';
import { Lock } from 'lucide-react';
import { AttachedResourceListModal } from './AttachedResourceListModal';
import { K8sSecretItem } from '../../types';

interface SecretListModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeLabel?: string;
  secrets: K8sSecretItem[];
  onEditSecret: (secret: K8sSecretItem) => void;
  onDeleteSecret: (secretId: string, secretName: string) => void;
  onAddNewSecret: () => void;
}

export const SecretListModal: React.FC<SecretListModalProps> = ({
  isOpen,
  onClose,
  targetNodeLabel,
  secrets,
  onEditSecret,
  onDeleteSecret,
  onAddNewSecret,
}) => {
  return (
    <AttachedResourceListModal<K8sSecretItem>
      isOpen={isOpen}
      onClose={onClose}
      title="Attached Secrets"
      subtitle={targetNodeLabel ? `Node: ${targetNodeLabel}` : 'Manage attached Secrets'}
      icon={Lock}
      iconColorClass="text-indigo-400"
      buttonBgColorClass="bg-indigo-600 hover:bg-indigo-500"
      hoverIconColorClass="hover:text-indigo-300 hover:bg-indigo-500/10"
      items={secrets}
      emptyText="No Secrets attached to this node."
      addLabel="Add Secret"
      itemTypeName="Secret"
      renderItemDetails={(sec) => (
        <>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {sec.type || 'Opaque'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {sec.secretData && sec.secretData.length > 0 ? (
              <span>
                {sec.secretData.length} key-value pair{sec.secretData.length > 1 ? 's' : ''} ({sec.secretData.map((d) => d.key).join(', ')})
              </span>
            ) : (
              <span>No data entries</span>
            )}
          </div>
        </>
      )}
      onEditItem={onEditSecret}
      onDeleteItem={onDeleteSecret}
      onAddNewItem={onAddNewSecret}
    />
  );
};
