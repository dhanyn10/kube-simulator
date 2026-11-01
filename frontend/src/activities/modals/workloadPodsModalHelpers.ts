import { K8sNodeData } from '@/types';
import { generateRandomHash, formatPodName } from '@/lib/utils';
import {
  WorkerNodeId,
  WorkerNodeInfo,
  WORKER_NODES,
  getWorkerForIndex,
} from '@/lib/workerNodeHelpers';

export interface WorkloadPodItem {
  index: number;
  podName: string;
  podHash: string;
  replicaSuffix: string;
  workerId: WorkerNodeId;
  workerInfo: WorkerNodeInfo;
  status: 'Running' | 'Ready' | 'Pending';
}

export interface WorkerDistributionCount {
  workerId: WorkerNodeId;
  workerInfo: WorkerNodeInfo;
  count: number;
}

/**
 * Resolves the parent controller node if a child Pod was selected.
 */
export const resolveWorkloadController = (selectedNode: any, allNodes: any[]): any => {
  if (!selectedNode) return null;
  if (selectedNode.type === 'Pod' && selectedNode.parentId) {
    const parent = allNodes.find((n) => n.id === selectedNode.parentId);
    if (parent && (parent.type === 'Deployment' || parent.type === 'StatefulSet' || parent.type === 'ReplicaSet')) {
      return parent;
    }
  }
  return selectedNode;
};

/**
 * Gathers existing replica suffixes from child pod nodes.
 */
export const extractExistingSuffixes = (childPods: any[]): string[] => {
  const gathered: string[] = [];
  for (const pod of childPods) {
    const podData = pod.data as Partial<K8sNodeData> | undefined;
    if (Array.isArray(podData?.replicaSuffixes) && podData.replicaSuffixes.length > 0) {
      gathered.push(...podData.replicaSuffixes);
    } else if (podData?.replicaSuffix) {
      gathered.push(podData.replicaSuffix);
    }
  }
  return gathered;
};

interface PodNameResolutionParams {
  isStatefulSet: boolean;
  baseName: string;
  groupPodHash: string;
  replicaSuffix: string;
  totalReplicas: number;
}

const computeSinglePodName = (params: PodNameResolutionParams): string => {
  const { isStatefulSet, baseName, groupPodHash, replicaSuffix, totalReplicas } = params;
  if (isStatefulSet) {
    return `${baseName}-${replicaSuffix}`;
  }
  return formatPodName(baseName, groupPodHash, replicaSuffix, totalReplicas);
};

const resolvePodWorker = (index: number, childPods: any[]): WorkerNodeId => {
  const directPod = childPods[index];
  const assigned = directPod?.data?.assignedNode;
  if (assigned === 'worker-1' || assigned === 'worker-2' || assigned === 'worker-3') {
    return assigned;
  }
  return getWorkerForIndex(index);
};

/**
 * Builds the complete list of individual pods for a workload controller.
 */
export const buildWorkloadPodList = (
  selectedNode: any,
  allNodes: any[],
  cachedSuffixes: Record<number, string> = {}
): WorkloadPodItem[] => {
  const controller = resolveWorkloadController(selectedNode, allNodes);
  if (!controller) return [];

  const data = (controller.data || {}) as Partial<K8sNodeData>;
  const isStatefulSet = controller.type === 'StatefulSet' || data.workloadType === 'StatefulSet';
  const baseName = (data.label as string) || (data.baseName as string) || 'pod';
  const totalReplicas = Math.max(1, Number(data.replicas) || 1);

  const childPods = allNodes.filter(
    (n) => n.type === 'Pod' && (n.parentId === controller.id || n.data?.parentId === controller.id)
  );

  const groupPodHash = isStatefulSet
    ? ''
    : (data.podHash as string) || (childPods[0]?.data?.podHash as string) || '1pd4l';

  const existingSuffixes = extractExistingSuffixes(childPods);
  const result: WorkloadPodItem[] = [];

  for (let i = 0; i < totalReplicas; i++) {
    const replicaSuffix = isStatefulSet
      ? String(i)
      : cachedSuffixes[i] || existingSuffixes[i] || generateRandomHash(5);

    const podName = computeSinglePodName({
      isStatefulSet,
      baseName,
      groupPodHash,
      replicaSuffix,
      totalReplicas,
    });

    const workerId = resolvePodWorker(i, childPods);
    const workerInfo = WORKER_NODES[workerId];
    const isReady = data.status === 'ready' || Boolean(data.image);

    result.push({
      index: i + 1,
      podName,
      podHash: groupPodHash,
      replicaSuffix,
      workerId,
      workerInfo,
      status: isReady ? 'Running' : 'Pending',
    });
  }

  return result;
};

/**
 * Computes distribution summary of pods across worker nodes.
 */
export const getWorkerDistribution = (pods: WorkloadPodItem[]): WorkerDistributionCount[] => {
  const counts: Record<WorkerNodeId, number> = {
    'worker-1': 0,
    'worker-2': 0,
    'worker-3': 0,
  };

  for (const pod of pods) {
    if (counts[pod.workerId] !== undefined) {
      counts[pod.workerId] += 1;
    }
  }

  const workerIds: WorkerNodeId[] = ['worker-1', 'worker-2', 'worker-3'];
  return workerIds.map((id) => ({
    workerId: id,
    workerInfo: WORKER_NODES[id],
    count: counts[id],
  }));
};

/**
 * Filters workload pods by search query against pod name, suffix hash, random char, or worker name.
 */
export const filterWorkloadPods = (pods: WorkloadPodItem[], query: string): WorkloadPodItem[] => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return pods;

  return pods.filter((pod) => {
    return (
      pod.podName.toLowerCase().includes(trimmed) ||
      pod.podHash.toLowerCase().includes(trimmed) ||
      pod.replicaSuffix.toLowerCase().includes(trimmed) ||
      pod.workerId.toLowerCase().includes(trimmed) ||
      pod.workerInfo.name.toLowerCase().includes(trimmed) ||
      pod.workerInfo.ip.includes(trimmed)
    );
  });
};
