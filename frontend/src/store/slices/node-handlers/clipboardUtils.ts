import { Node } from '@xyflow/react';
import { getNodeData } from '../../helpers';

/**
 * Finds a logical match for a pasted pod.
 * If it's in a controller, we return the match to trigger replication.
 */
export const findLogicalPodMatch = (pastedPod: Node, nodes: Node[]) => {
  const parentId = pastedPod.parentId;
  if (!parentId) return null;

  const parent = nodes.find(n => n.id === parentId);
  if (!parent || parent.type === 'Namespace') return null;

  const label = pastedPod.data?.label;
  return nodes.find(n => n.type === 'Pod' && n.data?.label === label && n.parentId === parentId);
};

/**
 * Updates replica count for a target's parent.
 */
export const updateReplicaDelta = (target: Node, delta: number, nodes: Node[], updateNodeData: Function) => {
  const parentId = (target.type === 'Deployment' || target.type === 'ReplicaSet') ? target.id : target.parentId;
  if (!parentId) return;

  const parent = nodes.find(n => n.id === parentId);
  if (parent && parent.type !== 'Namespace') {
    const data = getNodeData(parent);
    updateNodeData(parentId, { replicas: (data.replicas || 0) + delta });
  }
};
