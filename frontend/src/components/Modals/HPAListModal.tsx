import React from 'react';
import { Activity, Edit2, Trash2, Plus } from 'lucide-react';
import { Modal } from './Modal';
import { K8sHpaItem } from '../../types';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';

interface HPAListModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeLabel?: string;
  hpas: K8sHpaItem[];
  onEditHpa: (hpa: K8sHpaItem) => void;
  onDeleteHpa: (hpaId: string, hpaName: string) => void;
  onAddNewHpa: () => void;
}

export const HPAListModal: React.FC<HPAListModalProps> = ({
  isOpen,
  onClose,
  targetNodeLabel,
  hpas,
  onEditHpa,
  onDeleteHpa,
  onAddNewHpa,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  if (!isOpen) return null;

  const footer = (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => {
          onClose();
          onAddNewHpa();
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-fuchsia-600 hover:bg-fuchsia-500 text-white transition-all shadow-sm cursor-pointer"
      >
        <Plus size={14} /> Add HPA
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
      title="Attached HPA Autoscalers"
      subtitle={targetNodeLabel ? `Node: ${targetNodeLabel}` : 'Manage attached HPA Autoscalers'}
      icon={Activity}
      iconColorClass="text-fuchsia-400"
      widthClass="w-full max-w-2xl"
      maxHeightClass="h-[70vh]"
      footer={footer}
    >
      <div className="space-y-3">
        {hpas.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">No HPA autoscalers attached to this node.</div>
        ) : (
          hpas.map((hpa) => (
            <div
              key={`hpa-modal-item-${hpa.id}`}
              className={cn(
                "p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors",
                colorMode === 'dark'
                  ? "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                  : "bg-slate-50 border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-fuchsia-400 shrink-0" />
                  <span className="font-mono font-bold text-xs truncate text-fuchsia-300">{hpa.name}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Replicas: {hpa.minReplicas} - {hpa.maxReplicas} | Target CPU: {hpa.targetCPU}%
                  {hpa.targetMemory ? ` | Target Mem: ${hpa.targetMemory}%` : ''}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 border-l pl-2 border-slate-700/40">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditHpa(hpa);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/10 transition-colors cursor-pointer"
                  title="Edit HPA"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteHpa(hpa.id, hpa.name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Delete HPA"
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
