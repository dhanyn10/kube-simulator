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
      totalReplicas += Number.isNaN(rep) || rep < 1 ? 1 : rep;
    } else if (node.type === 'Pod') {
      // Only count standalone Pods if they don't have a parent Deployment already counted
      if (!node.data?.parentId || !connectedNodeIds.has(String(node.data.parentId))) {
        totalReplicas += 1;
      }
    }
  });

  return totalReplicas;
};

/**
 * Evaluates real-time PVC status based on connected workload replicas and PVC accessMode.
 *
 * @param pvcNode - The PVC canvas node object.
 * @param nodes - List of all canvas nodes.
 * @param edges - List of all canvas edges.
 * @returns Status string: 'Multi-Attach Error', 'Bound', or 'Pending'.
 */
export const evaluatePvcRealtimeStatus = (
  pvcNode: Node,
  nodes: Node[],
  edges: Edge[]
): 'Multi-Attach Error' | 'Bound' | 'Pending' => {
  const connectedReplicas = calculatePvcConnectedReplicas(pvcNode.id, nodes, edges);
  const accessMode = pvcNode.data?.accessMode || 'ReadWriteOnce';

  if (accessMode === 'ReadWriteOnce' && connectedReplicas > 1) {
    return 'Multi-Attach Error';
  }

  if (connectedReplicas > 0) {
    return 'Bound';
  }

  return (pvcNode.data?.pvcStatus as 'Bound' | 'Pending') || 'Pending';
};

/**
 * Determines the target PVC status based on multi-attach conflict state and connected replica count.
 *
 * @param isMultiAttachConflict - Whether a multi-attach error condition exists.
 * @param connectedReplicas - Number of connected workload replicas.
 * @returns Target PVC status string.
 */
const determinePvcTargetStatus = (
  isMultiAttachConflict: boolean,
  connectedReplicas: number
): 'Multi-Attach Error' | 'Bound' | 'Pending' => {
  if (isMultiAttachConflict) return 'Multi-Attach Error';
  if (connectedReplicas > 0) return 'Bound';
  return 'Pending';
};

/**
 * Extracts connected workload node IDs directly connected to the specified PVC node.
 *
 * @param pvcNodeId - ID of the PVC node.
 * @param edges - Array of canvas edges.
 * @returns Set of connected workload node IDs.
 */
const getConnectedWorkloadIds = (pvcNodeId: string, edges: Edge[]): Set<string> => {
  const connectedWorkloadIds = new Set<string>();
  edges.forEach((e) => {
    if (e.source === pvcNodeId) connectedWorkloadIds.add(e.target);
    if (e.target === pvcNodeId) connectedWorkloadIds.add(e.source);
  });
  return connectedWorkloadIds;
};

/**
 * Updates validation errors on canvas edges connected to a PVC node.
 *
 * @param pvcNode - Target PVC node.
 * @param edges - Array of canvas edges.
 * @param isMultiAttachConflict - Whether multi-attach conflict exists.
 * @param connectedReplicas - Number of connected replicas.
 * @returns Object containing updated edges array and changed boolean flag.
 */
const updatePvcEdges = (
  pvcNode: Node,
  edges: Edge[],
  isMultiAttachConflict: boolean,
  connectedReplicas: number
): { edges: Edge[]; changed: boolean } => {
  let edgesChanged = false;
  const errorMsg = isMultiAttachConflict
    ? `Multi-Attach Error: Volume "${pvcNode.data?.label || pvcNode.id}" (ReadWriteOnce) cannot be mounted by ${connectedReplicas} replicas simultaneously`
    : undefined;

  const updatedEdges = edges.map((edge) => {
    if (edge.source !== pvcNode.id && edge.target !== pvcNode.id) {
      return edge;
    }

    if (isMultiAttachConflict) {
      if (edge.data?.validationError !== errorMsg) {
        edgesChanged = true;
        return { ...edge, data: { ...edge.data, validationError: errorMsg } };
      }
    } else if (
      typeof edge.data?.validationError === 'string' &&
      edge.data.validationError.includes('Multi-Attach Error')
    ) {
      edgesChanged = true;
      return { ...edge, data: { ...edge.data, validationError: undefined } };
    }
    return edge;
  });

  return { edges: updatedEdges, changed: edgesChanged };
};

