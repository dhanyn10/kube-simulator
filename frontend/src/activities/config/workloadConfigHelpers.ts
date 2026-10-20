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
export interface WorkloadHpaInfo {
  isControlled: boolean;
  hpaName?: string;
  minReplicas?: number;
  maxReplicas?: number;
}

const findConnectedHpaNode = (targetId: string, nodes: Node[], edges: Edge[]): Node | undefined => {
  const edge = edges.find(
    (e) => (e.target === targetId && nodes.find((n) => n.id === e.source)?.type === 'HPA') ||
           (e.source === targetId && nodes.find((n) => n.id === e.target)?.type === 'HPA')
  );
  if (!edge) return undefined;
  const hpaId = edge.target === targetId ? edge.source : edge.target;
  return nodes.find((n) => n.id === hpaId);
};

const extractHpaDetails = (nodeOrItem: any, isNode = false): WorkloadHpaInfo => {
  if (isNode) {
    return {
      isControlled: true,
      hpaName: (nodeOrItem?.data?.label as string) || nodeOrItem?.id,
      minReplicas: (nodeOrItem?.data?.minReplicas as number) || 1,
      maxReplicas: (nodeOrItem?.data?.maxReplicas as number) || 10,
    };
  }
  return {
    isControlled: true,
    hpaName: nodeOrItem.name,
    minReplicas: nodeOrItem.minReplicas,
    maxReplicas: nodeOrItem.maxReplicas,
  };
};

/**
 * Evaluates whether a workload node (or its parent controller) is controlled by an HPA
 * (either attached as a badge item or connected via an edge on the canvas).
 *
 * @param selectedNode - Currently active canvas node.
 * @param nodes - List of all canvas nodes.
 * @param edges - List of all canvas edges.
 * @returns WorkloadHpaInfo describing HPA control and min/max replica boundaries.
 */
export const checkWorkloadHpaStatus = (
  selectedNode: any,
  nodes: Node[],
  edges: Edge[]
): WorkloadHpaInfo => {
  if (!selectedNode) {
    return { isControlled: false };
  }

  // 1. Direct attached HPA on selectedNode
  if (Array.isArray(selectedNode.data?.hpas) && selectedNode.data.hpas.length > 0) {
    return extractHpaDetails(selectedNode.data.hpas[0], false);
  }

  // 2. Direct connected HPA node via edges
  const connectedHpaNode = findConnectedHpaNode(selectedNode.id, nodes, edges);
  if (connectedHpaNode) {
    return extractHpaDetails(connectedHpaNode, true);
  }

  // 3. Parent controller attached/connected HPA (if selectedNode is a child Pod)
  const parentId = selectedNode.parentId || selectedNode.data?.parentId;
  if (parentId) {
    const parentNode = nodes.find((n) => n.id === parentId);
    if (parentNode) {
      if (Array.isArray(parentNode.data?.hpas) && parentNode.data.hpas.length > 0) {
        return extractHpaDetails(parentNode.data.hpas[0], false);
      }
      const parentConnectedHpa = findConnectedHpaNode(parentNode.id, nodes, edges);
      if (parentConnectedHpa) {
        return extractHpaDetails(parentConnectedHpa, true);
      }
    }
  }

  return { isControlled: false };
};
