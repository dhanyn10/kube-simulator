import { Node, Edge } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { safeRandom } from './utils';
import { logger } from './logger';
import { SimulationContext, updateNodeData } from './simulationTypes';
import { getAssignedWorker } from './workerNodeHelpers';
import { resolveNodeNamespace } from '@/activities/config/pvcConfigHelpers';

const findConnectedPVCs = (dep: Node, ctx: SimulationContext): Node[] => {
  const childPods = dep.type === 'Pod' ? [dep] : (ctx.childPodMap?.get(dep.id) || []);
  const workloadIds = [dep.id, ...childPods.map(pod => pod.id)];
  const connectedPVCs: Node[] = [];

  for (const workloadId of workloadIds) {
    const outgoing = ctx.edgeMap?.get(workloadId) || [];
    const incoming = ctx.targetEdgeMap?.get(workloadId) || [];
    const allEdges = [...outgoing, ...incoming];

    for (const edge of allEdges) {
      const otherId = edge.source === workloadId ? edge.target : edge.source;
      const targetNode = ctx.nodeMap?.get(String(otherId)) || ctx.nodes.find(node => node.id === String(otherId));
      if (targetNode?.type === 'PVC' && !connectedPVCs.some(pvc => pvc.id === targetNode.id)) {
        connectedPVCs.push(targetNode);
      }
    }
  }

  return connectedPVCs;
};

interface SimulationWorkloadResult {
  replicas: number;
  pods: Node[];
  workers: string[];
}

const analyzeSimulationController = (
  node: Node,
  ctx: SimulationContext
): SimulationWorkloadResult => {
  const isStatefulSet = node.data?.workloadType === 'StatefulSet';
  const childPods =
    ctx.childPodMap?.get(node.id) ||
    ctx.updatedNodes.filter(
      (n) => n.type === 'Pod' && (n.parentId === node.id || n.data?.parentId === node.id)
    ) ||
    [];

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

  const workers: string[] = [];
  if (childPods.length > 0) {
    childPods.forEach((p) => workers.push(getAssignedWorker(p.data, p.id)));
  } else {
    workers.push(getAssignedWorker(node.data, node.id));
  }

  return {
    replicas: effectiveReplicas,
    pods: childPods,
    workers,
  };
};

export interface PvcSimulationCountResult {
  totalReplicas: number;
  connectedEdges: Edge[];
  connectedPods: Node[];
  workerNodes: Set<string>;
  namespaceConflict?: { pvcNs: string; workloadNs: string; workloadLabel: string };
  errorMsg?: string;
}

const formatSimulationPvcError = (
  pvc: Node,
  totalReplicas: number,
  workerNodes: Set<string>,
  namespaceConflict?: { pvcNs: string; workloadNs: string; workloadLabel: string }
): string | undefined => {
  const pvcLabel = pvc.data?.label || pvc.id;
  const accessMode = pvc.data?.accessMode || 'ReadWriteOnce';

  if (namespaceConflict) {
    return `Cross-Namespace Binding Error: PVC "${pvcLabel}" in namespace "${namespaceConflict.pvcNs}" cannot be claimed by workload "${namespaceConflict.workloadLabel}" in namespace "${namespaceConflict.workloadNs}"`;
  }

  if (accessMode === 'ReadWriteOnce') {
    if (workerNodes.size > 1) {
      const workerList = Array.from(workerNodes).sort().join(', ');
      return `Multi-Attach Error: Volume "${pvcLabel}" (ReadWriteOnce) cannot be mounted on multiple worker nodes (${workerList}) simultaneously`;
    }
    if (totalReplicas > 1) {
      return `Multi-Attach Error: Volume "${pvcLabel}" (ReadWriteOnce) cannot be mounted by ${totalReplicas} replicas simultaneously`;
    }
  }

  return undefined;
};

/**
 * Calculates total active replicas connected to a PVC node across all connected workloads,
 * gathering child pods, worker nodes, and namespace isolation constraints.
 */
