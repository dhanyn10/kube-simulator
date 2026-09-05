import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { Modal } from './Modal';
import { K8sHpaItem } from '../../types';
import { useFlowStore } from '../../store';
import { cn, sanitizeSlug } from '../../lib/utils';

interface HPAModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNodeId: string | null;
  targetNodeLabel?: string;
  initialHpa?: K8sHpaItem | null;
  onSave: (hpaItem: K8sHpaItem) => void;
}

export const HPAModal: React.FC<HPAModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  initialHpa,
  onSave,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  const [hpaName, setHpaName] = useState<string>('app-hpa');
  const [minReplicas, setMinReplicas] = useState<number>(1);
  const [maxReplicas, setMaxReplicas] = useState<number>(10);
  const [targetCPU, setTargetCPU] = useState<number>(80);
  const [targetMemory, setTargetMemory] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (initialHpa) {
      setHpaName(initialHpa.name || 'app-hpa');
      setMinReplicas(initialHpa.minReplicas ?? 1);
      setMaxReplicas(initialHpa.maxReplicas ?? 10);
      setTargetCPU(initialHpa.targetCPU ?? 80);
      setTargetMemory(initialHpa.targetMemory);
    } else {
      const randomSuffix = crypto.randomUUID().split('-')[0];
      setHpaName(`hpa-${randomSuffix}`);
      setMinReplicas(1);
      setMaxReplicas(10);
      setTargetCPU(80);
      setTargetMemory(undefined);
    }
  }, [initialHpa, isOpen, targetNodeId]);

  if (!isOpen) return null;

  const handleSave = () => {
    const minVal = Math.max(1, Number(minReplicas) || 1);
    const maxVal = Math.max(minVal, Number(maxReplicas) || 10);
    const cpuVal = Math.min(100, Math.max(1, Number(targetCPU) || 80));
    const memVal = targetMemory !== undefined && targetMemory !== null && targetMemory > 0
      ? Math.min(100, Math.max(1, Number(targetMemory)))
      : undefined;

    const hpaItem: K8sHpaItem = {
      id: initialHpa?.id || `hpa-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      name: sanitizeSlug(hpaName) || 'unnamed-hpa',
      minReplicas: minVal,
      maxReplicas: maxVal,
      targetCPU: cpuVal,
      ...(memVal !== undefined ? { targetMemory: memVal } : {}),
    };
    onSave(hpaItem);
    onClose();
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
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
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-md transition-all"
      >
        {initialHpa ? 'Update HPA' : 'Attach HPA'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialHpa ? 'Edit HPA Autoscaling' : 'Attach HPA Autoscaling'}
      subtitle={targetNodeLabel ? `Target card: ${targetNodeLabel}` : 'Configure HorizontalPodAutoscaler'}
      icon={Activity}
      iconColorClass="text-fuchsia-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[70vh]"
      footer={footer}
    >
      <div className="space-y-4">
        {/* HPA Name */}
        <div>
          <label htmlFor="hpa-name-input" className="block text-xs font-semibold mb-1 text-slate-400">
            HPA Name
          </label>
          <input
            id="hpa-name-input"
            type="text"
            value={hpaName}
            onChange={(e) => setHpaName(e.target.value)}
            placeholder="e.g. app-hpa"
            className={cn(
              "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all",
              colorMode === 'dark'
                ? "bg-slate-950 border-slate-800 text-slate-100"
                : "bg-slate-50 border-slate-300 text-slate-900"
            )}
          />
        </div>

        {/* Replica Limits */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="hpa-min-replicas" className="block text-xs font-semibold mb-1 text-slate-400">
              Min Replicas
            </label>
            <input
              id="hpa-min-replicas"
              type="number"
              min={1}
              value={minReplicas}
              onChange={(e) => setMinReplicas(Number.parseInt(e.target.value, 10) || 1)}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all",
                colorMode === 'dark'
                  ? "bg-slate-950 border-slate-800 text-slate-100"
                  : "bg-slate-50 border-slate-300 text-slate-900"
              )}
            />
          </div>
          <div>
            <label htmlFor="hpa-max-replicas" className="block text-xs font-semibold mb-1 text-slate-400">
              Max Replicas
            </label>
            <input
              id="hpa-max-replicas"
              type="number"
              min={minReplicas}
              value={maxReplicas}
              onChange={(e) => setMaxReplicas(Number.parseInt(e.target.value, 10) || 10)}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all",
                colorMode === 'dark'
                  ? "bg-slate-950 border-slate-800 text-slate-100"
                  : "bg-slate-50 border-slate-300 text-slate-900"
              )}
            />
          </div>
        </div>

        {/* Target CPU & Memory Thresholds */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="hpa-target-cpu" className="block text-xs font-semibold mb-1 text-slate-400">
              Target CPU Utilization (%)
            </label>
            <input
              id="hpa-target-cpu"
              type="number"
              min={1}
              max={100}
              value={targetCPU}
              onChange={(e) => setTargetCPU(Number.parseInt(e.target.value, 10) || 80)}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all",
                colorMode === 'dark'
                  ? "bg-slate-950 border-slate-800 text-slate-100"
                  : "bg-slate-50 border-slate-300 text-slate-900"
              )}
            />
          </div>
          <div>
            <label htmlFor="hpa-target-memory" className="block text-xs font-semibold mb-1 text-slate-400">
              Target Memory Utilization (%) (Optional)
            </label>
            <input
              id="hpa-target-memory"
              type="number"
              min={1}
              max={100}
              value={targetMemory ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setTargetMemory(val === '' ? undefined : Number.parseInt(val, 10));
              }}
              placeholder="e.g. 80"
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-fuchsia-500/50 transition-all",
                colorMode === 'dark'
                  ? "bg-slate-950 border-slate-800 text-slate-100"
                  : "bg-slate-50 border-slate-300 text-slate-900"
              )}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
