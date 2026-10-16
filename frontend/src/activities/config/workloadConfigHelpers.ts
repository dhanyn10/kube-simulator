import { Node, Edge } from '@xyflow/react';

export interface WorkloadPvcInfo {
  isConnectedToPvc: boolean;
  connectedPvcAccessMode?: string;
  isMultiReplicaRwoPvc: boolean;
  connectedPvcName?: string;
}

/**
 * Evaluates whether a workload node (or its parent/child controller) is connected to a PVC node,
 * and checks if it forms a multi-replica ReadWriteOnce (RWO) binding.
 *
 * @param selectedNode - Currently active canvas node.
 * @param nodes - List of all canvas nodes.
 * @param edges - List of all canvas edges.
 * @param replicas - Active replica count for the workload.
 * @returns WorkloadPvcInfo describing PVC connection and RWO multi-replica state.
 */
export const checkWorkloadConnectedPvc = (
  selectedNode: Node,
  nodes: Node[],
  edges: Edge[],
  replicas: number
): WorkloadPvcInfo => {
  if (!selectedNode) {
    return { isConnectedToPvc: false, isMultiReplicaRwoPvc: false };
  }

  const targetIds = new Set<string>([selectedNode.id]);
  if (selectedNode.data?.parentId) {
    targetIds.add(String(selectedNode.data.parentId));
  }

  const pvcNodeIds = new Set<string>();
  edges.forEach((e) => {
    if (targetIds.has(e.source)) {
      const targetNode = nodes.find((n) => n.id === e.target);
      if (targetNode?.type === 'PVC') pvcNodeIds.add(e.target);
    } else if (targetIds.has(e.target)) {
      const sourceNode = nodes.find((n) => n.id === e.source);
      if (sourceNode?.type === 'PVC') pvcNodeIds.add(e.source);
    }
  });

  if (pvcNodeIds.size === 0) {
    return { isConnectedToPvc: false, isMultiReplicaRwoPvc: false };
  }

  const pvcNode = nodes.find((n) => pvcNodeIds.has(n.id));
  const accessMode = (pvcNode?.data?.accessMode as string) || 'ReadWriteOnce';
  const isMultiReplicaRwoPvc = accessMode === 'ReadWriteOnce' && replicas > 1;

  return {
    isConnectedToPvc: true,
    connectedPvcAccessMode: accessMode,
    isMultiReplicaRwoPvc,
    connectedPvcName: (pvcNode?.data?.label as string) || pvcNode?.id,
  };
};
