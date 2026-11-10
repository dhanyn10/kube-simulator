import { Node, Edge } from '@xyflow/react';
import { getAssignedWorker, getWorkerForIndex } from './workerNodeHelpers';
import { resolveNodeNamespace } from './namespaceUtils';

export { resolveNodeNamespace };

/**
 * Extracts connected workload node IDs directly connected to the specified PVC node.
 */
export const getConnectedWorkloadIds = (pvcNodeId: string, edges: Edge[]): Set<string> => {
  const connectedWorkloadIds = new Set<string>();
  edges.forEach((e) => {
    if (e.source === pvcNodeId) connectedWorkloadIds.add(e.target);
    if (e.target === pvcNodeId) connectedWorkloadIds.add(e.source);
  });
  return connectedWorkloadIds;
};

/**
 * Finds all child pods belonging to a controller workload node.
 */
export const collectWorkloadChildPods = (workloadNode: Node, allNodes: Node[]): Node[] => {
  return allNodes.filter(
    (n) => n.type === 'Pod' && (n.parentId === workloadNode.id || n.data?.parentId === workloadNode.id)
  );
};

export interface PvcWorkloadAnalysis {
  totalReplicas: number;
  connectedEdges: Edge[];
  connectedPods: Node[];
  distinctWorkerNodes: Set<string>;
  namespaceConflict?: { pvcNs: string; workloadNs: string; workloadLabel: string };
  workerNodeConflict?: { workerNodes: string[] };
  templateConflict?: { statefulSetLabel: string; otherWorkloadLabel: string };
}

export const isStatefulSetNode = (node: Node): boolean => {
  return node.type === 'StatefulSet' || node.data?.workloadType === 'StatefulSet';
};

/**
 * Analyzes a controller workload node (Deployment, StatefulSet, ReplicaSet) for PVC connection.
 */
const resolveControllerWorkers = (
  node: Node,
  childPods: Node[],
  effectiveReplicas: number
): string[] => {
  const workers: string[] = [];
  const assigned = node.data?.assignedNode;

  if (childPods.length > 0) {
    childPods.forEach((p) => workers.push(getAssignedWorker(p.data, p.id)));
  }

  if (childPods.length < effectiveReplicas) {
    const missingCount = effectiveReplicas - childPods.length;
    for (let i = 0; i < missingCount; i++) {
      if (typeof assigned === 'string' && /^worker-\d+$/.test(assigned)) {
        workers.push(assigned);
      } else {
        workers.push(getWorkerForIndex(childPods.length + i));
      }
    }
  }

  return workers;
};

const analyzeControllerWorkload = (
  node: Node,
  allNodes: Node[]
): { replicas: number; pods: Node[]; workers: string[] } => {
  const isStatefulSet = isStatefulSetNode(node);
  const childPods = collectWorkloadChildPods(node, allNodes);

  if (isStatefulSet) {
    const firstPod = childPods[0];
    const worker = firstPod
      ? getAssignedWorker(firstPod.data, firstPod.id)
      : getAssignedWorker(node.data, node.id);
    return {
      replicas: 1,
      pods: firstPod ? [firstPod] : [],
      workers: [worker],
    };
  }

  const rep = Number(node.data?.replicas);
  const safeRep = Number.isNaN(rep) || rep < 1 ? 1 : rep;
  const effectiveReplicas = Math.max(childPods.length, safeRep);

  const workers = resolveControllerWorkers(node, childPods, effectiveReplicas);

  return {
    replicas: effectiveReplicas,
    pods: childPods,
    workers,
  };
};

interface WorkloadAccumulation {
  connectedPods: Node[];
  podIdsSeen: Set<string>;
  distinctWorkerNodes: Set<string>;
}

const checkWorkloadNamespaceConflict = (
  pvcNamespace: string,
  workloadNode: Node,
  nodes: Node[],
  currentConflict?: PvcWorkloadAnalysis['namespaceConflict']
): PvcWorkloadAnalysis['namespaceConflict'] => {
  if (currentConflict) return currentConflict;
  const workloadNamespace = resolveNodeNamespace(workloadNode, nodes);
  if (pvcNamespace !== workloadNamespace) {
    return {
      pvcNs: pvcNamespace,
      workloadNs: workloadNamespace,
      workloadLabel: String(workloadNode.data?.label || workloadNode.id),
    };
  }
  return undefined;
};

