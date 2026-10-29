import { useState, useEffect } from 'react';
import { K8sSecretItem } from '@/types';
import { sanitizeSlug } from '@/lib/utils';
import { useKeyValueModalState } from './useKeyValueModalState';

export const DEFAULT_SECRET_ITEMS = [
  { key: 'DB_PASSWORD', value: 's3cr3tp@ss' },
  { key: 'API_KEY', value: 'secret-token-xyz' },
];

/**
 * Custom hook managing form state and saving logic for Secret modal.
 *
 * @param isOpen Modal open state
 * @param targetNodeId Target node ID
 * @param initialSecret Initial Secret item if editing
 * @param onSave Callback when saving Secret item
 * @param onClose Callback to close modal
 * @returns State properties and save handler
 */
export function useSecretModal(
  isOpen: boolean,
  targetNodeId: string | null,
  initialSecret: K8sSecretItem | null | undefined,
  onSave: (secretItem: K8sSecretItem) => void,
  onClose: () => void
) {
  const [secretId, setSecretId] = useState<string>('');
  const [secretName, setSecretName] = useState<string>('app-secret');
  const [secretType, setSecretType] = useState<string>('Opaque');

  const {
    dataItems,
    setDataItems,
    handleAddField,
    handleRemoveField,
    handleUpdateField,
    getValidData,
  } = useKeyValueModalState('sec', DEFAULT_SECRET_ITEMS);

  const loadSecret = (sec: K8sSecretItem | null | undefined) => {
    if (sec) {
      setSecretId(sec.id);
      setSecretName(sec.name || 'app-secret');
      setSecretType(sec.type || 'Opaque');
      setDataItems(
        sec.secretData && sec.secretData.length > 0
          ? sec.secretData.map((item) => ({
              id: `sec-kv-${crypto.randomUUID().split('-')[0]}`,
              key: item.key,
              value: item.value,
            }))
          : [{ id: `sec-kv-${crypto.randomUUID().split('-')[0]}`, key: 'DB_PASSWORD', value: 's3cr3tp@ss' }]
      );
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      const newId = `secret-${randomSuffix}`;
      setSecretId(newId);
      setSecretName(newId);
      setSecretType('Opaque');
      setDataItems([
        { id: `sec-kv-${crypto.randomUUID().split('-')[0]}`, key: 'DB_PASSWORD', value: 's3cr3tp@ss' },
        { id: `sec-kv-${crypto.randomUUID().split('-')[0]}`, key: 'API_KEY', value: 'secret-token-xyz' },
      ]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSecret(initialSecret);
    }
  }, [initialSecret, isOpen, targetNodeId]);

  const handleSave = () => {
    const validData = getValidData();
    const effectiveId = secretId || initialSecret?.id || `secret-${Date.now()}-${crypto.randomUUID().split('-')[0]}`;
    const trimmedName = secretName?.trim();
    const secretItem: K8sSecretItem = {
      id: effectiveId,
      name: trimmedName ? sanitizeSlug(trimmedName) : effectiveId,
      type: secretType || 'Opaque',
      secretData: validData,
    };
    onSave(secretItem);
    onClose();
  };

  return {
    secretId,
    secretName,
    setSecretName,
    secretType,
    setSecretType,
    dataItems,
    setDataItems,
    handleAddField,
    handleRemoveField,
    handleUpdateField,
    loadSecret,
    handleSave,
  };
}
