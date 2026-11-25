import { useState, useRef, useEffect, type Ref } from 'react';
import { Box, Search, Gauge, HardDrive, Zap, Cpu, Check, Copy } from 'lucide-react';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/Modals/Modal';
import { DEFAULT_REGISTRY_IMAGES, type RegistryImageItem } from '@/constants/config';
import { getImageCharacteristics } from '@/activities/ui/imageCharacteristicsHelpers';

/** Props interface for the ResourceManager modal component. */
export interface ResourceManagerProps {
  /** Controls modal visibility state. */
  readonly isOpen: boolean;
  /** Callback fired when the modal is closed. */
  readonly onClose: () => void;
  /** Optional target image name to auto-focus and highlight. */
  readonly targetImage?: string | null;
}

const getItemCardClass = (isTarget: boolean, colorMode: 'dark' | 'light'): string => {
  if (isTarget) {
    return "ring-2 ring-blue-500 border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10";
  }
  return colorMode === 'dark'
    ? "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
    : "bg-white border-slate-200/80 hover:border-slate-300 shadow-sm";
};

/** Props for a single runtime setup image card on the Resource Manager list. */
interface SetupImageItemProps {
  /** The setup image item rendered by this card. */
  readonly item: RegistryImageItem;
  /** Whether this item is the currently focused/target image. */
  readonly isTarget: boolean;
  /** Whether the canvas node is selected (Apply Image) or not (Copy). */
  readonly isTargetNodeSelected: boolean;
  /** Image name recently copied (used to render the Copied state). */
  readonly copiedImage: string | null;
  /** Active color mode. */
  readonly colorMode: 'dark' | 'light';
  /** Ref for the item card (applied when it is the target). */
  readonly itemRef?: Ref<HTMLDivElement>;
  /** Ref for the Apply Image button (applied when it is the target). */
  readonly applyButtonRef?: Ref<HTMLButtonElement>;
  /** Called with the image name when the user selects it. */
  readonly onSelectImage: (imageName: string) => void;
  /** Called with the image name when the user copies it. */
  readonly onCopyImage: (imageName: string) => void;
}

/** Props for the Apply Image / Copy action button of a setup image card. */
interface SetupImageActionProps {
  /** The setup image name this action applies to. */
  readonly imageName: string;
  /** Whether this card is the target/focused image. */
  readonly isTarget: boolean;
  /** Whether the canvas node is selected (Apply Image) or not (Copy). */
  readonly isSelectedNode: boolean;
  /** Image name recently copied (used to render the Copied state). */
  readonly copiedImageName: string | null;
  /** Active color mode. */
  readonly colorMode: 'dark' | 'light';
  /** Ref for the Apply Image button (applied when this card is the target). */
  readonly applyButtonRef?: Ref<HTMLButtonElement>;
  /** Called with the image name when the user selects it. */
  readonly onSelectImage: (imageName: string) => void;
  /** Called with the image name when the user copies it. */
  readonly onCopyImage: (imageName: string) => void;
}