const isControllerWorkload = (node: Node): boolean => {
  return (
    node.type === 'Deployment' ||
    node.type === 'StatefulSet' ||
    node.type === 'ReplicaSet' ||
    node.data?.workloadType === 'StatefulSet'
  );
};

const addPodsAndWorkers = (
  target: WorkloadAccumulation,
  pods: Node[],
  workers: string[]
) => {
  for (const pod of pods) {
    if (!target.podIdsSeen.has(pod.id)) {
      target.podIdsSeen.add(pod.id);
      target.connectedPods.push(pod);
    }
  }
  for (const workerNode of workers) {
    target.distinctWorkerNodes.add(workerNode);
  }
};

const processStandalonePod = (
  node: Node,
  connectedIds: Set<string>,
  target: WorkloadAccumulation
): number => {
  const parentId = String(node.parentId || node.data?.parentId || '');
  if (parentId && connectedIds.has(parentId)) {
    return 0;
  }
  const workerNode = getAssignedWorker(node.data, node.id);
  addPodsAndWorkers(target, [node], [workerNode]);
  return 1;
};

const processConnectedWorkloadNode = (
  node: Node,
  connectedIds: Set<string>,
  nodes: Node[],
  target: WorkloadAccumulation
): number => {
  if (isControllerWorkload(node)) {
    const controllerAnalysis = analyzeControllerWorkload(node, nodes);
    addPodsAndWorkers(target, controllerAnalysis.pods, controllerAnalysis.workers);
    return controllerAnalysis.replicas;
  }
  if (node.type === 'Pod') {
    return processStandalonePod(node, connectedIds, target);
  }
  return 0;
};

const detectPvcTemplateConflict = (
  connectedNodes: Node[]
): PvcWorkloadAnalysis['templateConflict'] => {
  const workloads = connectedNodes.filter(
    (n) => isControllerWorkload(n) || n.type === 'Pod'
  );
  const statefulSets = workloads.filter(isStatefulSetNode);
  if (statefulSets.length === 0) return undefined;

  const firstSS = statefulSets[0];
  const firstSsLabel = String(firstSS.data?.label || firstSS.id);

  if (statefulSets.length > 1) {
    const secondSS = statefulSets[1];
    return {
      statefulSetLabel: firstSsLabel,
      otherWorkloadLabel: String(secondSS.data?.label || secondSS.id),
    };
  }

  const nonStatefulSets = workloads.filter(
    (n) =>
      !isStatefulSetNode(n) &&
      !(n.type === 'Pod' && (n.parentId === firstSS.id || n.data?.parentId === firstSS.id))
  );
  if (nonStatefulSets.length > 0) {
    const nonSS = nonStatefulSets[0];
    return {
      statefulSetLabel: firstSsLabel,
      otherWorkloadLabel: String(nonSS.data?.label || nonSS.id),
    };
  }

  return undefined;
};

/**
 * Analyzes all workloads, child pods, worker nodes, and namespaces connected to a PVC node.
 */
export const analyzePvcWorkloadConnections = (
  pvcNode: Node,
  nodes: Node[],
  edges: Edge[]
): PvcWorkloadAnalysis => {
  const connectedEdges = edges.filter((edge) => edge.source === pvcNode.id || edge.target === pvcNode.id);
  const connectedIds = getConnectedWorkloadIds(pvcNode.id, edges);
  const pvcNamespace = resolveNodeNamespace(pvcNode, nodes);

  let namespaceConflict: PvcWorkloadAnalysis['namespaceConflict'];
  const target: WorkloadAccumulation = {
    connectedPods: [],
    podIdsSeen: new Set<string>(),
    distinctWorkerNodes: new Set<string>(),
  };
  let totalReplicas = 0;
  const connectedWorkloadNodes: Node[] = [];

  for (const connectedId of connectedIds) {
    const targetNode = nodes.find((candidateNode) => candidateNode.id === connectedId);
    if (!targetNode) continue;

    connectedWorkloadNodes.push(targetNode);
    namespaceConflict = checkWorkloadNamespaceConflict(pvcNamespace, targetNode, nodes, namespaceConflict);
    totalReplicas += processConnectedWorkloadNode(targetNode, connectedIds, nodes, target);
  }

  const templateConflict = detectPvcTemplateConflict(connectedWorkloadNodes);

  const workerNodeConflict =
    target.distinctWorkerNodes.size > 1
      ? { workerNodes: Array.from(target.distinctWorkerNodes).sort((a, b) => a.localeCompare(b)) }
      : undefined;

  return {
    totalReplicas,
    connectedEdges,
    connectedPods: target.connectedPods,
    distinctWorkerNodes: target.distinctWorkerNodes,
    namespaceConflict,
    workerNodeConflict,
    templateConflict,
  };
};