export const countConnectedPvcReplicas = (
  pvc: Node,
  ctx: SimulationContext
): PvcSimulationCountResult => {
  const connectedEdges: Edge[] = [];
  const connectedWorkloadIds = new Set<string>();

  for (const edge of ctx.edges) {
    if (edge.source === pvc.id) {
      connectedEdges.push(edge);
      connectedWorkloadIds.add(edge.target);
    } else if (edge.target === pvc.id) {
      connectedEdges.push(edge);
      connectedWorkloadIds.add(edge.source);
    }
  }

  const pvcNs = resolveNodeNamespace(pvc, ctx.nodes);
  let namespaceConflict: PvcSimulationCountResult['namespaceConflict'];
  const workerNodes = new Set<string>();
  const connectedPods: Node[] = [];
  const podIdsSeen = new Set<string>();
  let totalReplicas = 0;

  for (const workloadId of connectedWorkloadIds) {
    const workloadNode =
      ctx.nodeMap?.get(workloadId) ||
      ctx.updatedNodes.find((node) => node.id === workloadId) ||
      ctx.nodes.find((node) => node.id === workloadId);
    if (!workloadNode) continue;

    const workloadNs = resolveNodeNamespace(workloadNode, ctx.nodes);
    if (pvcNs && workloadNs && pvcNs !== workloadNs && !namespaceConflict) {
      namespaceConflict = {
        pvcNs,
        workloadNs,
        workloadLabel: workloadNode.data?.label || workloadNode.id,
      };
    }

    if (
      workloadNode.type === 'Deployment' ||
      workloadNode.type === 'StatefulSet' ||
      workloadNode.type === 'ReplicaSet' ||
      workloadNode.data?.workloadType === 'StatefulSet'
    ) {
      const res = analyzeSimulationController(workloadNode, ctx);
      totalReplicas += res.replicas;
      res.pods.forEach((p) => {
        if (!podIdsSeen.has(p.id)) {
          podIdsSeen.add(p.id);
          connectedPods.push(p);
        }
      });
      res.workers.forEach((w) => workerNodes.add(w));
    } else if (workloadNode.type === 'Pod') {
      const parentId = String(workloadNode.parentId || workloadNode.data?.parentId || '');
      if (!parentId || !connectedWorkloadIds.has(parentId)) {
        if (!podIdsSeen.has(workloadNode.id)) {
          podIdsSeen.add(workloadNode.id);
          connectedPods.push(workloadNode);
        }
        totalReplicas += 1;
        workerNodes.add(getAssignedWorker(workloadNode.data, workloadNode.id));
      }
    }
  }

  const errorMsg = formatSimulationPvcError(pvc, totalReplicas, workerNodes, namespaceConflict);

  return {
    totalReplicas,
    connectedEdges,
    connectedPods,
    workerNodes,
    namespaceConflict,
    errorMsg,
  };
};

const handlePvcMultiAttachError = (
  pvc: Node,
  totalReplicas: number,
  connectedEdges: Edge[],
  allPodsToUpdate: Node[],
  ctx: SimulationContext,
  customErrorMsg?: string
): boolean => {
  let hasChanges = false;
  const errorMsg =
    customErrorMsg ||
    `Multi-Attach Error: Volume "${pvc.data?.label || pvc.id}" (ReadWriteOnce) cannot be mounted by ${totalReplicas} replicas simultaneously`;

  if (pvc.data?.pvcStatus !== 'Multi-Attach Error') {
    if (updateNodeData(ctx, pvc.id, { pvcStatus: 'Multi-Attach Error' })) {
      hasChanges = true;
    }
    try {
      ctx.get()?.addLog?.('error', `[PVC Multi-Attach Error] ${errorMsg}. Workload pods set to Pending!`, 'Simulation');
    } catch (error) {
      logger.error('[PVC Simulation] Failed to add log', error);
    }
  }

  for (const edge of connectedEdges) {
    if (edge.data?.validationError !== errorMsg) {
      edge.data = { ...edge.data, validationError: errorMsg };
      hasChanges = true;
    }
  }

  for (const pod of allPodsToUpdate) {
    if (pod.data?.status === 'ready') {
      if (updateNodeData(ctx, pod.id, { status: 'pending' })) {
        hasChanges = true;
      }
    }
  }

  return hasChanges;
};

const resolvePvcMultiAttachError = (
  pvc: Node,
  connectedEdges: Edge[],
  ctx: SimulationContext
): boolean => {
  let hasChanges = false;
  if (pvc.data?.pvcStatus === 'Multi-Attach Error') {
    if (updateNodeData(ctx, pvc.id, { pvcStatus: 'Bound' })) {
      hasChanges = true;
    }
    for (const edge of connectedEdges) {
      if (
        edge.data?.validationError?.includes('Multi-Attach Error') ||
        edge.data?.validationError?.includes('Cross-Namespace Binding Error')
      ) {
        edge.data = { ...edge.data, validationError: undefined };
        hasChanges = true;
      }
    }
    try {
      ctx.get()?.addLog?.('info', `[PVC Multi-Attach Resolved] Multi-Attach conflict resolved for volume "${pvc.data?.label || pvc.id}".`, 'Simulation');
    } catch (error) {
      logger.error('[PVC Simulation] Failed to add log', error);
    }
  }
  return hasChanges;
};

