import { Node, Edge } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { safeRandom } from './utils';
import { logger } from './logger';
import { SimulationContext, updateNodeData } from './simulationTypes';
import {
  analyzePvcWorkloadConnections,
  getPvcValidationErrorMsg,
  PvcWorkloadAnalysis,
} from '@/activities/config/pvcConfigHelpers';

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

export interface PvcSimulationCountResult {
  totalReplicas: number;
  connectedEdges: Edge[];
  connectedPods: Node[];
  workerNodes: Set<string>;
  namespaceConflict?: PvcWorkloadAnalysis['namespaceConflict'];
  templateConflict?: PvcWorkloadAnalysis['templateConflict'];
  errorMsg?: string;
}

const resolveSimulationNodes = (ctx: SimulationContext): Node[] => {
  if (ctx.updatedNodes && ctx.updatedNodes.length > 0) {
    return ctx.updatedNodes;
  }
  if (ctx.nodes && ctx.nodes.length > 0) {
    return ctx.nodes;
  }
  return Array.from(ctx.nodeMap?.values() || []);
};

/**
 * Calculates total active replicas connected to a PVC node across all connected workloads,
 * delegating to the unified PVC workload analyzer.
 */
export const countConnectedPvcReplicas = (
  pvc: Node,
  ctx: SimulationContext
): PvcSimulationCountResult => {
  const currentNodes = resolveSimulationNodes(ctx);
  const analysis = analyzePvcWorkloadConnections(pvc, currentNodes, ctx.edges);
  const errorMsg = getPvcValidationErrorMsg(pvc, analysis);

  return {
    totalReplicas: analysis.totalReplicas,
    connectedEdges: analysis.connectedEdges,
    connectedPods: analysis.connectedPods,
    workerNodes: analysis.distinctWorkerNodes,
    namespaceConflict: analysis.namespaceConflict,
    templateConflict: analysis.templateConflict,
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