/**
 * Generates descriptive error message for PVC validation conflicts.
 */
export const getPvcValidationErrorMsg = (
  pvcNode: Node,
  analysis: PvcWorkloadAnalysis
): string | undefined => {
  const pvcLabel = pvcNode.data?.label || pvcNode.id;
  const accessMode = pvcNode.data?.accessMode || 'ReadWriteOnce';

  if (analysis.namespaceConflict) {
    return `Cross-Namespace Binding Error: PVC "${pvcLabel}" in namespace "${analysis.namespaceConflict.pvcNs}" cannot be claimed by workload "${analysis.namespaceConflict.workloadLabel}" in namespace "${analysis.namespaceConflict.workloadNs}"`;
  }

  if (analysis.templateConflict) {
    return `Volume Claim Template Conflict: PVC "${pvcLabel}" is claimed as a StatefulSet volumeClaimTemplate by "${analysis.templateConflict.statefulSetLabel}" and cannot be shared with "${analysis.templateConflict.otherWorkloadLabel}"`;
  }

  if (accessMode === 'ReadWriteOnce') {
    if (analysis.workerNodeConflict && analysis.workerNodeConflict.workerNodes.length > 1) {
      const workerList = analysis.workerNodeConflict.workerNodes.join(', ');
      return `Multi-Attach Error: Volume "${pvcLabel}" (ReadWriteOnce) cannot be mounted on multiple worker nodes (${workerList}) simultaneously`;
    }
  }

  return undefined;
};

/**
 * Calculates total connected workload replicas for a given PVC node.
 */
export const calculatePvcConnectedReplicas = (
  pvcNodeId: string,
  nodes: Node[],
  edges: Edge[]
): number => {
  const pvcNode = nodes.find((n) => n.id === pvcNodeId);
  if (!pvcNode) return 0;
  const analysis = analyzePvcWorkloadConnections(pvcNode, nodes, edges);
  return analysis.totalReplicas;
};

/**
 * Determines target PVC status based on multi-attach / namespace conflicts and replica count.
 */
const determinePvcTargetStatus = (
  isConflict: boolean,
  connectedReplicas: number
): 'Multi-Attach Error' | 'Bound' | 'Pending' => {
  if (isConflict) return 'Multi-Attach Error';
  if (connectedReplicas > 0) return 'Bound';
  return 'Pending';
};

/**
 * Evaluates real-time PVC status based on connected workload replicas and PVC accessMode.
 */
export const evaluatePvcRealtimeStatus = (
  pvcNode: Node,
  nodes: Node[],
  edges: Edge[]
): 'Multi-Attach Error' | 'Bound' | 'Pending' => {
  const analysis = analyzePvcWorkloadConnections(pvcNode, nodes, edges);
  const accessMode = pvcNode.data?.accessMode || 'ReadWriteOnce';

  if (analysis.namespaceConflict || analysis.templateConflict) {
    return 'Multi-Attach Error';
  }

  if (accessMode === 'ReadWriteOnce') {
    if (analysis.workerNodeConflict) {
      return 'Multi-Attach Error';
    }
  }

  if (analysis.totalReplicas > 0) {
    return 'Bound';
  }

  return (pvcNode.data?.pvcStatus as 'Bound' | 'Pending') || 'Pending';
};

/**
 * Updates validation errors on canvas edges connected to a PVC node.
 */
