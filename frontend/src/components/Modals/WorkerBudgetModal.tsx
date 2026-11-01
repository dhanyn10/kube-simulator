import React, { useState, useMemo } from 'react';
import { Cpu, Server, X, AlertTriangle, CheckCircle, Info, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store';
import {
  WORKER_PRESETS,
  WorkerNodePreset,
  calculateClusterBudget,
  getBudgetStatusBadgeClass,
  getLocalHardwareSpecs,
} from '@/activities/monitoring/workerBudgetHelpers';

interface WorkerBudgetModalProps {
  readonly isOpen?: boolean;
  readonly onClose?: () => void;
}

interface WorkerBudgetHeaderProps {
  readonly isDark: boolean;
  readonly onClose: () => void;
}

const WorkerBudgetHeader: React.FC<WorkerBudgetHeaderProps> = ({ isDark, onClose }) => (
  <div className={cn("flex items-center justify-between p-4 border-b", isDark ? "border-slate-800" : "border-slate-200")}>
    <div className="flex items-center gap-3">
      <div className={cn("p-2 rounded-xl", isDark ? "bg-sky-500/10 text-sky-400" : "bg-sky-50 text-sky-600")}>
        <Server size={20} />
      </div>
      <div>
        <h2 className={cn("text-base font-bold", isDark ? "text-slate-100" : "text-slate-900")}>
          Cluster Worker Nodes & Hardware Budget
        </h2>
        <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
          Simulate node scaling, evaluate hardware capacity, and preview workload feasibility.
        </p>
      </div>
    </div>
    <button
      type="button"
      data-testid="worker-budget-modal-close"
      onClick={onClose}
      className={cn("p-1.5 rounded-lg transition-colors", isDark ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" : "hover:bg-slate-100 text-slate-500 hover:text-slate-700")}
    >
      <X size={18} />
    </button>
  </div>
);

interface WorkerBudgetStatsBannerProps {
  readonly isDark: boolean;
  readonly localCores: number;
  readonly localMem: number;
  readonly demandCpu: number;
  readonly demandMem: number;
  readonly statusLevel: 'safe' | 'warning' | 'danger';
}

const WorkerBudgetStatsBanner: React.FC<WorkerBudgetStatsBannerProps> = ({
  isDark,
  localCores,
  localMem,
  demandCpu,
  demandMem,
  statusLevel,
}) => (
  <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border", isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200")}>
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
        <Cpu size={12} className="text-sky-400" />
        Local PC Hardware
      </div>
      <div className={cn("text-sm font-mono font-bold mt-0.5", isDark ? "text-slate-200" : "text-slate-800")}>
        {localCores} vCPUs / {localMem} GB RAM
      </div>
      <div className="text-[10px] text-slate-500">Host physical capabilities</div>
    </div>

    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
        <Zap size={12} className="text-amber-400" />
        Canvas Workload Demands
      </div>
      <div className={cn("text-sm font-mono font-bold mt-0.5", isDark ? "text-slate-200" : "text-slate-800")}>
        {demandCpu} vCPUs / {demandMem} GB RAM
      </div>
      <div className="text-[10px] text-slate-500">Active pods resource requests</div>
    </div>

    <div className="flex flex-col justify-center sm:items-end">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        Feasibility Status
      </div>
      <span
        data-testid="cluster-budget-status-badge"
        className={cn(
          "px-2.5 py-1 rounded-full text-xs font-mono font-bold border uppercase tracking-wider inline-flex items-center gap-1.5",
          getBudgetStatusBadgeClass(statusLevel)
        )}
      >
        <span className="w-2 h-2 rounded-full bg-current" />
        {statusLevel}
      </span>
    </div>
  </div>
);

interface PresetSelectorProps {
  readonly isDark: boolean;
  readonly selectedPreset: string;
  readonly onSelect: (preset: WorkerNodePreset) => void;
}

const WorkerPresetSelector: React.FC<PresetSelectorProps> = ({ isDark, selectedPreset, onSelect }) => (
  <div>
    <label className={cn("block text-xs font-bold mb-1.5", isDark ? "text-slate-300" : "text-slate-700")}>
      Worker Node Size Preset
    </label>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      {WORKER_PRESETS.map((preset) => {
        const isSelected = selectedPreset === preset.id;
        return (
          <button
            type="button"
            key={`preset-btn-${preset.id}`}
            data-testid={`worker-preset-${preset.id}`}
            onClick={() => onSelect(preset)}
            className={cn(
              "p-2.5 rounded-xl border text-left transition-all",
              isSelected
                ? "border-sky-500 bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/30"
                : isDark
                ? "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <div className="font-bold text-xs">{preset.name}</div>
            <div className="text-[11px] font-mono mt-0.5 opacity-90">
              {preset.vCpu} vCPU, {preset.memoryGb} GB RAM
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

interface ScaleSliderProps {
  readonly isDark: boolean;
  readonly workerCount: number;
  readonly onChange: (count: number) => void;
}

const WorkerScaleSlider: React.FC<ScaleSliderProps> = ({ isDark, workerCount, onChange }) => {
  const adjust = (diff: number) => {
    onChange(Math.max(1, Math.min(100, workerCount + diff)));
  };

  return (
    <div className={cn("p-4 rounded-xl border space-y-3", isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
      <div className="flex items-center justify-between">
        <div>
          <span className={cn("text-xs font-bold", isDark ? "text-slate-200" : "text-slate-800")}>
            Total Worker Nodes:
          </span>
          <span className="ml-2 font-mono text-sm font-extrabold text-sky-400" data-testid="worker-count-display">
            {workerCount} {workerCount === 1 ? 'Node' : 'Nodes'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => adjust(-10)}
            disabled={workerCount <= 1}
            className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-bold border disabled:opacity-30", isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700")}
          >
            -10
          </button>
          <button
            type="button"
            onClick={() => adjust(-1)}
            disabled={workerCount <= 1}
            className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-bold border disabled:opacity-30", isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700")}
          >
            -1
          </button>
          <button
            type="button"
            onClick={() => adjust(1)}
            disabled={workerCount >= 100}
            className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-bold border disabled:opacity-30", isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700")}
          >
            +1
          </button>
          <button
            type="button"
            onClick={() => adjust(10)}
            disabled={workerCount >= 100}
            className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-bold border disabled:opacity-30", isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700")}
          >
            +10
          </button>
        </div>
      </div>

      <input
        type="range"
        min={1}
        max={100}
        value={workerCount}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
        data-testid="worker-count-range-slider"
        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
      />

      <div className="flex justify-between text-[10px] font-mono text-slate-500">
        <span>1 Node (Minikube)</span>
        <span>10 Nodes</span>
        <span>50 Nodes</span>
        <span>100 Nodes (Enterprise)</span>
      </div>
    </div>
  );
};

interface CapacityCardsProps {
  readonly isDark: boolean;
  readonly totalCpu: number;
  readonly totalMem: number;
  readonly maxPods: number;
  readonly cpuPercent: number;
  readonly memPercent: number;
  readonly isOverloaded: boolean;
}

const WorkerCapacityCards: React.FC<CapacityCardsProps> = ({
  isDark,
  totalCpu,
  totalMem,
  maxPods,
  cpuPercent,
  memPercent,
  isOverloaded,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div className={cn("p-3 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200")}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Cluster CPU</div>
      <div className={cn("text-lg font-mono font-extrabold mt-0.5", isOverloaded ? "text-rose-400" : "text-sky-400")}>
        {totalCpu} vCPUs
      </div>
      <div className="text-[10px] text-slate-500 mt-1">{cpuPercent}% of host CPU</div>
    </div>

    <div className={cn("p-3 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200")}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Cluster Memory</div>
      <div className={cn("text-lg font-mono font-extrabold mt-0.5", isOverloaded ? "text-rose-400" : "text-purple-400")}>
        {totalMem} GB RAM
      </div>
      <div className="text-[10px] text-slate-500 mt-1">{memPercent}% of host RAM</div>
    </div>

    <div className={cn("p-3 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200")}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Max Pods Capacity</div>
      <div className={cn("text-lg font-mono font-extrabold text-emerald-400 mt-0.5")}>
        {maxPods} Pods
      </div>
      <div className="text-[10px] text-slate-500 mt-1">110 pods/node limit</div>
    </div>
  </div>
);

interface NoticeBannerProps {
  readonly isOverloaded: boolean;
  readonly isWorkloadDeficit: boolean;
  readonly totalCpu: number;
  readonly totalMem: number;
  readonly hostCpu: number;
  readonly hostMem: number;
}

const WorkerBudgetNoticeBanner: React.FC<NoticeBannerProps> = ({
  isOverloaded,
  isWorkloadDeficit,
  totalCpu,
  totalMem,
  hostCpu,
  hostMem,
}) => {
  if (isOverloaded) {
    return (
      <div className="p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Local Hardware Budget Exceeded: </span>
          Cluster demands ({totalCpu} vCPUs / {totalMem} GB RAM) exceed your local machine specs ({hostCpu} vCPUs / {hostMem} GB RAM). This setup works visually in the simulator, but would throttle or fail on a physical local KinD/Minikube environment.
        </div>
      </div>
    );
  }

  if (isWorkloadDeficit) {
    return (
      <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
        <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Workload Capacity Warning: </span>
          The allocated worker capacity is less than the active resource requests from Pods on the canvas. Some pods will fail scheduling or stay in Pending state.
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
      <CheckCircle size={16} className="text-emerald-400 shrink-0" />
      <div>
        <span className="font-bold">Optimal Configuration: </span>
        Cluster worker resources are well within local hardware budget and fully satisfy active canvas workload demands.
      </div>
    </div>
  );
};

export const WorkerBudgetModal: React.FC<WorkerBudgetModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
}) => {
  const storeIsOpen = useFlowStore((state) => state.isWorkerBudgetModalOpen);
  const setStoreIsOpen = useFlowStore((state) => state.setWorkerBudgetModalOpen);
  const clusterWorkerCount = useFlowStore((state) => state.clusterWorkerCount ?? 3);
  const setClusterWorkerCount = useFlowStore((state) => state.setClusterWorkerCount);
  const colorMode = useFlowStore((state) => state.colorMode);
  const nodes = useFlowStore((state) => state.nodes);
  const addLog = useFlowStore((state) => state.addLog);

  const isOpen = propIsOpen ?? storeIsOpen;
  const isDark = colorMode === 'dark';

  const [workerCount, setWorkerCount] = useState<number>(clusterWorkerCount);
  const [selectedPreset, setSelectedPreset] = useState<WorkerNodePreset>(WORKER_PRESETS[1]);

  React.useEffect(() => {
    if (isOpen) {
      setWorkerCount(clusterWorkerCount);
    }
  }, [isOpen, clusterWorkerCount]);

  const budget = useMemo(() => {
    return calculateClusterBudget({
      workerCount,
      vCpuPerWorker: selectedPreset.vCpu,
      memoryGbPerWorker: selectedPreset.memoryGb,
      nodes,
      localHardware: getLocalHardwareSpecs(),
    });
  }, [workerCount, selectedPreset, nodes]);

  const handleClose = () => {
    if (propOnClose) propOnClose();
    setStoreIsOpen(false);
  };

  const handleApply = () => {
    setClusterWorkerCount(workerCount);
    addLog(
      'info',
      `[Cluster Scaling] Worker nodes updated to ${workerCount} nodes (${budget.totalClusterCpu} vCPUs, ${budget.totalClusterMemoryGb} GB RAM total).`,
      'Cluster'
    );
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        data-testid="worker-budget-modal"
        className={cn(
          "w-full max-w-2xl rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden",
          isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        )}
      >
        <WorkerBudgetHeader isDark={isDark} onClose={handleClose} />

        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          <WorkerBudgetStatsBanner
            isDark={isDark}
            localCores={budget.localHardware.cpuCores}
            localMem={budget.localHardware.memoryGb}
            demandCpu={budget.canvasDemands.cpuReqCores}
            demandMem={budget.canvasDemands.memReqGb}
            statusLevel={budget.statusLevel}
          />

          <WorkerPresetSelector
            isDark={isDark}
            selectedPreset={selectedPreset.id}
            onSelect={setSelectedPreset}
          />

          <WorkerScaleSlider
            isDark={isDark}
            workerCount={workerCount}
            onChange={setWorkerCount}
          />

          <WorkerCapacityCards
            isDark={isDark}
            totalCpu={budget.totalClusterCpu}
            totalMem={budget.totalClusterMemoryGb}
            maxPods={budget.maxPodsCapacity}
            cpuPercent={budget.cpuUsagePercentOfLocal}
            memPercent={budget.memUsagePercentOfLocal}
            isOverloaded={budget.isLocalOverloaded}
          />

          <WorkerBudgetNoticeBanner
            isOverloaded={budget.isLocalOverloaded}
            isWorkloadDeficit={budget.isWorkloadDeficit}
            totalCpu={budget.totalClusterCpu}
            totalMem={budget.totalClusterMemoryGb}
            hostCpu={budget.localHardware.cpuCores}
            hostMem={budget.localHardware.memoryGb}
          />
        </div>

        <div className={cn("p-4 border-t flex items-center justify-end gap-2.5", isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-slate-50")}>
          <button
            type="button"
            data-testid="worker-budget-cancel-btn"
            onClick={handleClose}
            className={cn("px-4 py-2 rounded-xl text-xs font-bold border transition-colors", isDark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700")}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="worker-budget-apply-btn"
            onClick={handleApply}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-colors flex items-center gap-1.5"
          >
            <CheckCircle size={14} />
            Apply Cluster Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
