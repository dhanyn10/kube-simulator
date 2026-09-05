import React, { useState, useEffect } from 'react';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { K8sSecretItem } from '../../types';
import { useFlowStore } from '../../store';
import { cn, sanitizeSlug } from '../../lib/utils';

interface SecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string | null;
  targetNodeLabel?: string;
  initialSecret?: K8sSecretItem | null;
  onSave: (secretItem: K8sSecretItem) => void;
}

interface SecretDataItem {
  id: string;
  key: string;
  value: string;
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

  const [secretName, setSecretName] = useState<string>('app-secret');
  const [secretType, setSecretType] = useState<string>('Opaque');
  const [dataItems, setDataItems] = useState<SecretDataItem[]>([
    { id: 'sec-kv-1', key: 'DB_PASSWORD', value: 's3cr3tp@ss' },
    { id: 'sec-kv-2', key: 'API_KEY', value: 'secret-token-xyz' },
  ]);

  useEffect(() => {
    if (initialSecret) {
      setSecretName(initialSecret.name || 'app-secret');
      setSecretType(initialSecret.type || 'Opaque');
      setDataItems(
        initialSecret.secretData && initialSecret.secretData.length > 0
          ? initialSecret.secretData.map((item) => ({
              id: `sec-kv-${crypto.randomUUID().split('-')[0]}`,
              key: item.key,
              value: item.value,
            }))
          : [{ id: `sec-kv-${crypto.randomUUID().split('-')[0]}`, key: 'DB_PASSWORD', value: 's3cr3tp@ss' }]
      );
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      setSecretName(`secret-${randomSuffix}`);
      setSecretType('Opaque');
      setDataItems([
        { id: `sec-kv-${crypto.randomUUID().split('-')[0]}`, key: 'DB_PASSWORD', value: 's3cr3tp@ss' },
        { id: `sec-kv-${crypto.randomUUID().split('-')[0]}`, key: 'API_KEY', value: 'secret-token-xyz' },
      ]);
    }
  }, [initialSecret, isOpen, targetNodeId]);

  if (!isOpen) return null;

  const handleAddField = () => {
    setDataItems((prev) => [...prev, { id: `sec-kv-${crypto.randomUUID().split('-')[0]}`, key: '', value: '' }]);
  };

  const handleRemoveField = (id: string) => {
    setDataItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateField = (id: string, field: 'key' | 'value', value: string) => {
    setDataItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = () => {
    const validData = dataItems
      .filter((item) => item.key.trim() !== '')
      .map(({ key, value }) => ({ key, value }));
    const secretItem: K8sSecretItem = {
      id: initialSecret?.id || `secret-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      name: sanitizeSlug(secretName) || 'unnamed-secret',
      type: secretType || 'Opaque',
      secretData: validData,
    };
    onSave(secretItem);
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Secret Data (Key - Value Pairs)</span>
            <button
              type="button"
              onClick={handleAddField}
              className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              <Plus size={13} /> Add Key-Value
            </button>
          </div>

          <div className="space-y-2">
            {dataItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border",
                  colorMode === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                )}
              >
                <input
                  type="text"
                  value={item.key}
                  onChange={(e) => handleUpdateField(item.id, 'key', e.target.value)}
                  placeholder="KEY (e.g. DB_PASSWORD)"
                  className={cn(
                    "flex-1 px-2.5 py-1.5 rounded-md border text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500",
                    colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
                  )}
                />
                <span className="text-slate-500 font-mono text-xs">=</span>
                <input
                  type="password"
                  value={item.value}
                  onChange={(e) => handleUpdateField(item.id, 'value', e.target.value)}
                  placeholder="Secret Value"
                  className={cn(
                    "flex-1 px-2.5 py-1.5 rounded-md border text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500",
                    colorMode === 'dark' ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
                  )}
                />
                {dataItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveField(item.id)}
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
