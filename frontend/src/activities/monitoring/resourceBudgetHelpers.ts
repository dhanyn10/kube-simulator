import { K8sNodeData } from '@/types';
import { parseCPU, parseMemory } from '@/lib/utils';

/**
 * Calculates aggregated CPU and Memory request/limit resource totals and flags missing limits across workload canvas nodes.
 *
 * @param nodes - Array of active canvas nodes.
 * @returns Object containing calculated CPU requests/limits, Memory requests/limits, and a missing limit flag.
 */
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
