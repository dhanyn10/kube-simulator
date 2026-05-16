import { Node } from '@xyflow/react';
import { getNodeData } from '../../helpers';

/**
 * Finds a logical match for a pasted pod based on label and context.
 */
export const findLogicalPodMatch = (pastedPod: Node, nodes: Node[]) => {
  const pastedLabel = pastedPod.data.label;
  return nodes.find(n => {
    if (n.id === pastedPod.id) return true;
    if (n.type === 'Pod' && n.data.label === pastedLabel && n.parentId === pastedPod.parentId) return true;
    if (n.type === 'PodGroup' && n.data.label === pastedLabel && (!pastedPod.parentId || n.id === pastedPod.parentId)) return true;
    return false;
  });
};

/**
 * Updates replica count for a target pod or its parent container.
 */
export const updateReplicaDelta = (target: Node, delta: number, nodes: Node[], updateNodeData: Function) => {
  const parentId = (target.type === 'PodGroup' || target.type === 'Deployment') ? target.id : target.parentId;
  if (parentId) {
    const parent = nodes.find(n => n.id === parentId);
    const parentData = parent ? getNodeData(parent) : null;
    updateNodeData(parentId, { replicas: (parentData?.replicas || 0) + delta });
  } else {
    const targetData = getNodeData(target);
    updateNodeData(target.id, { replicas: (targetData.replicas || 1) + delta });
  }
};
