import { K8sNodeData } from '@/types';
import { parseCPU, parseMemory } from '@/lib/utils';

/**
 * Calculates aggregated CPU and Memory request/limit resource totals and flags missing limits across workload canvas nodes.
 *
 * @param nodes - Array of active canvas nodes.
 * @returns Object containing calculated CPU requests/limits, Memory requests/limits, and a missing limit flag.
 */
export interface WorkloadResourceTotals {
  cpuReq: number;
  memReq: number;
  cpuLim: number;
  memLim: number;
  hasMissingLimits: boolean;
  totalPodCount: number;
  constrainedPodCount: number;
  totalCpuLimMilli: number;
  totalMemLimMiB: number;
}

export interface WorkloadLimitMetrics {
  totalPodCount: number;
  constrainedPodCount: number;
  totalCpuLimMilli: number;
  totalMemLimMiB: number;
}

export const calculateWorkloadLimitMetrics = (nodes: any[]): WorkloadLimitMetrics => {
  return nodes.reduce(
    (acc, nodeItem) => {
      if (!['Deployment', 'Pod', 'ReplicaSet'].includes(nodeItem.type || '')) {
        return acc;
      }

      const data = nodeItem.data as K8sNodeData;
      const replicas = data.replicas || 1;

      if (nodeItem.parentId) {
        const parentNode = nodes.find((node) => node.id === nodeItem.parentId);
        if (['Deployment', 'ReplicaSet'].includes(parentNode?.type ?? '')) {
          return acc;
        }
      }

      const hasCpuLim = Boolean(data.cpuLimit);
      const hasMemLim = Boolean(data.memoryLimit);
      const parsedCpuLim = data.cpuLimit ? parseCPU(data.cpuLimit) : 0;
      const parsedMemLim = data.memoryLimit ? parseMemory(data.memoryLimit) : 0;
      const isConstrained = hasCpuLim || hasMemLim;

      return {
        totalPodCount: acc.totalPodCount + replicas,
        constrainedPodCount: acc.constrainedPodCount + (isConstrained ? replicas : 0),
        totalCpuLimMilli: acc.totalCpuLimMilli + parsedCpuLim * replicas,
        totalMemLimMiB: acc.totalMemLimMiB + parsedMemLim * replicas,
      };
    },
    { totalPodCount: 0, constrainedPodCount: 0, totalCpuLimMilli: 0, totalMemLimMiB: 0 }
  );
};

export const calculateResourceTotals = (nodes: any[]) => {
  return nodes.reduce(
    (totalsAccumulator, nodeItem) => {
      if (!['Deployment', 'Pod', 'ReplicaSet'].includes(nodeItem.type || '')) {
        return totalsAccumulator;
      }

      const data = nodeItem.data as K8sNodeData;
      const replicas = data.replicas || 1;

      if (nodeItem.parentId) {
        const parentNode = nodes.find((node) => node.id === nodeItem.parentId);
        if (['Deployment', 'ReplicaSet'].includes(parentNode?.type ?? '')) {
          return totalsAccumulator;
        }
      }

      const cpuReq = parseCPU(data.cpuRequest || '0');
      const memReq = parseMemory(data.memoryRequest || '0');
      const cpuLim = data.cpuLimit ? parseCPU(data.cpuLimit) : cpuReq;
      const memLim = data.memoryLimit ? parseMemory(data.memoryLimit) : memReq;

      return {
        cpuReq: totalsAccumulator.cpuReq + cpuReq * replicas,
        memReq: totalsAccumulator.memReq + memReq * replicas,
        cpuLim: totalsAccumulator.cpuLim + cpuLim * replicas,
        memLim: totalsAccumulator.memLim + memLim * replicas,
        hasMissingLimits: totalsAccumulator.hasMissingLimits || (!data.cpuLimit || !data.memoryLimit),
      };
    },
    { cpuReq: 0, memReq: 0, cpuLim: 0, memLim: 0, hasMissingLimits: false }
  );
};
