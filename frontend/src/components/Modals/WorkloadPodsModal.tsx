import React, { useState, useMemo, useCallback } from 'react';
import {
  Boxes,
  Settings,
  Search,
  Copy,
  Check,
  Server,
  Layers,
  Box,
  RotateCcw,
  Terminal,
  Type,
  X,
} from 'lucide-react';
import { Modal } from './Modal';
import { useFlowStore } from '@/store';
import { cn, sanitizeSlug } from '@/lib/utils';
import { ConfigSection, NumberStepper, ConfigInput, ConfigLabel } from '@/components/UI/ConfigUI';
import { SelectorGroup } from '@/components/UI/SelectorGroup';
import { ImageDropdown } from '@/components/UI/ImageDropdown';
import {
  buildWorkloadPodList,
  filterWorkloadPods,
  getWorkerDistribution,
  resolveWorkloadController,
  WorkloadPodItem,
  WorkerDistributionCount,
} from '@/activities/modals/workloadPodsModalHelpers';
import { useWorkloadConfigHandler } from '@/activities/config';

export interface WorkloadPodsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly selectedNode: any;
}

type ModalTabType = 'setup' | 'pods';

const WORKLOAD_TYPES = [
  { id: 'Deployment', label: 'Deployment' },
  { id: 'StatefulSet', label: 'StatefulSet' },
] as const;

const RESTART_POLICIES = [
  { id: 'Always', label: 'Always' },
  { id: 'OnFailure', label: 'On Failure' },
  { id: 'Never', label: 'Never' },
] as const;

export const getWorkloadTabClass = (isActive: boolean, isDark: boolean): string => {
  if (isActive) {
    return 'bg-blue-600 text-white shadow-sm';
  }
  if (isDark) {
    return 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60';
  }
  return 'text-slate-600 hover:text-slate-900 hover:bg-slate-100';
};

export const getPodBadgeCountClass = (isActive: boolean, isDark: boolean): string => {
  if (isActive) {
    return 'bg-white/20 text-white';
  }
  return isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700';
};

interface WorkloadPodStatusBadgeProps {
  readonly status: 'Running' | 'Ready' | 'Pending';
}

