import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { Modal } from './Modal';
import { K8sSecretItem } from '../../types';
import { useFlowStore } from '../../store';
import { cn, sanitizeSlug } from '../../lib/utils';
import { KeyValueFormSection, KeyValueItem } from './KeyValueFormSection';

interface SecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string | null;
  targetNodeLabel?: string;
  initialSecret?: K8sSecretItem | null;
  onSave: (secretItem: K8sSecretItem) => void;
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
  const [dataItems, setDataItems] = useState<KeyValueItem[]>([
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
        <KeyValueFormSection
          items={dataItems}
          colorMode={colorMode}
          accentColor="indigo"
          onAddField={handleAddField}
          onRemoveField={handleRemoveField}
          onUpdateField={handleUpdateField}
          keyPlaceholder="KEY (e.g. DB_PASSWORD)"
          valuePlaceholder="Secret Value"
          valueInputType="password"
          sectionTitle="Secret Data (Key - Value Pairs)"
        />
      </div>
    </Modal>
  );
};