/**
 * Synchronizes Pod statuses for workloads connected to a PVC node.
 *
 * @param nodes - Array of canvas nodes.
 * @param connectedWorkloadIds - Set of connected workload IDs.
 * @param isMultiAttachConflict - Whether multi-attach conflict exists.
 * @returns Object containing updated nodes array and changed boolean flag.
 */
const updateConnectedPodStatuses = (
  nodes: Node[],
  connectedWorkloadIds: Set<string>,
  isMultiAttachConflict: boolean
): { nodes: Node[]; changed: boolean } => {
  if (connectedWorkloadIds.size === 0) {
    return { nodes, changed: false };
  }

  let nodesChanged = false;
  const updatedNodes = nodes.map((node) => {
    const isConnectedDirectly = connectedWorkloadIds.has(node.id);
    const isConnectedParent = node.parentId && connectedWorkloadIds.has(String(node.parentId));

    if (node.type === 'Pod' && (isConnectedDirectly || isConnectedParent)) {
      if (isMultiAttachConflict) {
        if (node.data?.status !== 'pending') {
          nodesChanged = true;
          return { ...node, data: { ...node.data, status: 'pending' } };
        }
      } else {
        const isConfigured = Boolean(node.data?.image);
        if (isConfigured && node.data?.status === 'pending') {
          nodesChanged = true;
          return { ...node, data: { ...node.data, status: 'ready' } };
        }
      }
    }
    return node;
  });

  return { nodes: updatedNodes, changed: nodesChanged };
};

/**
 * Dedicated function to handle ReadWriteOnce (RWO) PVC access mode validation and state synchronization.
 * Evaluates connected workload replicas in real-time (whether in simulation or edit mode):
 * - If connected replicas > 1 for RWO, sets PVC status to 'Multi-Attach Error', applies edge validation errors, and marks workload pods as pending.
 * - If connected replicas <= 1, restores PVC status to 'Bound', clears edge validation errors, and restores workload pods to 'ready' status if configured.
 *
 * @param pvcNode - The target PVC canvas node.
 * @param nodes - List of current canvas nodes.
 * @param edges - List of current canvas edges.
 * @returns Object containing updated nodes and edges arrays.
 */
export const handlePvcRwoAccessMode = (
  pvcNode: Node,
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } => {
  const connectedReplicas = calculatePvcConnectedReplicas(pvcNode.id, nodes, edges);
  const accessMode = pvcNode.data?.accessMode || 'ReadWriteOnce';
  const isRWO = accessMode === 'ReadWriteOnce';
  const isMultiAttachConflict = isRWO && connectedReplicas > 1;

  let nodesChanged = false;
  let updatedNodes = [...nodes];

  const targetPvcStatus = determinePvcTargetStatus(isMultiAttachConflict, connectedReplicas);
  if (pvcNode.data?.pvcStatus !== targetPvcStatus) {
    nodesChanged = true;
    updatedNodes = updatedNodes.map((n) =>
      n.id === pvcNode.id ? { ...n, data: { ...n.data, pvcStatus: targetPvcStatus } } : n
    );
  }

  const { edges: updatedEdges, changed: edgesChanged } = updatePvcEdges(
    pvcNode,
    edges,
    isMultiAttachConflict,
    connectedReplicas
  );

  const connectedWorkloadIds = getConnectedWorkloadIds(pvcNode.id, edges);
  const { nodes: syncedNodes, changed: podsChanged } = updateConnectedPodStatuses(
    updatedNodes,
    connectedWorkloadIds,
    isMultiAttachConflict
  );

  return {
    nodes: nodesChanged || podsChanged ? syncedNodes : nodes,
    edges: edgesChanged ? updatedEdges : edges,
  };
};

/**
 * Synchronizes PVC statuses and connected edge validation errors in real-time across all PVC nodes on canvas.
 *
 * @param nodes - List of all canvas nodes.
 * @param edges - List of all canvas edges.
 * @returns Object containing updated nodes and edges arrays.
 */
export const syncPvcRealtimeState = (
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } => {
  const pvcNodes = nodes.filter((n) => n.type === 'PVC');
  if (pvcNodes.length === 0) {
    return { nodes, edges };
  }

  let currentNodes = [...nodes];
  let currentEdges = [...edges];

  pvcNodes.forEach((pvcNode) => {
    const updated = handlePvcRwoAccessMode(pvcNode, currentNodes, currentEdges);
    currentNodes = updated.nodes;
    currentEdges = updated.edges;
  });

  return {
    nodes: currentNodes,
    edges: currentEdges,
  };
};
