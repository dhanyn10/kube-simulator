import React, { useState } from 'react';
import { Settings, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFlowStore } from '../../store';
import { K8sNodeData, K8sConfigMapItem } from '../../types';
import { ConfigMapModal } from '../Modals/ConfigMapModal';

interface ConfigMapSettingsSectionProps {
  data: K8sNodeData;
  nodeId: string;
}

export const ConfigMapSettingsSection: React.FC<ConfigMapSettingsSectionProps> = ({ data, nodeId }) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const addLog = useFlowStore((state) => state.addLog);

  const [editingConfigMap, setEditingConfigMap] = useState<K8sConfigMapItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConfigMapList, setShowConfigMapList] = useState(false);

  const configMaps: K8sConfigMapItem[] = data.configMaps || [];

  const handleOpenEdit = (cm: K8sConfigMapItem) => {
    setEditingConfigMap(cm);
    setIsModalOpen(true);
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
    setIsModalOpen(false);
  };

  if (configMaps.length === 0) return null;

  return (
    <div className="pt-2 border-t border-slate-700/30">
      <div className="flex flex-wrap items-center gap-3">
        {/* Single ConfigMap Hero Item Icon with Notification Count Badge */}
        <div className="relative group inline-block">
          <button
            type="button"
            onClick={() => setShowConfigMapList((prev) => !prev)}
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

          {/* Quick List Popover when clicking ConfigMap hero icon */}
          {showConfigMapList && (
            <div className={cn(
              "absolute left-0 top-full mt-2 w-56 rounded-lg border shadow-xl z-50 p-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150",
              colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-800"
            )}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 pb-1 border-b border-slate-700/30">
                Attached ConfigMaps ({configMaps.length})
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                {configMaps.map((cm) => (
                  <div
                    key={`cm-item-${cm.id}`}
                    className="flex items-center justify-between p-1.5 rounded-md hover:bg-slate-800/50 transition-colors text-xs font-mono"
                  >
                    <span className="truncate max-w-[120px] font-semibold">{cm.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cm)}
                        className="p-1 rounded text-slate-400 hover:text-teal-300 transition-colors cursor-pointer"
                        title="Edit ConfigMap"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteConfigMap(cm.id, cm.name)}
                        className="p-1 rounded text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete ConfigMap"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfigMapModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetNodeId={nodeId}
        targetNodeLabel={data.label || nodeId}
        initialConfigMap={editingConfigMap}
        onSave={handleSaveConfigMap}
      />
    </div>
  );
};
