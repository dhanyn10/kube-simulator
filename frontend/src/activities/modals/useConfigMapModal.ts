import { useState, useEffect, useCallback } from 'react';
import { K8sConfigMapItem } from '@/types';
import { useFlowStore } from '@/store';
import { useKeyValueModalState } from './useKeyValueModalState';
import { useAutocompletePortal } from './useAutocompletePortal';
import {
  findActiveKeyInfo,
  filterKeysByQuery,
  filterValuesByQuery,
  buildConfigMapItem,
} from './configMapModalHelpers';

export { PREDEFINED_KEYS } from './configMapModalHelpers';
export type { ConfigRow } from './configMapModalHelpers';

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

  const [activeItem, setActiveItem] = useState<K8sConfigMapItem | null>(initialConfigMap || null);

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

  const handleAddMultipleRows = useCallback(
    (newRows: Array<{ id: string; key: string; value: string }>) => {
      setRows((prev) => [...prev, ...newRows]);
    },
    [setRows]
  );

  const {
    activeDropdown,
    setActiveDropdown,
    dropdownPos,
    handleInputFocusOrChange: triggerInputFocusOrChange,
  } = useAutocompletePortal('configmap-autocomplete-portal');

  const loadConfigMap = useCallback((item: K8sConfigMapItem | null) => {
    setActiveItem(item);
    if (item?.configData?.length) {
      setCmName(item.name || 'app-config');
      const loadedRows = item.configData.map((entry, idx) => ({
        id: `row-${idx}-${Date.now()}`,
        key: entry.key,
        value: entry.value,
      }));
      setRows(loadedRows);
    } else if (item?.name) {
      setCmName(item.name);
      setRows([]);
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      setCmName(`cm-${randomSuffix}`);
      setRows([]);
    }
  }, [setRows]);

  const initialCmId = initialConfigMap?.id;
  const initialCmName = initialConfigMap?.name;
  const initialCmDataStr = initialConfigMap?.configData
    ? JSON.stringify(initialConfigMap.configData)
    : '';

  useEffect(() => {
    if (!isOpen) return;
    loadConfigMap(initialConfigMap || null);
  }, [isOpen, targetNodeId, initialCmId, initialCmName, initialCmDataStr, loadConfigMap]);

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
    const targetId = activeItem?.id || initialConfigMap?.id;
    const configMapItem = buildConfigMapItem(targetId, cmName, configData);
    onSave(configMapItem);
    onClose();
  }, [getValidData, activeItem, initialConfigMap, cmName, onSave, onClose]);

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
    activeItem,
    setActiveItem,
    loadConfigMap,
    activeDropdown,
    setActiveDropdown,
    dropdownPos,
    activeRow,
    filteredKeys,
    filteredValues,
    setRows,
    handleAddRow,
    handleAddMultipleRows,
    handleRemoveRow,
    handleRowChange,
    handleInputFocusOrChange,
    handleSave,
  };
};
