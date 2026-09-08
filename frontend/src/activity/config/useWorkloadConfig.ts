/**
 * Hook and helpers for Workload configuration management.
 */

import { useFlowStore } from '../../store';

/**
 * Calculates the total replicas for a given node,
 * considering pod groups and controllers.
 */
export const getReplicaValue = (selectedNode: any, nodes: any[]): number => {
  const { data, type, parentId } = selectedNode;
  if (type === 'Pod' && parentId) {
    const podReplicaGroup = nodes.filter(
      (n) => n.type === 'Pod' && n.parentId === parentId && n.data.label === data.label
    );
    if (podReplicaGroup.length > 0) {
      return podReplicaGroup.reduce((acc: number, pod: any) => acc + (Number(pod.data.replicas) || 1), 0);
    }
  }
  return data.replicas || (type === 'Pod' ? 1 : 0);
};

/**
 * Determines the target ID for updating replicas,
 * typically the parent controller if it exists.
 */
export const getUpdateReplicasTargetId = (selectedNode: any, nodes: any[]): string => {
  if (selectedNode.type !== 'Pod' || !selectedNode.parentId) {
    return selectedNode.id;
  }
  const parent = nodes.find((n) => n.id === selectedNode.parentId);
  const isController = parent?.type === 'Deployment' || parent?.type === 'ReplicaSet' || parent?.type === 'PodGroup';
  return isController ? selectedNode.parentId! : selectedNode.id;
};

export const useWorkloadConfigHandler = (selectedNode: any) => {
  const nodes = useFlowStore((state) => state.nodes);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);

  const replicaValue = getReplicaValue(selectedNode, nodes);

  const updateReplicas = (replicas: number) => {
    const targetId = getUpdateReplicasTargetId(selectedNode, nodes);
    updateNodeData(targetId, { replicas });
  };

  return {
    replicaValue,
    updateReplicas,
  };
};
