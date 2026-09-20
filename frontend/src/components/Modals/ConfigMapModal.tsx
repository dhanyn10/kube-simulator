import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, HelpCircle } from 'lucide-react';
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

interface KeyDefinition {
  key: string;
  label: string;
  valueOptions: { value: string; label: string }[];
  defaultValue: string;
  hint: string;
}

const PREDEFINED_KEYS: KeyDefinition[] = [
  {
    key: 'PORT',
    label: 'PORT',
    defaultValue: '80',
    valueOptions: [
      { value: '80', label: '80 (Standard HTTP)' },
      { value: '8080', label: '8080 (Alt Web Server)' },
      { value: '3000', label: '3000 (Node.js/React)' },
      { value: '5000', label: '5000 (Flask/Python)' },
      { value: '8443', label: '8443 (HTTPS)' },
    ],
    hint: 'Container listening port. Must match Service targetPort.',
  },
  {
    key: 'MAX_CONNECTIONS',
    label: 'MAX_CONNECTIONS',
    defaultValue: '1000',
    valueOptions: [
      { value: '100', label: '100 RPS (Low Limit - Throttling)' },
      { value: '500', label: '500 RPS (Medium Limit)' },
      { value: '1000', label: '1000 RPS (Standard High Limit)' },
      { value: '5000', label: '5000 RPS (Enterprise Scale)' },
    ],
    hint: 'Maximum traffic capacity limit in RPS. Excess traffic gets throttled.',
  },
  {
    key: 'LOG_LEVEL',
    label: 'LOG_LEVEL',
    defaultValue: 'INFO',
    valueOptions: [
      { value: 'INFO', label: 'INFO (Standard Activity Logs)' },
      { value: 'DEBUG', label: 'DEBUG (Verbose Diagnostics)' },
      { value: 'WARN', label: 'WARN (Warning Highlights Only)' },
      { value: 'ERROR', label: 'ERROR (Errors Only)' },
    ],
    hint: 'Controls verbosity level of terminal activity logs.',
  },
  {
    key: 'CHAOS_MODE',
    label: 'CHAOS_MODE',
    defaultValue: 'disabled',
    valueOptions: [
      { value: 'disabled', label: 'disabled (Normal Operation)' },
      { value: 'enabled', label: 'enabled (Simulate CrashLoopBackOff)' },
    ],
    hint: 'Enables or disables simulated pod failures.',
  },
];

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
  const [rows, setRows] = useState<ConfigRow[]>([]);

  useEffect(() => {
    if (initialConfigMap && initialConfigMap.configData && initialConfigMap.configData.length > 0) {
      setCmName(initialConfigMap.name || 'app-config');
      const loadedRows: ConfigRow[] = initialConfigMap.configData.map((item, idx) => {
        const uppercaseKey = item.key.toUpperCase();
        const isValidKey = PREDEFINED_KEYS.some((pk) => pk.key === uppercaseKey);
        return {
          id: `row-${idx}-${Date.now()}`,
          key: isValidKey ? uppercaseKey : 'PORT',
          value: item.value,
        };
      });
      setRows(loadedRows);
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      setCmName(`cm-${randomSuffix}`);
      setRows([]);
    }
  }, [initialConfigMap, isOpen, targetNodeId]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    const defaultKeyDef = PREDEFINED_KEYS[0];
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
        key: defaultKeyDef.key,
        value: defaultKeyDef.defaultValue,
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleKeyChange = (id: string, newKey: string) => {
    const keyDef = PREDEFINED_KEYS.find((pk) => pk.key === newKey) || PREDEFINED_KEYS[0];
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, key: newKey, value: keyDef.defaultValue } : row
      )
    );
  };

  const handleValueChange = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, value } : row))
    );
  };

  const handleSave = () => {
    const configData = rows
      .map((row) => ({ key: row.key, value: row.value.trim() }))
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
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-md transition-all cursor-pointer"
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
              colorMode === 'dark'
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
              <p className="text-[11px] text-slate-400">Specify Key and Value pairs for simulation parameters.</p>
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
            colorMode === 'dark' ? "bg-slate-900/90 border-slate-800" : "bg-slate-100 border-slate-300"
          )}>
            <div className="w-1/2">Key</div>
            <div className="w-1/2">Value</div>
            <div className="w-8 shrink-0"></div>
          </div>

          {rows.length === 0 ? (
            <div className={cn(
              "p-6 text-center border rounded-b-lg border-dashed text-xs",
              colorMode === 'dark' ? "border-slate-800 text-slate-500" : "border-slate-300 text-slate-400"
            )}>
              No key-value pairs added. Click <span className="font-semibold text-teal-400">"+ Add Row"</span> above to add an entry.
            </div>
          ) : (
            <div className="border rounded-b-lg divide-y divide-slate-800/60 max-h-[40vh] overflow-y-auto custom-scrollbar">
              {rows.map((row) => {
                const selectedKeyInfo = PREDEFINED_KEYS.find((pk) => pk.key === row.key) || PREDEFINED_KEYS[0];

                return (
                  <div
                    key={row.id}
                    className={cn(
                      "p-2.5 space-y-1.5 transition-all",
                      colorMode === 'dark'
                        ? "bg-slate-900/40 hover:bg-slate-900/80"
                        : "bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Key Dropdown */}
                      <div className="w-1/2">
                        <select
                          id={`cm-key-select-${row.id}`}
                          aria-label="Key"
                          value={row.key}
                          onChange={(e) => handleKeyChange(row.id, e.target.value)}
                          className={cn(
                            "w-full px-2.5 py-1.5 rounded border text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500/50",
                            colorMode === 'dark'
                              ? "bg-slate-950 border-slate-700 text-slate-200"
                              : "bg-slate-50 border-slate-300 text-slate-800"
                          )}
                        >
                          {PREDEFINED_KEYS.map((pk) => (
                            <option key={pk.key} value={pk.key}>
                              {pk.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Value Dropdown Select */}
                      <div className="w-1/2">
                        <select
                          id={`cm-val-select-${row.id}`}
                          aria-label="Value"
                          value={row.value}
                          onChange={(e) => handleValueChange(row.id, e.target.value)}
                          className={cn(
                            "w-full px-2.5 py-1.5 rounded border text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500/50",
                            colorMode === 'dark'
                              ? "bg-slate-950 border-slate-700 text-slate-100"
                              : "bg-slate-50 border-slate-300 text-slate-900"
                          )}
                        >
                          {selectedKeyInfo.valueOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
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
                    {selectedKeyInfo.hint && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pl-1">
                        <HelpCircle className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span>{selectedKeyInfo.hint}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
