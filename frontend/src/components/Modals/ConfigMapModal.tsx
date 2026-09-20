import React, { useState, useEffect, useRef } from 'react';
import { Settings, Plus, Trash2, HelpCircle, TerminalSquare } from 'lucide-react';
import { createPortal } from 'react-dom';
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

interface ConfigRow {
  id: string;
  key: string;
  value: string;
}

interface KeySuggestion {
  key: string;
  label: string;
  valueSuggestions: { value: string; label: string; description: string }[];
  hint: string;
}

const PREDEFINED_KEYS: KeySuggestion[] = [
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

interface AutocompleteOptionItemProps {
  readonly testId: string;
  readonly primaryText: string;
  readonly secondaryText?: string;
  readonly badgeText?: string;
  readonly isDark: boolean;
  readonly onSelect: () => void;
}

const AutocompleteOptionItem: React.FC<AutocompleteOptionItemProps> = ({
  testId,
  primaryText,
  secondaryText,
  badgeText,
  isDark,
  onSelect,
}) => (
  <button
    type="button"
    data-testid={testId}
    onMouseDown={(e) => {
      e.preventDefault();
      onSelect();
    }}
    className={cn(
      "w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer",
      isDark ? "hover:bg-slate-800/80 text-slate-200" : "hover:bg-blue-50 text-slate-800"
    )}
  >
    <div className="flex items-center gap-2 overflow-hidden">
      <TerminalSquare size={12} className="text-teal-400 shrink-0" />
      <span className="font-semibold text-[11px]">{primaryText}</span>
    </div>
    {badgeText && (
      <span className={cn(
        "text-[8px] uppercase px-1 py-0.5 rounded font-bold tracking-wider",
        isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
      )}>
        {badgeText}
      </span>
    )}
    {secondaryText && (
      <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
        {secondaryText}
      </span>
    )}
  </button>
);

export const ConfigMapModal: React.FC<ConfigMapModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  initialConfigMap,
  onSave,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const isDark = colorMode === 'dark';

  const [cmName, setCmName] = useState<string>('app-config');
  const [rows, setRows] = useState<ConfigRow[]>([]);

  // Autocomplete state
  const [activeDropdown, setActiveDropdown] = useState<{ rowId: string; field: 'key' | 'value' } | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
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
  }, [initialConfigMap, isOpen, targetNodeId]);

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

  if (!isOpen) return null;

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
        key: '',
        value: '',
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (activeDropdown?.rowId === id) {
      setActiveDropdown(null);
    }
  };

  const handleRowChange = (id: string, field: keyof ConfigRow, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleSave = () => {
    const configData = rows
      .map((row) => ({ key: row.key.trim(), value: row.value.trim() }))
      .filter((item) => item.key.length > 0);

    const configMapItem: K8sConfigMapItem = {
      id: initialConfigMap?.id || `cm-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      name: sanitizeSlug(cmName) || 'unnamed-configmap',
      configData,
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
          isDark
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

  // Active row for autocomplete portal
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialConfigMap ? 'Edit ConfigMap' : 'Attach ConfigMap'}
      subtitle={targetNodeLabel ? `Target card: ${targetNodeLabel}` : 'Configure Key-Value Data'}
      icon={Settings}
      iconColorClass="text-teal-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[75vh]"
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
              isDark
                ? "bg-slate-950 border-slate-800 text-slate-100"
                : "bg-slate-50 border-slate-300 text-slate-900"
            )}
          />
        </div>

        {/* Postman-style Key-Value Table */}
        <div className="space-y-3 pt-2 border-t border-slate-800/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-300">Data (Key-Value)</p>
              <p className="text-[11px] text-slate-400">Type text or choose suggestions from dropdown for simulation parameters.</p>
            </div>
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-teal-600/20 text-teal-400 border border-teal-500/30 hover:bg-teal-600/30 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          {/* Table Header */}
          <div className={cn(
            "rounded-t-lg border border-b-0 px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-400 font-mono uppercase tracking-wider",
            isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-100 border-slate-300"
          )}>
            <div className="w-1/2">Key</div>
            <div className="w-1/2">Value</div>
            <div className="w-8 shrink-0"></div>
          </div>

          {rows.length === 0 ? (
            <div className={cn(
              "p-6 text-center border rounded-b-lg border-dashed text-xs",
              isDark ? "border-slate-800 text-slate-500" : "border-slate-300 text-slate-400"
            )}>
              No key-value pairs added. Click <span className="font-semibold text-teal-400">"+ Add Row"</span> above to add an entry.
            </div>
          ) : (
            <div className="border rounded-b-lg divide-y divide-slate-800/60 max-h-[35vh] overflow-y-auto custom-scrollbar">
              {rows.map((row) => {
                const upperKey = row.key.trim().toUpperCase();
                const matchedKeyInfo = PREDEFINED_KEYS.find((pk) => pk.key === upperKey);

                return (
                  <div
                    key={row.id}
                    className={cn(
                      "p-2.5 space-y-1.5 transition-all relative",
                      isDark
                        ? "bg-slate-900/40 hover:bg-slate-900/80"
                        : "bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Key Field with Fixed Portal Dropdown */}
                      <div className="w-1/2">
                        <input
                          id={`cm-key-input-${row.id}`}
                          aria-label="Key"
                          type="text"
                          value={row.key}
                          onFocus={(e) => handleInputFocusOrChange(e.currentTarget, row.id, 'key')}
                          onChange={(e) => handleInputFocusOrChange(e.currentTarget, row.id, 'key', e.target.value)}
                          placeholder="e.g. PORT, LOG_LEVEL"
                          className={cn(
                            "w-full px-2.5 py-1.5 rounded border text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500/50",
                            isDark
                              ? "bg-slate-950 border-slate-700 text-slate-200"
                              : "bg-slate-50 border-slate-300 text-slate-800"
                          )}
                        />
                      </div>

                      {/* Value Field with Fixed Portal Dropdown */}
                      <div className="w-1/2">
                        <input
                          id={`cm-val-input-${row.id}`}
                          aria-label="Value"
                          type="text"
                          value={row.value}
                          onFocus={(e) => handleInputFocusOrChange(e.currentTarget, row.id, 'value')}
                          onChange={(e) => handleInputFocusOrChange(e.currentTarget, row.id, 'value', e.target.value)}
                          placeholder="e.g. 80, INFO, enabled"
                          className={cn(
                            "w-full px-2.5 py-1.5 rounded border text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500/50",
                            isDark
                              ? "bg-slate-950 border-slate-700 text-slate-100"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          )}
                        />
                      </div>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer shrink-0"
                        title="Remove row"
                        aria-label="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Educational Hint */}
                    {matchedKeyInfo?.hint && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pl-1">
                        <HelpCircle className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>{matchedKeyInfo.hint}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Viewport Fixed Autocomplete Portal (Renders above all scroll containers without clipping) */}
      {activeDropdown && dropdownPos && activeRow && createPortal(
        <div
          id="configmap-autocomplete-portal"
          style={{
            position: 'fixed',
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
            zIndex: 9999,
          }}
          className={cn(
            "max-h-48 overflow-y-auto rounded-md shadow-2xl border font-mono text-[11px] divide-y custom-scrollbar animate-in fade-in-50 duration-100",
            isDark
              ? "bg-slate-900 border-slate-700 text-slate-200 divide-slate-800"
              : "bg-white border-slate-200 text-slate-800 divide-slate-100"
          )}
        >
          {activeDropdown.field === 'key' && filteredKeys.map((item) => (
            <AutocompleteOptionItem
              key={`portal-key-${item.key}`}
              testId={`key-option-${item.key}`}
              primaryText={item.key}
              badgeText="KEY"
              isDark={isDark}
              onSelect={() => {
                handleRowChange(activeRow.id, 'key', item.key);
                setActiveDropdown(null);
              }}
            />
          ))}

          {activeDropdown.field === 'value' && filteredValues.map((opt) => (
            <AutocompleteOptionItem
              key={`portal-val-${opt.value}`}
              testId={`val-option-${opt.value}`}
              primaryText={opt.value}
              secondaryText={opt.description}
              isDark={isDark}
              onSelect={() => {
                handleRowChange(activeRow.id, 'value', opt.value);
                setActiveDropdown(null);
              }}
            />
          ))}
        </div>,
        document.body
      )}
    </Modal>
  );
};
