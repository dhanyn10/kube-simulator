import { calculateResourceTotals, calculateWorkloadLimitMetrics } from './resourceBudgetHelpers';

export interface LocalHardwareSpecs {
  readonly cpuCores: number;
  readonly memoryGb: number;
}

export interface WorkerNodePreset {
  readonly id: 'small' | 'standard' | 'large' | 'custom';
  readonly name: string;
  readonly vCpu: number;
  readonly memoryGb: number;
  readonly description: string;
}

export const WORKER_PRESETS: readonly WorkerNodePreset[] = [
  { id: 'small', name: 'Small (Lab)', vCpu: 1, memoryGb: 2, description: '1 vCPU, 2 GB RAM (KinD / Minikube)' },
  { id: 'standard', name: 'Standard (Cloud)', vCpu: 2, memoryGb: 4, description: '2 vCPU, 4 GB RAM (General Purpose)' },
  { id: 'large', name: 'Large (Compute)', vCpu: 4, memoryGb: 8, description: '4 vCPU, 8 GB RAM (Production / Heavy)' },
] as const;

/**
 * Detects local host specifications via navigator.hardwareConcurrency or safe fallback.
 */
export const getLocalHardwareSpecs = (): LocalHardwareSpecs => {
  const cores = typeof globalThis !== 'undefined' && globalThis.navigator?.hardwareConcurrency
    ? globalThis.navigator.hardwareConcurrency
    : 8;
  const memoryGb = Math.max(8, Math.min(64, cores * 2));
  return { cpuCores: cores, memoryGb };
};

export interface ClusterBudgetCalculationParams {
  readonly workerCount: number;
  readonly vCpuPerWorker: number;
  readonly memoryGbPerWorker: number;
  readonly nodes: readonly any[];
  readonly localHardware?: LocalHardwareSpecs;
}

export type BudgetStatusLevel = 'safe' | 'warning' | 'danger';

export interface ClusterBudgetResult {
  readonly workerCount: number;
  readonly vCpuPerWorker: number;
  readonly memoryGbPerWorker: number;
  readonly totalClusterCpu: number;
  readonly totalClusterMemoryGb: number;
  readonly maxPodsCapacity: number;
  readonly localHardware: LocalHardwareSpecs;
  readonly cpuUsagePercentOfLocal: number;
  readonly memUsagePercentOfLocal: number;
  readonly isLocalOverloaded: boolean;
  readonly canvasDemands: {
    readonly cpuReqCores: number;
    readonly memReqGb: number;
    readonly hasMissingLimits: boolean;
  };
  readonly isWorkloadDeficit: boolean;
  readonly statusLevel: BudgetStatusLevel;
  readonly realHardwarePodCapacity: number;
  readonly isPodCapacityExceeded: boolean;
  readonly capacitySubtitle: string;
}

const determineStatusLevel = (
  isLocalOverloaded: boolean,
  isWorkloadDeficit: boolean,
  workerCount: number
): BudgetStatusLevel => {
  if (isLocalOverloaded) {
    return 'danger';
  }
  if (isWorkloadDeficit || workerCount > 15) {
    return 'warning';
  }
  return 'safe';
};

interface HardwareCapacityEvaluation {
  realCapacity: number;
  subtitle: string;
}

const evaluateHardwarePodCapacity = (
  totalClusterCpu: number,
  totalClusterMemoryGb: number,
  limitMetrics: ReturnType<typeof calculateWorkloadLimitMetrics>,
  kubeletLimit: number
): HardwareCapacityEvaluation => {
  if (limitMetrics.constrainedPodCount > 0) {
    const avgCpuLimMilli = limitMetrics.totalCpuLimMilli / limitMetrics.constrainedPodCount;
    const avgMemLimMiB = limitMetrics.totalMemLimMiB / limitMetrics.constrainedPodCount;
    const clusterCpuMilli = totalClusterCpu * 1000;
    const clusterMemMiB = totalClusterMemoryGb * 1024;

    const cpuCapacity = avgCpuLimMilli > 0 ? Math.floor(clusterCpuMilli / avgCpuLimMilli) : Number.POSITIVE_INFINITY;
    const memCapacity = avgMemLimMiB > 0 ? Math.floor(clusterMemMiB / avgMemLimMiB) : Number.POSITIVE_INFINITY;
    const limitCapacity = Math.min(cpuCapacity, memCapacity);
    const realCapacity = Math.max(1, limitCapacity);
    const bottleneck = cpuCapacity <= memCapacity ? 'CPU limit' : 'Memory limit';

    return {
      realCapacity,
      subtitle: `Hardware capacity: ~${realCapacity} pods (${bottleneck})`,
    };
  }

  return {
    realCapacity: kubeletLimit,
    subtitle: '110 pods/node limit (unbounded limits)',
  };
};

/**
 * Calculates cluster supply vs canvas workload demand and local hardware budget.
 */
export const calculateClusterBudget = ({
  workerCount,
  vCpuPerWorker,
  memoryGbPerWorker,
  nodes,
  localHardware = getLocalHardwareSpecs(),
}: ClusterBudgetCalculationParams): ClusterBudgetResult => {
  const safeWorkerCount = Math.max(1, Math.min(100, Math.floor(workerCount) || 1));
  const safeCpu = Math.max(0.5, vCpuPerWorker);
  const safeMem = Math.max(0.5, memoryGbPerWorker);

  const totalClusterCpu = safeWorkerCount * safeCpu;
  const totalClusterMemoryGb = safeWorkerCount * safeMem;
  const maxPodsCapacity = safeWorkerCount * 110;

  const cpuUsagePercentOfLocal = Math.round((totalClusterCpu / localHardware.cpuCores) * 100);
  const memUsagePercentOfLocal = Math.round((totalClusterMemoryGb / localHardware.memoryGb) * 100);
  const isLocalOverloaded = totalClusterCpu > localHardware.cpuCores || totalClusterMemoryGb > localHardware.memoryGb;

  const totals = calculateResourceTotals(nodes as any[]);
  const cpuReqCores = Math.round((totals.cpuReq / 1000) * 10) / 10;
  const memReqGb = Math.round((totals.memReq / 1024) * 10) / 10;
  const isWorkloadDeficit = totalClusterCpu < cpuReqCores || totalClusterMemoryGb < memReqGb;

  const statusLevel = determineStatusLevel(isLocalOverloaded, isWorkloadDeficit, safeWorkerCount);

  const limitMetrics = calculateWorkloadLimitMetrics(nodes as any[]);
  const { realCapacity, subtitle } = evaluateHardwarePodCapacity(
    totalClusterCpu,
    totalClusterMemoryGb,
    limitMetrics,
    maxPodsCapacity
  );
  const isPodCapacityExceeded = maxPodsCapacity > realCapacity;

  return {
    workerCount: safeWorkerCount,
    vCpuPerWorker: safeCpu,
    memoryGbPerWorker: safeMem,
    totalClusterCpu,
    totalClusterMemoryGb,
    maxPodsCapacity,
    localHardware,
    cpuUsagePercentOfLocal,
    memUsagePercentOfLocal,
    isLocalOverloaded,
    canvasDemands: {
      cpuReqCores,
      memReqGb,
      hasMissingLimits: totals.hasMissingLimits,
    },
    isWorkloadDeficit,
    statusLevel,
    realHardwarePodCapacity: realCapacity,
    isPodCapacityExceeded,
    capacitySubtitle: subtitle,
  };
};

export const getBudgetStatusBadgeClass = (status: BudgetStatusLevel): string => {
  if (status === 'danger') {
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  }
  if (status === 'warning') {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  }
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
};
