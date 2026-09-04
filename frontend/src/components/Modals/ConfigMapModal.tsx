import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { K8sConfigMapItem } from '../../types';
import { useFlowStore } from '../../store';
import { cn, sanitizeSlug } from '../../lib/utils';

interface ConfigMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string | null;
  targetNodeLabel?: string;
  initialConfigMap?: K8sConfigMapItem | null;
  onSave: (configMapItem: K8sConfigMapItem) => void;
}

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
  const [dataItems, setDataItems] = useState<Array<{ key: string; value: string }>>([
    { key: 'API_URL', value: 'https://api.example.com' },
    { key: 'LOG_LEVEL', value: 'info' },
  ]);

  useEffect(() => {
    if (initialConfigMap) {
      setCmName(initialConfigMap.name || 'app-config');
      setDataItems(
        initialConfigMap.configData && initialConfigMap.configData.length > 0
          ? initialConfigMap.configData
          : [{ key: 'API_URL', value: 'https://api.example.com' }]
      );
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      setCmName(`cm-${randomSuffix}`);
      setDataItems([
        { key: 'API_URL', value: 'https://api.example.com' },
        { key: 'LOG_LEVEL', value: 'info' },
      ]);
    }
  }, [initialConfigMap, isOpen, targetNodeId]);

  if (!isOpen) return null;

  const handleAddField = () => {
    setDataItems((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveField = (index: number) => {
    setDataItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateField = (index: number, field: 'key' | 'value', value: string) => {
    setDataItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = () => {
    const validData = dataItems.filter((item) => item.key.trim() !== '');
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
          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
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
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-md transition-all"
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

        {/* Key-Value Data Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">ConfigMap Data (Key - Value Pairs)</span>
            <button
              type="button"
              onClick={handleAddField}
              className="flex items-center gap-1 text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
            >
              <Plus size={13} /> Add Key-Value
            </button>
          </div>

          <div className="space-y-2">
            {dataItems.map((item, idx) => (
              <div
                key={`cm-kv-${idx}`}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border",
                  colorMode === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                )}
              >
                <input
                  type="text"
                  value={item.key}
                  onChange={(e) => handleUpdateField(idx, 'key', e.target.value)}
                  placeholder="KEY (e.g. API_URL)"
                  className={cn(
                    "flex-1 px-2.5 py-1.5 rounded-md border text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500",
                    colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
                  )}
                />
                <span className="text-slate-500 font-mono text-xs">=</span>
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => handleUpdateField(idx, 'value', e.target.value)}
                  placeholder="Value"
                  className={cn(
                    "flex-1 px-2.5 py-1.5 rounded-md border text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500",
                    colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
                  )}
                />
                {dataItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveField(idx)}
                    className="p-1.5 text-red-400 hover:text-red-300 rounded transition-colors cursor-pointer"
                    title="Remove Pair"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
