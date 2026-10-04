import { Node, Edge } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { safeRandom } from './utils';
import { logger } from './logger';
import { SimulationContext, updateNodeData } from './simulationTypes';

const findConnectedPVCs = (dep: Node, ctx: SimulationContext): Node[] => {
  const childPods = dep.type === 'Pod' ? [dep] : (ctx.childPodMap?.get(dep.id) || []);
  const workloadIds = [dep.id, ...childPods.map(p => p.id)];
  const connectedPVCs: Node[] = [];

  for (const wId of workloadIds) {
    const outgoing = ctx.edgeMap?.get(wId) || [];
    const incoming = ctx.targetEdgeMap?.get(wId) || [];
    const allEdges = [...outgoing, ...incoming];

    for (const edge of allEdges) {
      const otherId = edge.source === wId ? edge.target : edge.source;
      const targetNode = ctx.nodeMap?.get(String(otherId)) || ctx.nodes.find(n => n.id === String(otherId));
      if (targetNode?.type === 'PVC' && !connectedPVCs.some(p => p.id === targetNode.id)) {
        connectedPVCs.push(targetNode);
      }
    }
  }

  return connectedPVCs;
};

const calculateWorkloadReplicaCount = (
  wNode: Node,
  connectedWorkloadIds: Set<string>
): number => {
  if (wNode.type === 'Deployment' || wNode.type === 'ReplicaSet') {
    const rep = Number(wNode.data?.replicas);
    return Number.isNaN(rep) || rep < 1 ? 1 : rep;
  }
  if (wNode.type === 'Pod') {
    const parentId = String(wNode.parentId || wNode.data?.parentId || '');
    if (!parentId || !connectedWorkloadIds.has(parentId)) {
      return 1;
    }
  }
  return 0;
};

/**
 * Calculates total active replicas connected to a PVC node across all connected workloads.
 */
export const countConnectedPvcReplicas = (
  pvc: Node,
  ctx: SimulationContext
): { totalReplicas: number; connectedEdges: Edge[] } => {
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

  let totalReplicas = 0;
  for (const wId of connectedWorkloadIds) {
    const wNode = ctx.nodeMap?.get(wId) || ctx.updatedNodes.find(n => n.id === wId) || ctx.nodes.find(n => n.id === wId);
    if (wNode) {
      totalReplicas += calculateWorkloadReplicaCount(wNode, connectedWorkloadIds);
    }
  }

  return { totalReplicas, connectedEdges };
};

const handlePvcMultiAttachError = (
  pvc: Node,
  totalReplicas: number,
  connectedEdges: Edge[],
  childPods: Node[],
  ctx: SimulationContext
): boolean => {
  let hasChanges = false;
  const errorMsg = `Multi-Attach Error: Volume "${pvc.data?.label || pvc.id}" (ReadWriteOnce) cannot be mounted by ${totalReplicas} replicas simultaneously`;

  if (pvc.data?.pvcStatus !== 'Multi-Attach Error') {
    if (updateNodeData(ctx, pvc.id, { pvcStatus: 'Multi-Attach Error' })) {
      hasChanges = true;
    }
    try {
      ctx.get()?.addLog?.('error', `[PVC Multi-Attach Error] ${errorMsg}. Workload pods set to Pending!`, 'Simulation');
    } catch (e) {
      logger.error('[PVC Simulation] Failed to add log', e);
    }
  }

  for (const edge of connectedEdges) {
    if (edge.data?.validationError !== errorMsg) {
      edge.data = { ...edge.data, validationError: errorMsg };
      hasChanges = true;
    }
  }

  for (const pod of childPods) {
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
      if (edge.data?.validationError?.includes('Multi-Attach Error')) {
        edge.data = { ...edge.data, validationError: undefined };
        hasChanges = true;
      }
    }
    try {
      ctx.get()?.addLog?.('info', `[PVC Multi-Attach Resolved] Multi-Attach conflict resolved for volume "${pvc.data?.label || pvc.id}".`, 'Simulation');
    } catch (e) {
      logger.error('[PVC Simulation] Failed to add log', e);
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
  const { totalReplicas, connectedEdges } = countConnectedPvcReplicas(pvc, ctx);

  if (accessMode === 'ReadWriteOnce' && totalReplicas > 1) {
    if (handlePvcMultiAttachError(pvc, totalReplicas, connectedEdges, childPods, ctx)) {
      hasChanges = true;
    }
    return { hasChanges, isBlocked: true };
  }

  if (resolvePvcMultiAttachError(pvc, connectedEdges, ctx)) {
    hasChanges = true;
  }

  const currentPvcNode = ctx.updatedNodes.find(n => n.id === pvc.id) || pvc;
  if (currentPvcNode.data?.pvcStatus !== 'Bound') {
    const unboundResult = handleUnboundPvcs([currentPvcNode], childPods, ctx);
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
    const res = evaluateSingleConnectedPvc(pvc, childPods, ctx);
    if (res.hasChanges) hasChanges = true;
    if (res.isBlocked) isBlocked = true;
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
    const pData = pod.data as K8sNodeData;
    const isReadyStatus = Boolean(pData.image);
    if (pData.status === 'pending' && isReadyStatus) {
      if (updateNodeData(ctx, pod.id, { status: 'ready' })) hasChanges = true;
    }
  });
  return { hasChanges, isBlocked: false };
};
