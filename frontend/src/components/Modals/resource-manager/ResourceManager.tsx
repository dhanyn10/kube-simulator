import { useState } from 'react';
import { Box, Search, Gauge, HardDrive, Zap, Cpu, Check } from 'lucide-react';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/Modals/Modal';
import { DEFAULT_REGISTRY_IMAGES } from '@/constants/config';
import { getImageCharacteristics } from '@/activities/ui/imageCharacteristicsHelpers';

/** Props interface for the ResourceManager modal component. */
export interface ResourceManagerProps {
  /** Controls modal visibility state. */
  readonly isOpen: boolean;
  /** Callback fired when the modal is closed. */
  readonly onClose: () => void;
}

/**
 * ResourceManager is the modal component for displaying all container runtime setup images
 * with their exact simulator engine variables and allowing direct image selection for workloads.
 *
 * @param props - Modal visibility and callback props.
 * @returns Renderable React modal element or null if closed.
 */
export const ResourceManager = ({ isOpen, onClose }: ResourceManagerProps) => {
  const [search, setSearch] = useState('');

  const colorMode = useFlowStore((state) => state.colorMode);
  const customImages = useFlowStore((state) => state.customImages);
  const addCustomImage = useFlowStore((state) => state.addCustomImage);
  const selectedNodeId = useFlowStore((state) => state.configuringNodeId);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);

  // Combine default registry setup images and custom images into a single setup list
  const allImages = [
    ...DEFAULT_REGISTRY_IMAGES,
    ...customImages
      .filter((img) => !DEFAULT_REGISTRY_IMAGES.some((def) => def.name === img))
      .map((img) => ({
        name: img,
        desc: 'Custom registered container image',
        characteristics: getImageCharacteristics(img),
      })),
  ];

  const filteredImages = allImages.filter(
    (img) =>
      img.name.toLowerCase().includes(search.toLowerCase()) ||
      img.desc.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectImage = (imageName: string) => {
    addCustomImage(imageName);
    if (selectedNodeId) {
      updateNodeData(selectedNodeId, { image: imageName, status: 'ready' });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Runtime & Container Image Manager"
      icon={Box}
      widthClass="w-[720px]"
      maxHeightClass="h-[75vh]"
      disableScroll={true}
      compactHeader={true}
      footer={
        <div className="flex justify-between items-center w-full px-1 text-[10px] text-slate-500 font-medium font-mono">
          <span>Container Runtime Simulation Setup</span>
          <span>{filteredImages.length} Images Available</span>
        </div>
      }
    >
      <div className="flex flex-col h-full space-y-3 p-1">
        {/* Header Search */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search
              size={13}
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2",
                colorMode === 'dark' ? "text-slate-500" : "text-slate-400"
              )}
            />
            <input
              type="text"
              placeholder="Filter runtime setup images (e.g., node, golang, java, postgres)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full pl-9 pr-3 py-1.5 text-xs outline-none rounded-xl border font-mono transition-all",
                colorMode === 'dark'
                  ? "bg-slate-900 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50"
                  : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-400"
              )}
            />
          </div>
        </div>

        {/* Setup Images Grid */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar max-h-[50vh]">
          {filteredImages.map((item) => {
            const chars = item.characteristics || getImageCharacteristics(item.name);

            return (
              <div
                key={item.name}
                className={cn(
                  "p-3 rounded-xl border transition-all duration-150 flex flex-col gap-2.5",
                  colorMode === 'dark'
                    ? "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
                    : "bg-white border-slate-200/80 hover:border-slate-300 shadow-sm"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono">
                    <Box size={14} className="text-blue-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-200 dark:text-slate-200">
                      {item.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectImage(item.name)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[11px] font-bold font-mono transition-all flex items-center gap-1.5 shrink-0",
                      colorMode === 'dark'
                        ? "bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30"
                        : "bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200"
                    )}
                  >
                    <Check size={11} />
                    <span>Apply Image</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 dark:text-slate-400">
                  {item.desc}
                </p>

                {/* Simulator Variables Numerical Grid */}
                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800/40 font-mono text-[10px]">
                  <div className="flex items-center gap-1.5 bg-slate-800/30 dark:bg-slate-950/50 p-1.5 rounded-lg">
                    <Gauge size={12} className="text-emerald-400 shrink-0" />
                    <span className="text-slate-500">TRF:</span>
                    <span className="font-semibold text-emerald-400 truncate">
                      {chars.maxTrafficRpm.toLocaleString()} rpm
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-800/30 dark:bg-slate-950/50 p-1.5 rounded-lg">
                    <HardDrive size={12} className="text-blue-400 shrink-0" />
                    <span className="text-slate-500">RAM:</span>
                    <span className="font-semibold truncate">
                      {chars.baseMemoryMiB} MiB
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-800/30 dark:bg-slate-950/50 p-1.5 rounded-lg">
                    <Zap size={12} className="text-amber-400 shrink-0" />
                    <span className="text-slate-500">START:</span>
                    <span className="font-semibold truncate">
                      {chars.startupDelayTicks} ticks
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-800/30 dark:bg-slate-950/50 p-1.5 rounded-lg">
                    <Cpu size={12} className="text-purple-400 shrink-0" />
                    <span className="text-slate-500">CPU:</span>
                    <span className="font-semibold truncate">
                      {chars.cpuPer1kTrafficMilli}m/1k
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredImages.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs">
              No runtime images matched "{search}"
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