const WorkloadPodStatusBadge: React.FC<WorkloadPodStatusBadgeProps> = ({ status }) => {
  const isRunning = status === 'Running';
  const isReady = status === 'Ready';

  let badgeColorClass = "bg-amber-500/10 text-amber-400";
  let dotColorClass = "bg-amber-400";

  if (isRunning) {
    badgeColorClass = "bg-emerald-500/10 text-emerald-400";
    dotColorClass = "bg-emerald-400 animate-pulse";
  } else if (isReady) {
    badgeColorClass = "bg-sky-500/10 text-sky-400";
    dotColorClass = "bg-sky-400";
  }

  return (
    <div
      className={cn(
        "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1",
        badgeColorClass
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", dotColorClass)} />
      {status}
    </div>
  );
};

interface WorkloadPodRowProps {
  readonly pod: WorkloadPodItem;
  readonly colorMode: 'dark' | 'light';
  readonly onCopy: (text: string) => void;
  readonly copiedName: string | null;
}

const WorkloadPodRow: React.FC<WorkloadPodRowProps> = ({
  pod,
  colorMode,
  onCopy,
  copiedName,
}) => {
  const isCopied = copiedName === pod.podName;
  const isDark = colorMode === 'dark';

  return (
    <div
      data-testid={`pod-row-${pod.index}`}
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border gap-2.5 transition-all",
        isDark
          ? "bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60"
          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
      )}
    >
      {/* Left: Pod Name */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="font-mono text-xs font-bold truncate text-slate-200">
          {pod.podName}
        </span>
        <button
          type="button"
          title="Copy Pod Name"
          data-testid={`copy-pod-name-${pod.index}`}
          onClick={() => onCopy(pod.podName)}
          className={cn(
            "p-1 rounded transition-colors text-[10px] flex items-center gap-1",
            isDark
              ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              : "hover:bg-slate-100 text-slate-500 hover:text-slate-700"
          )}
        >
          {isCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          <span className="sr-only">Copy name</span>
        </button>
      </div>

      {/* Right: Worker Node & Status */}
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <div
          data-testid={`pod-worker-badge-${pod.index}`}
          className={cn(
            "px-2 py-1 rounded-md text-[10px] font-bold font-mono border flex items-center gap-1.5",
            pod.workerInfo.badgeBg,
            pod.workerInfo.badgeText,
            pod.workerInfo.badgeBorder
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          <span>{pod.workerInfo.name.toUpperCase()}</span>
          <span className="opacity-70 text-[9px] font-normal hidden md:inline">
            ({pod.workerInfo.ip})
          </span>
        </div>

        <WorkloadPodStatusBadge status={pod.status} />
      </div>
    </div>
  );
};

interface WorkerSummaryProps {
  readonly distributions: WorkerDistributionCount[];
}

const WorkloadWorkerSummaryBar: React.FC<WorkerSummaryProps> = ({ distributions }) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Worker Distribution:
      </span>
      {distributions.map((item) => (
        <div
          key={`worker-dist-${item.workerId}`}
          data-testid={`worker-summary-${item.workerId}`}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1.5",
            item.workerInfo.badgeBg,
            item.workerInfo.badgeText,
            item.workerInfo.badgeBorder
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          <span>{item.workerInfo.name}</span>
          <span className="opacity-90 font-extrabold">({item.count} pods)</span>
        </div>
      ))}
    </div>
  );
};

interface WorkloadPodsListTabProps {
  readonly pods: WorkloadPodItem[];
  readonly colorMode: 'dark' | 'light';
  readonly searchQuery: string;
  readonly onSearchChange: (query: string) => void;
  readonly onCopy: (text: string) => void;
  readonly copiedName: string | null;
}

const WorkloadPodsListTab: React.FC<WorkloadPodsListTabProps> = ({
  pods,
  colorMode,
  searchQuery,
  onSearchChange,
  onCopy,
  copiedName,
}) => {
  const isDark = colorMode === 'dark';
  const distributions = useMemo(() => getWorkerDistribution(pods), [pods]);
  const filteredPods = useMemo(() => filterWorkloadPods(pods, searchQuery), [pods, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Distribution summary */}
      <WorkloadWorkerSummaryBar distributions={distributions} />

      {/* Search Bar */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search pods by name, suffix hash, random char, or worker..."
          data-testid="workload-pods-search-input"
          className={cn(
            "w-full pl-9 pr-8 py-2 rounded-lg text-xs font-mono border outline-none transition-colors",
            isDark
              ? "bg-slate-950/60 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-blue-500"
              : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-500"
          )}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear pod search query"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Pod List */}
      <div className="space-y-2 pr-1">
        {filteredPods.map((pod) => (
          <WorkloadPodRow
            key={`pod-item-${pod.podName}-${pod.index}`}
            pod={pod}
            colorMode={colorMode}
            onCopy={onCopy}
            copiedName={copiedName}
          />
        ))}

        {filteredPods.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-xs font-medium">
            No pods found matching &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
};

interface WorkloadSetupTabProps {
  readonly controller: any;
  readonly colorMode: 'dark' | 'light';
  readonly onOpenLogs: () => void;
}

const WorkloadSetupTab: React.FC<WorkloadSetupTabProps> = ({
  controller,
  colorMode,
  onOpenLogs,
}) => {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const { replicaValue, updateReplicas, hpaInfo } = useWorkloadConfigHandler(controller);
  const data = controller.data || {};
  const isDark = colorMode === 'dark';

  return (
    <div className="space-y-4 pr-1">
      {/* Workload Name */}
      <div className="space-y-1.5">
        <ConfigLabel>
          <Type size={10} /> Workload Name
        </ConfigLabel>
        <ConfigInput
          value={data.label || ''}
          onChange={(e: any) =>
            updateNodeData(controller.id, { label: sanitizeSlug(e.target.value) })
          }
          placeholder="workload-name"
          maxLength={63}
          colorMode={colorMode}
          className="font-mono w-full"
        />
      </div>

      {/* Workload Type Selector */}
      <ConfigSection title="Workload Type" icon={Server}>
        <SelectorGroup
          options={WORKLOAD_TYPES}
          currentValue={data.workloadType || (controller.type === 'StatefulSet' ? 'StatefulSet' : 'Deployment')}
          onSelect={(val) => updateNodeData(controller.id, { workloadType: val })}
          colorMode={colorMode}
        />
      </ConfigSection>

      {/* Replicas Configuration */}
      <ConfigSection title="Replicas Count" icon={Layers}>
        <div className="relative">
          <NumberStepper
            value={replicaValue}
            onChange={updateReplicas}
            colorMode={colorMode}
            disabled={hpaInfo.isControlled}
          />
        </div>
      </ConfigSection>

      {/* Container Image */}
      <ConfigSection title="Container Image" icon={Box}>
        <ImageDropdown
          value={data.image || ''}
          onChange={(val) =>
            updateNodeData(controller.id, { image: val, status: val ? 'ready' : 'pending' })
          }
          colorMode={colorMode}
        />
      </ConfigSection>

      {/* Restart Policy (only for standalone Pods) */}
      {controller.type === 'Pod' && (
        <ConfigSection title="Restart Policy" icon={RotateCcw}>
          <SelectorGroup
            options={RESTART_POLICIES}
            currentValue={data.restartPolicy || 'Always'}
            onSelect={(val) => updateNodeData(controller.id, { restartPolicy: val })}
            colorMode={colorMode}
          />
        </ConfigSection>
      )}

      {/* View Logs button */}
      <button
        type="button"
        onClick={onOpenLogs}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold transition-all border shadow-sm mt-3",
          isDark
            ? "bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700 hover:text-emerald-300"
            : "bg-slate-100 border-slate-200 text-emerald-600 hover:bg-slate-200 hover:text-emerald-700"
        )}
      >
        <Terminal size={13} />
        View Logs (kubectl logs)
      </button>
    </div>
  );
};

interface WorkloadSidebarMenuProps {
  readonly activeTab: ModalTabType;
  readonly onTabChange: (tab: ModalTabType) => void;
  readonly totalPods: number;
  readonly controllerLabel: string;
  readonly controllerType: string;
  readonly colorMode: 'dark' | 'light';
}

const WorkloadSidebarMenu: React.FC<WorkloadSidebarMenuProps> = ({
  activeTab,
  onTabChange,
  totalPods,
  controllerLabel,
  controllerType,
  colorMode,
}) => {
  const isDark = colorMode === 'dark';

  return (
    <div
      role="tablist"
      aria-label="Workload Management Tabs"
      className={cn(
        "w-48 sm:w-52 border-r p-3 space-y-1.5 shrink-0 flex flex-col h-full justify-between select-none",
        isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"
      )}
    >
      <div className="space-y-1.5">
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Workload Menu
        </div>

        {/* Tab: Setup */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'setup'}
          data-testid="tab-setup"
          onClick={() => onTabChange('setup')}
          className={cn(
            "w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-bold transition-all text-left",
            getWorkloadTabClass(activeTab === 'setup', isDark)
          )}
        >
          <Settings size={15} />
          <span>Setup</span>
        </button>

        {/* Tab: List Pods */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pods'}
          data-testid="tab-pods"
          onClick={() => onTabChange('pods')}
          className={cn(
            "w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all text-left",
            getWorkloadTabClass(activeTab === 'pods', isDark)
          )}
        >
          <div className="flex items-center gap-2.5">
            <Boxes size={15} />
            <span>List Pods</span>
          </div>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold",
              getPodBadgeCountClass(activeTab === 'pods', isDark)
            )}
          >
            {totalPods}
          </span>
        </button>
      </div>

      {/* Quick info footer in left sidebar */}
      <div
        className={cn(
          "p-2.5 rounded-lg border text-[10px] space-y-1 font-mono",
          isDark
            ? "bg-slate-900/40 border-slate-800 text-slate-400"
            : "bg-white border-slate-200 text-slate-600"
        )}
      >
        <div className="font-bold text-[9px] uppercase tracking-wider text-slate-500">
          Workload Info
        </div>
        <div className="truncate">Name: <strong className="text-slate-200">{controllerLabel}</strong></div>
        <div>Replicas: <strong className="text-slate-200">{totalPods}</strong></div>
        <div>Type: <strong className="text-slate-200">{controllerType}</strong></div>
      </div>
    </div>
  );
};

export const WorkloadPodsModal: React.FC<WorkloadPodsModalProps> = ({
  isOpen,
  onClose,
  selectedNode,
}) => {
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const clusterWorkerCount = useFlowStore((state) => state.clusterWorkerCount ?? 3);
  const isSimulating = useFlowStore((state) => state.isSimulating);

  const [activeTab, setActiveTab] = useState<ModalTabType>('pods');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const controller = useMemo(
    () => resolveWorkloadController(selectedNode, nodes),
    [selectedNode, nodes]
  );

  const podList = useMemo(
    () => buildWorkloadPodList(selectedNode, nodes, {}, clusterWorkerCount, isSimulating),
    [selectedNode, nodes, clusterWorkerCount, isSimulating]
  );

  const handleCopy = useCallback(async (text: string) => {
    if (globalThis.navigator?.clipboard?.writeText) {
      try {
        await globalThis.navigator.clipboard.writeText(text);
      } catch {
        // Ignore clipboard failure in mock or unsupported environment
      }
    }
    setCopiedName(text);
    setTimeout(() => setCopiedName(null), 2000);
  }, []);

  const handleOpenLogs = useCallback(() => {
    if (!controller) return;
    const { setTerminalOpen, setTerminalActiveTab, setTerminalSelectedResourceId } =
      useFlowStore.getState();
    setTerminalSelectedResourceId(controller.id);
    setTerminalActiveTab('logs');
    setTerminalOpen(true);
    onClose();
  }, [controller, onClose]);

  if (!isOpen || !controller) return null;

  const controllerLabel = controller.data?.label || controller.data?.baseName || 'Workload';
  const totalPods = podList.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${controllerLabel} Workload Manager`}
      subtitle={`${totalPods} Replicas across worker nodes`}
      icon={Boxes}
      iconColorClass="text-blue-400"
      widthClass="w-full max-w-5xl"
      maxHeightClass="max-h-[85vh] h-[75vh]"
      disableScroll={true}
      compactHeader
    >
      <div className="flex h-[calc(100%+2rem)] -mx-4 -my-4 overflow-hidden">
        <WorkloadSidebarMenu
          activeTab={activeTab}
          onTabChange={setActiveTab}
          totalPods={totalPods}
          controllerLabel={controllerLabel}
          controllerType={controller.type}
          colorMode={colorMode}
        />

        {/* Right Active Panel */}
        <div className="flex-1 p-5 overflow-y-auto h-full custom-scrollbar">
          {activeTab === 'setup' ? (
            <WorkloadSetupTab
              controller={controller}
              colorMode={colorMode}
              onOpenLogs={handleOpenLogs}
            />
          ) : (
            <WorkloadPodsListTab
              pods={podList}
              colorMode={colorMode}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onCopy={handleCopy}
              copiedName={copiedName}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};