const evaluateSingleConnectedPvc = (
  pvc: Node,
  childPods: Node[],
  ctx: SimulationContext
): { hasChanges: boolean; isBlocked: boolean } => {
  let hasChanges = false;
  let isBlocked = false;

  const accessMode = pvc.data?.accessMode || 'ReadWriteOnce';
  const { totalReplicas, connectedEdges, connectedPods, workerNodes, namespaceConflict, errorMsg } =
    countConnectedPvcReplicas(pvc, ctx);

  const isConflict = Boolean(
    namespaceConflict ||
      (accessMode === 'ReadWriteOnce' && (workerNodes.size > 1 || totalReplicas > 1))
  );

  const podsToUpdate = Array.from(new Set([...childPods, ...connectedPods]));

  if (isConflict) {
    if (handlePvcMultiAttachError(pvc, totalReplicas, connectedEdges, podsToUpdate, ctx, errorMsg)) {
      hasChanges = true;
    }
    return { hasChanges, isBlocked: true };
  }

  if (resolvePvcMultiAttachError(pvc, connectedEdges, ctx)) {
    hasChanges = true;
  }

  const currentPvcNode = ctx.updatedNodes.find((node) => node.id === pvc.id) || pvc;
  if (currentPvcNode.data?.pvcStatus !== 'Bound') {
    const unboundResult = handleUnboundPvcs([currentPvcNode], podsToUpdate, ctx);
    if (unboundResult.hasChanges) hasChanges = true;
    isBlocked = true;
  }

  return { hasChanges, isBlocked };
};

/**
 * Checks PVC binding status and access mode limits for connected workload nodes,
 * marking pods as pending and triggering Multi-Attach Error if ReadWriteOnce limits are exceeded.
 */
export const checkPvcReadiness = (dep: Node, ctx: SimulationContext): { hasChanges: boolean; isBlocked: boolean } => {
  const childPods = dep.type === 'Pod' ? [dep] : (ctx.childPodMap?.get(dep.id) || []);
  const connectedPVCs = findConnectedPVCs(dep, ctx);

  if (connectedPVCs.length === 0) {
    return { hasChanges: false, isBlocked: false };
  }

  let hasChanges = false;
  let isBlocked = false;

  for (const pvc of connectedPVCs) {
    const result = evaluateSingleConnectedPvc(pvc, childPods, ctx);
    if (result.hasChanges) hasChanges = true;
    if (result.isBlocked) isBlocked = true;
  }

  if (!isBlocked) {
    const boundResult = handleBoundPvcs(childPods, ctx);
    if (boundResult.hasChanges) hasChanges = true;
  }

  return { hasChanges, isBlocked };
};

/**
 * Handles unbound PVC state by attempting binding and updating dependent pod statuses to pending.
 */
export const handleUnboundPvcs = (connectedPVCs: Node[], childPods: Node[], ctx: SimulationContext) => {
  let hasChanges = false;

  connectedPVCs.forEach(pvc => {
    if (pvc.data.pvcStatus !== 'Bound' && pvc.data.pvcStatus !== 'Multi-Attach Error' && safeRandom() > 0.7) {
      if (updateNodeData(ctx, pvc.id, { pvcStatus: 'Bound' })) hasChanges = true;
    }
  });

  childPods.forEach(pod => {
    if (pod.data.status === 'ready') {
      if (updateNodeData(ctx, pod.id, { status: 'pending' })) hasChanges = true;
    }
  });

  return { hasChanges, isBlocked: true };
};

/**
 * Handles bound PVC state by restoring pending pods to ready when container runtimes are configured.
 */
export const handleBoundPvcs = (childPods: Node[], ctx: SimulationContext) => {
  let hasChanges = false;
  childPods.forEach(pod => {
    const podData = pod.data as K8sNodeData;
    const isReadyStatus = Boolean(podData.image);
    if (podData.status === 'pending' && isReadyStatus) {
      if (updateNodeData(ctx, pod.id, { status: 'ready' })) hasChanges = true;
    }
  });
  return { hasChanges, isBlocked: false };
};
