import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { Modal } from './Modal';
import { K8sConfigMapItem } from '../../types';
import { useFlowStore } from '../../store';
import { cn, sanitizeSlug } from '../../lib/utils';
import { KeyValueFormSection } from './KeyValueFormSection';
import { useKeyValueModalState } from '@/activities/modals/useKeyValueModalState';

interface ConfigMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string | null;
  targetNodeLabel?: string;
  initialConfigMap?: K8sConfigMapItem | null;
  onSave: (configMapItem: K8sConfigMapItem) => void;
}

const DEFAULT_CM_ITEMS = [
  { key: 'API_URL', value: 'https://api.example.com' },
  { key: 'LOG_LEVEL', value: 'info' },
];

export const ConfigMapModal: React.FC<ConfigMapModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  initialConfigMap,
  onSave,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  const [cmName, setCmName] = useState<string>('app-config');
  const {
    dataItems,
    setDataItems,
    handleAddField,
    handleRemoveField,
    handleUpdateField,
    getValidData,
  } = useKeyValueModalState('cm', DEFAULT_CM_ITEMS);

  useEffect(() => {
    if (initialConfigMap) {
      setCmName(initialConfigMap.name || 'app-config');
      setDataItems(
        initialConfigMap.configData && initialConfigMap.configData.length > 0
          ? initialConfigMap.configData.map((item) => ({
              id: `cm-kv-${crypto.randomUUID().split('-')[0]}`,
              key: item.key,
              value: item.value,
            }))
          : [{ id: `cm-kv-${crypto.randomUUID().split('-')[0]}`, key: 'API_URL', value: 'https://api.example.com' }]
      );
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      setCmName(`cm-${randomSuffix}`);
      setDataItems([
        { id: `cm-kv-${crypto.randomUUID().split('-')[0]}`, key: 'API_URL', value: 'https://api.example.com' },
        { id: `cm-kv-${crypto.randomUUID().split('-')[0]}`, key: 'LOG_LEVEL', value: 'info' },
      ]);
    }
  }, [initialConfigMap, isOpen, targetNodeId, setDataItems]);

  if (!isOpen) return null;

  const handleSave = () => {
    const validData = getValidData();
    const configMapItem: K8sConfigMapItem = {
      id: initialConfigMap?.id || `cm-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      name: sanitizeSlug(cmName) || 'unnamed-configmap',
      configData: validData,
    };
    onSave(configMapItem);
    onClose();
  };

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
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-md transition-all cursor-pointer"
      >
        {initialConfigMap ? 'Update ConfigMap' : 'Attach ConfigMap'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialConfigMap ? 'Edit ConfigMap' : 'Attach ConfigMap'}
      subtitle={targetNodeLabel ? `Target card: ${targetNodeLabel}` : 'Configure Key-Value Data'}
      icon={Settings}
      iconColorClass="text-teal-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[70vh]"
      footer={footer}
    >
      <div className="space-y-4">
        {/* ConfigMap Name */}
        <div>
          <label htmlFor="configmap-name-input" className="block text-xs font-semibold mb-1 text-slate-400">
            ConfigMap Name
          </label>
          <input
            id="configmap-name-input"
            type="text"
            value={cmName}
            onChange={(e) => setCmName(e.target.value)}
            placeholder="e.g. app-config"
            className={cn(
              "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500/50 transition-all",
              colorMode === 'dark'
                ? "bg-slate-950 border-slate-800 text-slate-100"
                : "bg-slate-50 border-slate-300 text-slate-900"
            )}
          />
        </div>

        {/* Quick Simulation Presets */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-slate-400">
            Quick Simulation Presets
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDataItems([
                  { id: `cm-kv-${crypto.randomUUID().split('-')[0]}`, key: 'API_URL', value: 'https://api.example.com' },
                  { id: `cm-kv-${crypto.randomUUID().split('-')[0]}`, key: 'LOG_LEVEL', value: 'info' },
                  { id: `cm-kv-${crypto.randomUUID().split('-')[0]}`, key: 'SIMULATE_FAILURE', value: 'false' },
                ]);
              }}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer",
                colorMode === 'dark'
                  ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
                  : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
              )}
            >
              Preset: Normal App Config
            </button>
            <button
              type="button"
              onClick={() => {
                setDataItems([
                  { id: `cm-kv-${crypto.randomUUID().split('-')[0]}`, key: 'SIMULATE_FAILURE', value: 'true' },
                  { id: `cm-kv-${crypto.randomUUID().split('-')[0]}`, key: 'LOG_LEVEL', value: 'debug' },
                ]);
              }}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer",
                colorMode === 'dark'
                  ? "bg-rose-950/40 border-rose-800/60 text-rose-300 hover:bg-rose-900/50"
                  : "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100"
              )}
            >
              Preset: Simulate Failure (Chaos)
            </button>
          </div>
        </div>

        {/* Key-Value Data Section */}
        <KeyValueFormSection
          items={dataItems}
          colorMode={colorMode}
          accentColor="teal"
          onAddField={handleAddField}
          onRemoveField={handleRemoveField}
          onUpdateField={handleUpdateField}
          keyPlaceholder="KEY (e.g. API_URL)"
          valuePlaceholder="Value"
          valueInputType="text"
          sectionTitle="ConfigMap Data (Key - Value Pairs)"
        />
      </div>
    </Modal>
  );
};
