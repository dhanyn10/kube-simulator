import React from 'react';
import { Layers } from 'lucide-react';
import { Modal } from './Modal';
import { K8sResourceLimitItem } from '@/types';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';
import { SelectorGroup } from '@/components/UI/SelectorGroup';
import { useResourceLimitModal } from '@/activities/modals/useResourceLimitModal';
import { CPU_OPTIONS, MEMORY_OPTIONS } from '@/constants/config';

interface ResourceLimitModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly targetNodeId: string | null;
  readonly targetNodeLabel?: string;
  readonly initialResourceLimit?: K8sResourceLimitItem | null;
  readonly onSave: (resourceLimitItem: K8sResourceLimitItem) => void;
}

export const ResourceLimitModal: React.FC<ResourceLimitModalProps> = ({
  isOpen,
  onClose,
  targetNodeId,
  targetNodeLabel,
  initialResourceLimit,
  onSave,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);

  const {
    name,
    setName,
    cpuRequest,
    setCpuRequest,
    cpuLimit,
    setCpuLimit,
    memoryRequest,
    setMemoryRequest,
    memoryLimit,
    setMemoryLimit,
    handleSave,
  } = useResourceLimitModal(isOpen, targetNodeId, initialResourceLimit, onSave, onClose);

  if (!isOpen) return null;

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
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md transition-all"
      >
        {initialResourceLimit ? 'Update Resource Limit' : 'Attach Resource Limit'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialResourceLimit ? 'Edit Resource Limit' : 'Attach Resource Limit'}
      subtitle={targetNodeLabel ? `Target card: ${targetNodeLabel}` : 'Configure CPU and Memory limits/requests'}
      icon={Layers}
      iconColorClass="text-purple-400"
      widthClass="w-full max-w-3xl"
      maxHeightClass="h-[75vh]"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="res-limit-name-input" className="block text-xs font-semibold mb-1 text-slate-400">
            Resource Limit Name
          </label>
          <input
            id="res-limit-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. app-resource-limit"
            className={cn(
              "w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500/50 transition-all",
              colorMode === 'dark'
                ? "bg-slate-950 border-slate-800 text-slate-100"
                : "bg-slate-50 border-slate-300 text-slate-900"
            )}
          />
        </div>

        {/* CPU Request & Limit */}
        <div className="space-y-3 p-3 rounded-lg border border-slate-700/40 bg-slate-500/5">
          <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
            <Layers size={14} /> CPU Allocation
          </div>
          <div className="space-y-2">
            <div>
              <span className="block text-[10px] font-medium text-slate-400 mb-1">CPU Request</span>
              <SelectorGroup
                options={CPU_OPTIONS}
                currentValue={cpuRequest}
                onSelect={setCpuRequest}
                colorMode={colorMode}
              />
            </div>
            <div>
              <span className="block text-[10px] font-medium text-slate-400 mb-1">CPU Limit</span>
              <SelectorGroup
                options={CPU_OPTIONS}
                currentValue={cpuLimit}
                onSelect={setCpuLimit}
                colorMode={colorMode}
              />
            </div>
          </div>
        </div>

        {/* Memory Request & Limit */}
        <div className="space-y-3 p-3 rounded-lg border border-slate-700/40 bg-slate-500/5">
          <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
            <Layers size={14} /> Memory Allocation
          </div>
          <div className="space-y-2">
            <div>
              <span className="block text-[10px] font-medium text-slate-400 mb-1">Memory Request</span>
              <SelectorGroup
                options={MEMORY_OPTIONS}
                currentValue={memoryRequest}
                onSelect={setMemoryRequest}
                colorMode={colorMode}
              />
            </div>
            <div>
              <span className="block text-[10px] font-medium text-slate-400 mb-1">Memory Limit</span>
              <SelectorGroup
                options={MEMORY_OPTIONS}
                currentValue={memoryLimit}
                onSelect={setMemoryLimit}
                colorMode={colorMode}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
