import { useState, useEffect, useCallback } from 'react';
import { K8sConfigMapItem } from '@/types';
import { useFlowStore } from '@/store';
import { useKeyValueModalState } from './useKeyValueModalState';
import { useAutocompletePortal } from './useAutocompletePortal';
import {
  ConfigRow,
  PREDEFINED_KEYS,
  findActiveKeyInfo,
  filterKeysByQuery,
  filterValuesByQuery,
  buildConfigMapItem,
} from './configMapModalHelpers';

export { PREDEFINED_KEYS };
export type { ConfigRow };

interface UseConfigMapModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly targetNodeId: string | null;
  readonly initialConfigMap?: K8sConfigMapItem | null;
  readonly onSave: (configMapItem: K8sConfigMapItem) => void;
}

/**
 * Custom activity hook encapsulating state, lifecycle listeners, and autocomplete logic for ConfigMapModal.
 */
export const useConfigMapModal = ({
  isOpen,
  onClose,
  targetNodeId,
  initialConfigMap,
  onSave,
}: UseConfigMapModalProps) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const isDark = colorMode === 'dark';

  const [cmName, setCmName] = useState<string>(() => {
    if (initialConfigMap?.name) return initialConfigMap.name;
    const randomSuffix = crypto.randomUUID().split('-')[0];
    return `cm-${randomSuffix}`;
  });

  const {
    dataItems: rows,
    setDataItems: setRows,
    handleAddField: handleAddRow,
    handleRemoveField,
    handleUpdateField: handleRowChange,
    getValidData,
  } = useKeyValueModalState('cm', []);

  const {
    activeDropdown,
    setActiveDropdown,
    dropdownPos,
    handleInputFocusOrChange: triggerInputFocusOrChange,
  } = useAutocompletePortal('configmap-autocomplete-portal');

  const initialCmId = initialConfigMap?.id;
  const initialCmName = initialConfigMap?.name;
  const initialCmDataStr = initialConfigMap?.configData
    ? JSON.stringify(initialConfigMap.configData)
    : '';

  useEffect(() => {
    if (!isOpen) return;

    if (initialConfigMap?.configData?.length) {
      setCmName(initialConfigMap.name || 'app-config');
      const loadedRows: ConfigRow[] = initialConfigMap.configData.map((item, idx) => ({
        id: `row-${idx}-${Date.now()}`,
        key: item.key,
        value: item.value,
      }));
      setRows(loadedRows);
    } else if (initialConfigMap?.name) {
      setCmName(initialConfigMap.name);
      setRows([]);
    }
  }, [isOpen, targetNodeId, initialCmId, initialCmName, initialCmDataStr]);

  const handleInputFocusOrChange = useCallback(
    (
      elem: HTMLInputElement,
      rowId: string,
      field: 'key' | 'value',
      value?: string
    ) => {
      triggerInputFocusOrChange(elem, rowId, field, handleRowChange, value);
    },
    [triggerInputFocusOrChange, handleRowChange]
  );

  const handleRemoveRow = useCallback(
    (id: string) => {
      handleRemoveField(id);
      if (activeDropdown?.rowId === id) {
        setActiveDropdown(null);
      }
    },
    [handleRemoveField, activeDropdown, setActiveDropdown]
  );

  const handleSave = useCallback(() => {
    const configData = getValidData();
    const configMapItem = buildConfigMapItem(initialConfigMap?.id, cmName, configData);
    onSave(configMapItem);
    onClose();
  }, [getValidData, initialConfigMap, cmName, onSave, onClose]);

  // Active row and filtered key/value autocomplete options
  const activeRow = rows.find((r) => r.id === activeDropdown?.rowId);
  const activeKeyInfo = activeRow ? findActiveKeyInfo(activeRow.key) : undefined;
  const filteredKeys = activeRow ? filterKeysByQuery(activeRow.key) : [];
  const filteredValues = activeRow ? filterValuesByQuery(activeKeyInfo, activeRow.value) : [];

  return {
    isDark,
    cmName,
    setCmName,
    rows,
    activeDropdown,
    setActiveDropdown,
    dropdownPos,
    activeRow,
    filteredKeys,
    filteredValues,
    handleAddRow,
    handleRemoveRow,
    handleRowChange,
    handleInputFocusOrChange,
    handleSave,
  };
};
