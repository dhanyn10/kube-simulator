import React from 'react';
import { Settings, Edit2, Trash2, Plus } from 'lucide-react';
import { Modal } from './Modal';
import { K8sConfigMapItem } from '../../types';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';

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
  const colorMode = useFlowStore((state) => state.colorMode);

  if (!isOpen) return null;

  const footer = (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => {
          onClose();
          onAddNewConfigMap();
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-sm cursor-pointer"
      >
        <Plus size={14} /> Add ConfigMap
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
      title="Attached ConfigMaps"
      subtitle={targetNodeLabel ? `Node: ${targetNodeLabel}` : 'Manage attached ConfigMaps'}
      icon={Settings}
      iconColorClass="text-teal-400"
      widthClass="w-[540px]"
      maxHeightClass="h-[60vh]"
      footer={footer}
    >
      <div className="space-y-3">
        {configMaps.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">No ConfigMaps attached to this node.</div>
        ) : (
          configMaps.map((cm) => (
            <div
              key={`cm-modal-item-${cm.id}`}
              className={cn(
                "p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors",
                colorMode === 'dark'
                  ? "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                  : "bg-slate-50 border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Settings size={14} className="text-teal-400 shrink-0" />
                  <span className="font-mono font-bold text-xs truncate text-teal-300">{cm.name}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {cm.configData && cm.configData.length > 0 ? (
                    <span>
                      {cm.configData.length} key-value pair{cm.configData.length > 1 ? 's' : ''} ({cm.configData.map((d) => d.key).join(', ')})
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
                    onEditConfigMap(cm);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-teal-500/10 transition-colors cursor-pointer"
                  title="Edit ConfigMap"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteConfigMap(cm.id, cm.name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Delete ConfigMap"
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
