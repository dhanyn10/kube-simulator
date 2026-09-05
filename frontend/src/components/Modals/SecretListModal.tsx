import React from 'react';
import { Lock, Edit2, Trash2, Plus } from 'lucide-react';
import { Modal } from './Modal';
import { K8sSecretItem } from '../../types';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';

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
  const colorMode = useFlowStore((state) => state.colorMode);

  if (!isOpen) return null;

  const footer = (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => {
          onClose();
          onAddNewSecret();
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm cursor-pointer"
      >
        <Plus size={14} /> Add Secret
      </button>
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
        Close
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attached Secrets"
      subtitle={targetNodeLabel ? `Node: ${targetNodeLabel}` : 'Manage attached Secrets'}
      icon={Lock}
      iconColorClass="text-indigo-400"
      widthClass="w-full max-w-2xl"
      maxHeightClass="h-[70vh]"
      footer={footer}
    >
      <div className="space-y-3">
        {secrets.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">No Secrets attached to this node.</div>
        ) : (
          secrets.map((sec) => (
            <div
              key={`sec-modal-item-${sec.id}`}
              className={cn(
                "p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors",
                colorMode === 'dark'
                  ? "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                  : "bg-slate-50 border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-indigo-400 shrink-0" />
                  <span className="font-mono font-bold text-xs truncate text-indigo-300">{sec.name}</span>
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
              </div>

              <div className="flex items-center gap-1 shrink-0 border-l pl-2 border-slate-700/40">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditSecret(sec);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                  title="Edit Secret"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSecret(sec.id, sec.name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Delete Secret"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
