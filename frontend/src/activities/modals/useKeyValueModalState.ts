import { useState } from 'react';
import { KeyValueItem } from '@/components/Modals/KeyValueFormSection';

export function useKeyValueModalState(prefix: string, initialDefaults: Array<{ key: string; value: string }>) {
  const [dataItems, setDataItems] = useState<KeyValueItem[]>(() =>
    initialDefaults.map((item, idx) => ({
      id: `${prefix}-kv-${idx + 1}`,
      key: item.key,
      value: item.value,
    }))
  );

  const handleAddField = () => {
    setDataItems((prev) => [
      ...prev,
      { id: `${prefix}-kv-${crypto.randomUUID().split('-')[0]}`, key: '', value: '' },
    ]);
  };

  const handleRemoveField = (id: string) => {
    setDataItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateField = (id: string, field: 'key' | 'value', value: string) => {
    setDataItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const getValidData = () => {
    return dataItems
      .filter((item) => item.key.trim() !== '')
      .map(({ key, value }) => ({ key, value }));
  };

  return {
    dataItems,
    setDataItems,
    handleAddField,
    handleRemoveField,
    handleUpdateField,
    getValidData,
  };
}
