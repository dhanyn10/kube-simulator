import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
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
  const [port, setPort] = useState<string>('80');
  const [maxConnections, setMaxConnections] = useState<string>('1000');
  const [logLevel, setLogLevel] = useState<string>('INFO');
  const [chaosMode, setChaosMode] = useState<string>('disabled');

  useEffect(() => {
    if (initialConfigMap) {
      setCmName(initialConfigMap.name || 'app-config');
      const dataMap = new Map((initialConfigMap.configData || []).map((item) => [item.key.toUpperCase(), item.value]));
      setPort(dataMap.get('PORT') || '80');
      setMaxConnections(dataMap.get('MAX_CONNECTIONS') || '1000');
      setLogLevel(dataMap.get('LOG_LEVEL')?.toUpperCase() || 'INFO');
      setChaosMode(dataMap.get('CHAOS_MODE')?.toLowerCase() === 'enabled' || dataMap.get('SIMULATE_FAILURE')?.toLowerCase() === 'true' ? 'enabled' : 'disabled');
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      setCmName(`cm-${randomSuffix}`);
      setPort('80');
      setMaxConnections('1000');
      setLogLevel('INFO');
      setChaosMode('disabled');
    }
  }, [initialConfigMap, isOpen, targetNodeId]);

  if (!isOpen) return null;

  const handleSave = () => {
    const configData = [
      { key: 'PORT', value: port },
      { key: 'MAX_CONNECTIONS', value: maxConnections },
      { key: 'LOG_LEVEL', value: logLevel },
      { key: 'CHAOS_MODE', value: chaosMode },
    ];

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
      maxHeightClass="h-[70vh]"
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

        {/* Structured Parameter Dropdowns */}
        <div className="space-y-3 pt-2 border-t border-slate-800/40">
          <p className="text-xs font-medium text-slate-400">
            Configure Simulation Parameters (Key-Value)
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* PORT */}
            <div>
              <label htmlFor="cm-port-select" className="block text-xs font-semibold mb-1 text-slate-400">
                Container Port (`PORT`)
              </label>
              <select
                id="cm-port-select"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500/50 transition-all",
                  colorMode === 'dark'
                    ? "bg-slate-950 border-slate-800 text-slate-100"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                )}
              >
                <option value="80">80 (Standard HTTP)</option>
                <option value="8080">8080 (Alt Web Server)</option>
                <option value="3000">3000 (Node.js/React)</option>
                <option value="5000">5000 (Flask/Python)</option>
                <option value="8443">8443 (HTTPS)</option>
              </select>
            </div>

            {/* MAX_CONNECTIONS */}
            <div>
              <label htmlFor="cm-max-conn-select" className="block text-xs font-semibold mb-1 text-slate-400">
                Max Capacity (`MAX_CONNECTIONS`)
              </label>
              <select
                id="cm-max-conn-select"
                value={maxConnections}
                onChange={(e) => setMaxConnections(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500/50 transition-all",
                  colorMode === 'dark'
                    ? "bg-slate-950 border-slate-800 text-slate-100"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                )}
              >
                <option value="100">100 RPS (Low Limit - Throttling)</option>
                <option value="500">500 RPS (Medium Limit)</option>
                <option value="1000">1000 RPS (Standard High Limit)</option>
                <option value="5000">5000 RPS (Enterprise Scale)</option>
              </select>
            </div>

            {/* LOG_LEVEL */}
            <div>
              <label htmlFor="cm-log-level-select" className="block text-xs font-semibold mb-1 text-slate-400">
                Logging Verbosity (`LOG_LEVEL`)
              </label>
              <select
                id="cm-log-level-select"
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500/50 transition-all",
                  colorMode === 'dark'
                    ? "bg-slate-950 border-slate-800 text-slate-100"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                )}
              >
                <option value="INFO">INFO (Standard Activity Logs)</option>
                <option value="DEBUG">DEBUG (Verbose Diagnostic Logs)</option>
                <option value="WARN">WARN (Warning Highlights Only)</option>
                <option value="ERROR">ERROR (Errors Only)</option>
              </select>
            </div>

            {/* CHAOS_MODE */}
            <div>
              <label htmlFor="cm-chaos-select" className="block text-xs font-semibold mb-1 text-slate-400">
                Chaos Mode (`CHAOS_MODE`)
              </label>
              <select
                id="cm-chaos-select"
                value={chaosMode}
                onChange={(e) => setChaosMode(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-teal-500/50 transition-all",
                  colorMode === 'dark'
                    ? "bg-slate-950 border-slate-800 text-slate-100"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                )}
              >
                <option value="disabled">Disabled (Normal Operation)</option>
                <option value="enabled">Enabled (Simulate CrashLoopBackOff)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
