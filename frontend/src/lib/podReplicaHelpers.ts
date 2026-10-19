import { K8sNodeData } from '@/types';

export const POD_SEPARATED_THRESHOLD = 3;
export const POD_MEGA_THRESHOLD = 100;

export interface PodReplicaInfo {
  replicas: number;
  parentReplicas: number;
  totalReplicas: number;
  isStackedPod: boolean;
  isStackedCard: boolean;
  isMegaPod: boolean;
  showDashedProgress: boolean;
}

/**
 * Calculates standardized replica state and UI flags for a Pod card.
 *
 * @param data Node data containing replica information
 * @returns Computed replica properties for responsive card rendering
 */
export const getPodReplicaInfo = (data?: Partial<K8sNodeData>): PodReplicaInfo => {
  const replicas = (data?.replicas as number) || 1;
  const parentReplicas = (data?.parentReplicas as number) || 0;
  const totalReplicas = parentReplicas > 0 ? parentReplicas : replicas;
  const isStackedPod =
    data?.type === 'Pod' &&
    (parentReplicas > POD_SEPARATED_THRESHOLD || (replicas > POD_SEPARATED_THRESHOLD && !data?.parentId));
  const isStackedCard = isStackedPod && replicas > 1;
  const isMegaPod = replicas >= POD_MEGA_THRESHOLD || parentReplicas >= POD_MEGA_THRESHOLD;
  const showDashedProgress = isStackedPod;

  return {
    replicas,
    parentReplicas,
    totalReplicas,
    isStackedPod,
    isStackedCard,
    isMegaPod,
    showDashedProgress,
  };
};