const updatePvcEdges = (
  pvcNode: Node,
  edges: Edge[],
  isConflict: boolean,
  errorMsg?: string
): { edges: Edge[]; changed: boolean } => {
  let edgesChanged = false;

  const updatedEdges = edges.map((edge) => {
    if (edge.source !== pvcNode.id && edge.target !== pvcNode.id) {
      return edge;
    }

    if (isConflict && errorMsg) {
      if (edge.data?.validationError !== errorMsg) {
        edgesChanged = true;
        return { ...edge, data: { ...edge.data, validationError: errorMsg } };
      }
    } else if (
      typeof edge.data?.validationError === 'string' &&
      (edge.data.validationError.includes('Multi-Attach Error') ||
        edge.data.validationError.includes('Cross-Namespace Binding Error') ||
        edge.data.validationError.includes('Volume Claim Template Conflict'))
    ) {
      edgesChanged = true;
      return { ...edge, data: { ...edge.data, validationError: undefined } };
    }
    return edge;
  });

  return { edges: updatedEdges, changed: edgesChanged };
};

/**
 * Synchronizes Pod statuses for all workloads connected to a PVC node.
 */
const updateConnectedPodStatuses = (
  nodes: Node[],
  connectedPods: Node[],
  isConflict: boolean
): { nodes: Node[]; changed: boolean } => {
  if (connectedPods.length === 0) {
    return { nodes, changed: false };
  }

  const podIdSet = new Set(connectedPods.map((p) => p.id));
  let nodesChanged = false;

  const updatedNodes = nodes.map((node) => {
    if (node.type === 'Pod' && podIdSet.has(node.id)) {
      if (isConflict) {
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
 * Dedicated function to handle ReadWriteOnce (RWO) and Namespace PVC access mode validation and state synchronization.
 */
export const handlePvcRwoAccessMode = (
  pvcNode: Node,
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } => {
  const analysis = analyzePvcWorkloadConnections(pvcNode, nodes, edges);
  const accessMode = pvcNode.data?.accessMode || 'ReadWriteOnce';
  const isRWO = accessMode === 'ReadWriteOnce';

  const isConflict = Boolean(
    analysis.namespaceConflict ||
      analysis.templateConflict ||
      (isRWO && Boolean(analysis.workerNodeConflict))
  );

  let nodesChanged = false;
  let updatedNodes = [...nodes];

  const targetPvcStatus = determinePvcTargetStatus(isConflict, analysis.totalReplicas);
  if (pvcNode.data?.pvcStatus !== targetPvcStatus) {
    nodesChanged = true;
    updatedNodes = updatedNodes.map((n) =>
      n.id === pvcNode.id ? { ...n, data: { ...n.data, pvcStatus: targetPvcStatus } } : n
    );
  }

  const errorMsg = isConflict ? getPvcValidationErrorMsg(pvcNode, analysis) : undefined;
  const { edges: updatedEdges, changed: edgesChanged } = updatePvcEdges(
    pvcNode,
    edges,
    isConflict,
    errorMsg
  );

  const { nodes: syncedNodes, changed: podsChanged } = updateConnectedPodStatuses(
    updatedNodes,
    analysis.connectedPods,
    isConflict
  );

  return {
    nodes: nodesChanged || podsChanged ? syncedNodes : nodes,
    edges: edgesChanged ? updatedEdges : edges,
  };
};

/**
 * Synchronizes PVC statuses and connected edge validation errors in real-time across all PVC nodes on canvas.
 */
export const syncPvcRealtimeState = (
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } => {
  const pvcNodes = nodes.filter((n) => n.type === 'PVC');
  if (pvcNodes.length === 0) {
    let edgesChanged = false;
    const cleanedEdges = edges.map((e) => {
      if (
        typeof e.data?.validationError === 'string' &&
        (e.data.validationError.includes('Multi-Attach Error') ||
          e.data.validationError.includes('Cross-Namespace Binding Error') ||
          e.data.validationError.includes('Volume Claim Template Conflict'))
      ) {
        edgesChanged = true;
        return { ...e, data: { ...e.data, validationError: undefined } };
      }
      return e;
    });
    return { nodes, edges: edgesChanged ? cleanedEdges : edges };
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