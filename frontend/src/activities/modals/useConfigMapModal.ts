import { useState, useEffect, useRef } from 'react';
import { K8sConfigMapItem } from '@/types';
import { useFlowStore } from '@/store';
import { sanitizeSlug } from '@/lib/utils';
import { useKeyValueModalState } from './useKeyValueModalState';

export interface ConfigRow {
  readonly id: string;
  readonly key: string;
  readonly value: string;
}

export interface KeySuggestion {
  readonly key: string;
  readonly label: string;
  readonly valueSuggestions: readonly { readonly value: string; readonly label: string; readonly description: string }[];
  readonly hint: string;
}

export const PREDEFINED_KEYS: readonly KeySuggestion[] = [
  {
    key: 'PORT',
    label: 'PORT',
    valueSuggestions: [
      { value: '80', label: '80', description: 'Standard HTTP Port' },
      { value: '8080', label: '8080', description: 'Alt Web Server Port' },
      { value: '3000', label: '3000', description: 'Node.js / React Port' },
      { value: '5000', label: '5000', description: 'Flask / Python Port' },
      { value: '8443', label: '8443', description: 'HTTPS Secure Port' },
    ],
    hint: 'Container listening port. Must match Service targetPort.',
  },
  {
    key: 'MAX_CONNECTIONS',
    label: 'MAX_CONNECTIONS',
    valueSuggestions: [
      { value: '100', label: '100', description: '100 RPS (Low Limit - Throttling)' },
      { value: '500', label: '500', description: '500 RPS (Medium Limit)' },
      { value: '1000', label: '1000', description: '1000 RPS (Standard High Limit)' },
      { value: '5000', label: '5000', description: '5000 RPS (Enterprise Scale)' },
    ],
    hint: 'Maximum traffic capacity limit in RPS. Excess traffic gets throttled.',
  },
  {
    key: 'LOG_LEVEL',
    label: 'LOG_LEVEL',
    valueSuggestions: [
      { value: 'INFO', label: 'INFO', description: 'Standard Activity Logs' },
      { value: 'DEBUG', label: 'DEBUG', description: 'Verbose Diagnostics' },
      { value: 'WARN', label: 'WARN', description: 'Warning Highlights Only' },
      { value: 'ERROR', label: 'ERROR', description: 'Errors Only' },
    ],
    hint: 'Controls verbosity level of terminal activity logs.',
  },
  {
    key: 'CHAOS_MODE',
    label: 'CHAOS_MODE',
    valueSuggestions: [
      { value: 'disabled', label: 'disabled', description: 'Normal Operation' },
      { value: 'enabled', label: 'enabled', description: 'Simulate CrashLoopBackOff' },
    ],
    hint: 'Enables or disables simulated pod failures.',
  },
];

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

  const [cmName, setCmName] = useState<string>('app-config');

  const {
    dataItems: rows,
    setDataItems: setRows,
    handleAddField: handleAddRow,
    handleRemoveField,
    handleUpdateField: handleRowChange,
    getValidData,
  } = useKeyValueModalState('cm', []);

  // Autocomplete state
  const [activeDropdown, setActiveDropdown] = useState<{ readonly rowId: string; readonly field: 'key' | 'value' } | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ readonly top: number; readonly left: number; readonly width: number } | null>(null);
  const activeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialConfigMap?.configData?.length) {
      setCmName(initialConfigMap.name || 'app-config');
      const loadedRows: ConfigRow[] = initialConfigMap.configData.map((item, idx) => ({
        id: `row-${idx}-${Date.now()}`,
        key: item.key,
        value: item.value,
      }));
      setRows(loadedRows);
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      setCmName(`cm-${randomSuffix}`);
      setRows([]);
    }
  }, [initialConfigMap, isOpen, targetNodeId, setRows]);

  const updateDropdownPos = (inputElem: HTMLInputElement) => {
    const rect = inputElem.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  };

  const handleInputFocusOrChange = (
    elem: HTMLInputElement,
    rowId: string,
    field: 'key' | 'value',
    value?: string
  ) => {
    if (value !== undefined) {
      handleRowChange(rowId, field, value);
    }
    activeInputRef.current = elem;
    updateDropdownPos(elem);
    setActiveDropdown({ rowId, field });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const popupElem = document.getElementById('configmap-autocomplete-portal');
      if (
        popupElem && !popupElem.contains(e.target as Node) &&
        activeInputRef.current && !activeInputRef.current.contains(e.target as Node)
      ) {
        setActiveDropdown(null);
      }
    };
    const handleScrollOrResize = () => {
      if (activeInputRef.current && activeDropdown) {
        updateDropdownPos(activeInputRef.current);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeDropdown]);

  const handleRemoveRow = (id: string) => {
    handleRemoveField(id);
    if (activeDropdown?.rowId === id) {
      setActiveDropdown(null);
    }
  };

  const handleSave = () => {
    const configData = getValidData();

    const configMapItem: K8sConfigMapItem = {
      id: initialConfigMap?.id || `cm-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      name: sanitizeSlug(cmName) || 'unnamed-configmap',
      configData,
    };
    onSave(configMapItem);
    onClose();
  };

  // Active row and filtering for autocomplete portal
  const activeRow = rows.find((r) => r.id === activeDropdown?.rowId);
  const activeKeyInfo = activeRow ? PREDEFINED_KEYS.find((pk) => pk.key === activeRow.key.trim().toUpperCase()) : null;

  const filteredKeys = activeRow
    ? PREDEFINED_KEYS.filter((pk) => pk.key.toLowerCase().includes(activeRow.key.toLowerCase()))
    : [];

  const valueOpts = activeKeyInfo ? activeKeyInfo.valueSuggestions : [];
  const filteredValues = activeRow
    ? valueOpts.filter(
        (opt) =>
          opt.value.toLowerCase().includes(activeRow.value.toLowerCase()) ||
          opt.description.toLowerCase().includes(activeRow.value.toLowerCase())
      )
    : [];

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
