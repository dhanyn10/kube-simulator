import { Node, Edge } from '@xyflow/react';

/**
 * Calculates total connected workload replicas for a given PVC node.
 *
 * @param pvcNodeId - The ID of the PVC node.
 * @param nodes - List of all canvas nodes.
 * @param edges - List of all canvas edges.
 * @returns Total number of connected replicas across Deployments, ReplicaSets, and standalone Pods.
 */
export const calculatePvcConnectedReplicas = (
  pvcNodeId: string,
  nodes: Node[],
  edges: Edge[]
): number => {
  const connectedNodeIds = new Set<string>();

  edges.forEach((edge) => {
    if (edge.source === pvcNodeId) {
      connectedNodeIds.add(edge.target);
    } else if (edge.target === pvcNodeId) {
      connectedNodeIds.add(edge.source);
    }
  });

  let totalReplicas = 0;
  connectedNodeIds.forEach((id) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    if (node.type === 'Deployment' || node.type === 'ReplicaSet') {
      const rep = Number(node.data?.replicas);
      totalReplicas += isNaN(rep) || rep < 1 ? 1 : rep;
    } else if (node.type === 'Pod') {
      // Only count standalone Pods if they don't have a parent Deployment already counted
      if (!node.data?.parentId || !connectedNodeIds.has(String(node.data.parentId))) {
        totalReplicas += 1;
      }
    }
  });

  return totalReplicas;
};