/** The Apply Image or Copy action of a setup image card. */
const SetupImageAction = ({
  imageName,
  isTarget,
  isSelectedNode,
  copiedImageName,
  colorMode,
  applyButtonRef,
  onSelectImage,
  onCopyImage,
}: SetupImageActionProps) =>
  isSelectedNode ? (
    <button
      type="button"
      ref={isTarget ? applyButtonRef : undefined}
      onClick={() => onSelectImage(imageName)}
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
  ) : (
    <button
      type="button"
      onClick={() => onCopyImage(imageName)}
      className={cn(
        "px-3 py-1 rounded-lg text-[11px] font-bold font-mono transition-all flex items-center gap-1.5 shrink-0",
        colorMode === 'dark'
          ? "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700"
          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
      )}
    >
      {copiedImageName === imageName ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
      <span>{copiedImageName === imageName ? 'Copied' : 'Copy'}</span>
    </button>
  );

/**
 * A single runtime setup image card on the Resource Manager list.
 */
const SetupImageItem = ({
  item,
  isTarget,
  isTargetNodeSelected,
  copiedImage,
  colorMode,
  itemRef,
  applyButtonRef,
  onSelectImage,
  onCopyImage,
}: SetupImageItemProps) => {
  const chars = item.characteristics;

  return (
    <div
      ref={isTarget ? itemRef : undefined}
      data-testid={`resource-manager-item-${item.name}`}
      className={cn(
        "p-3 rounded-xl border transition-all duration-150 flex flex-col gap-2.5",
        getItemCardClass(isTarget, colorMode)
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono">
          <Box size={14} className={isTarget ? "text-blue-400 shrink-0" : "text-blue-500 shrink-0"} />
          <span className={cn("text-xs font-bold", colorMode === 'dark' ? "text-slate-200" : "text-slate-800")}>
            {item.name}
          </span>
          {isTarget && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500 text-white tracking-wider">
              Focused
            </span>
          )}
        </div>

        <SetupImageAction
          imageName={item.name}
          isTarget={isTarget}
          isSelectedNode={isTargetNodeSelected}
          copiedImageName={copiedImage}
          colorMode={colorMode}
          applyButtonRef={applyButtonRef}
          onSelectImage={onSelectImage}
          onCopyImage={onCopyImage}
        />
      </div>

      <p className={cn("text-[11px]", colorMode === 'dark' ? "text-slate-400" : "text-slate-600")}>
        {item.desc}
      </p>

      <SetupImageStatsGrid chars={chars} colorMode={colorMode} />
    </div>
  );
};

/** Props for the simulator variable stats grid shown on setup image cards. */
interface SetupImageStatsGridProps {
  /** Characteristics whose simulator variables are displayed. */
  readonly chars: RegistryImageItem['characteristics'];
  /** Active color mode. */
  readonly colorMode: 'dark' | 'light';
}

/**
 * Numerical grid of simulator variables (traffic, RAM, start delay, CPU) for setup image cards.
 */
const SetupImageStatsGrid = ({ chars, colorMode }: SetupImageStatsGridProps) => (
  <div className={cn("grid grid-cols-4 gap-2 pt-1 border-t font-mono text-[10px]", colorMode === 'dark' ? "border-slate-800/40" : "border-slate-200")}>
    <div className={cn("flex items-center gap-1.5 p-1.5 rounded-lg border", colorMode === 'dark' ? "bg-slate-950/50 border-slate-800/60 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700")}>
      <Gauge size={12} className="text-emerald-400 shrink-0" />
      <span className="text-slate-500">TRF:</span>
      <span className="font-semibold text-emerald-400 truncate">
        {chars.maxTrafficRpm.toLocaleString()} req/min
      </span>
    </div>

    <div className={cn("flex items-center gap-1.5 p-1.5 rounded-lg border", colorMode === 'dark' ? "bg-slate-950/50 border-slate-800/60 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700")}>
      <HardDrive size={12} className="text-blue-400 shrink-0" />
      <span className="text-slate-500">RAM:</span>
      <span className="font-semibold truncate">
        {chars.baseMemoryMiB} MiB
      </span>
    </div>

    <div className={cn("flex items-center gap-1.5 p-1.5 rounded-lg border", colorMode === 'dark' ? "bg-slate-950/50 border-slate-800/60 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700")}>
      <Zap size={12} className="text-amber-400 shrink-0" />
      <span className="text-slate-500">START:</span>
      <span className="font-semibold truncate">
        {chars.startupDelayTicks} ticks
      </span>
    </div>

    <div className={cn("flex items-center gap-1.5 p-1.5 rounded-lg border", colorMode === 'dark' ? "bg-slate-950/50 border-slate-800/60 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700")}>
      <Cpu size={12} className="text-purple-400 shrink-0" />
      <span className="text-slate-500">CPU:</span>
      <span className="font-semibold truncate">
        {chars.cpuPer1kTrafficMilli}m/1k
      </span>
    </div>
  </div>
);

/**
 * ResourceManager is the modal component for displaying all container runtime setup images
 * with their exact simulator engine variables and allowing direct image selection for workloads.
 *
 * @param props - Modal visibility and callback props.
 * @returns Renderable React modal element or null if closed.
 */
export const ResourceManager = ({ isOpen, onClose, targetImage }: ResourceManagerProps) => {
  const [search, setSearch] = useState('');
  const [copiedImage, setCopiedImage] = useState<string | null>(null);
  const targetItemRef = useRef<HTMLDivElement | null>(null);
  const targetButtonRef = useRef<HTMLButtonElement | null>(null);

  const colorMode = useFlowStore((state) => state.colorMode);
  const customImages = useFlowStore((state) => state.customImages);
  const addCustomImage = useFlowStore((state) => state.addCustomImage);
  const selectedNodeId = useFlowStore((state) => state.configuringNodeId);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const storeTargetImage = useFlowStore((state) => state.resourceManagerTargetImage);

  const activeTargetImage = targetImage ?? storeTargetImage;

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setCopiedImage(null);
      return;
    }
    if (activeTargetImage) {
      setSearch('');
      const timer = setTimeout(() => {
        targetItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTargetImage]);

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

  const handleCopyImage = (imageName: string) => {
    void navigator.clipboard?.writeText(imageName);
    setCopiedImage(imageName);
    setTimeout(() => {
      setCopiedImage((prev) => (prev === imageName ? null : prev));
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resource Manager"
      icon={Box}
      widthClass="w-[720px]"
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
          {filteredImages.map((item) => (
            <SetupImageItem
              key={item.name}
              item={item}
              isTarget={activeTargetImage === item.name}
              isTargetNodeSelected={Boolean(selectedNodeId)}
              copiedImage={copiedImage}
              colorMode={colorMode}
              itemRef={targetItemRef}
              applyButtonRef={targetButtonRef}
              onSelectImage={handleSelectImage}
              onCopyImage={handleCopyImage}
            />
          ))}

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
