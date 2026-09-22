import { useState, useEffect } from 'react';
import { K8sSecretItem } from '@/types';
import { sanitizeSlug } from '@/lib/utils';
import { useKeyValueModalState } from './useKeyValueModalState';

export const DEFAULT_SECRET_ITEMS = [
  { key: 'DB_PASSWORD', value: 's3cr3tp@ss' },
  { key: 'API_KEY', value: 'secret-token-xyz' }
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
  const [secretName, setSecretName] = useState<string>('app-secret');
  const [secretType, setSecretType] = useState<string>('Opaque');

  const {
    dataItems,
    setDataItems,
    handleAddField,
    handleRemoveField,
    handleUpdateField,
    getValidData
  } = useKeyValueModalState('sec', DEFAULT_SECRET_ITEMS);

  useEffect(() => {
    if (initialSecret) {
      setSecretName(initialSecret.name || 'app-secret');
      setSecretType(initialSecret.type || 'Opaque');
      setDataItems(
        initialSecret.secretData && initialSecret.secretData.length > 0
          ? initialSecret.secretData.map((item) => ({
              id: `sec-kv-${crypto.randomUUID().split('-')[0]}`,
              key: item.key,
              value: item.value
            }))
          : [{ id: `sec-kv-${crypto.randomUUID().split('-')[0]}`, key: 'DB_PASSWORD', value: 's3cr3tp@ss' }]
      );
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      setSecretName(`secret-${randomSuffix}`);
      setSecretType('Opaque');
      setDataItems([
        { id: `sec-kv-${crypto.randomUUID().split('-')[0]}`, key: 'DB_PASSWORD', value: 's3cr3tp@ss' },
        { id: `sec-kv-${crypto.randomUUID().split('-')[0]}`, key: 'API_KEY', value: 'secret-token-xyz' }
      ]);
    }
  }, [initialSecret, isOpen, targetNodeId, setDataItems]);

  const handleSave = () => {
    const validData = getValidData();
    const secretItem: K8sSecretItem = {
      id: initialSecret?.id || `secret-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      name: sanitizeSlug(secretName) || 'unnamed-secret',
      type: secretType || 'Opaque',
      secretData: validData
    };
    onSave(secretItem);
    onClose();
  };

  return {
    secretName,
    setSecretName,
    secretType,
    setSecretType,
    dataItems,
    handleAddField,
    handleRemoveField,
    handleUpdateField,
    handleSave
  };
}
