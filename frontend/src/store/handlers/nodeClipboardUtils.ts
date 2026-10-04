import { Node } from '@xyflow/react';
import { getNodeData } from '@/store/helpers';

/**
 * Finds a logical match for a pasted pod within an existing container.
 * If the pod belongs to a controller, returns the matching pod to trigger replica scaling rather than duplicate creation.
 *
 * @param pastedPod Pod node being pasted
 * @param nodes Current array of canvas nodes
 * @returns Matching pod node if found, or null
 */
export const findLogicalPodMatch = (pastedPod: Node, nodes: Node[]) => {
  const parentId = pastedPod.parentId;
  if (!parentId) return null;

  const parent = nodes.find(n => n.id === parentId);
  if (!parent || parent.type === 'Namespace') return null;

  const baseName = pastedPod.data?.baseName || pastedPod.data?.label;
  return nodes.find(n => n.type === 'Pod' && n.parentId === parentId && (n.data?.baseName ? n.data.baseName === baseName : true));
};

/**
 * Updates replica count delta for a target workload or its parent controller.
 *
 * @param target Target workload node or pod
 * @param delta Replica count change (+1 or -1)
 * @param nodes Current array of canvas nodes
 * @param updateNodeData Function to dispatch node data updates
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
