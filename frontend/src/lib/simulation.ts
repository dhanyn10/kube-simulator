import { Node, Edge } from '@xyflow/react';
import { K8sNodeData } from '../types';
import { SimulationMetricPoint, FlowState } from '../store/types';
import { parseCPU, parseMemory, safeRandom } from './utils';
import { syncDeployment } from '../store/nodeHelpers';

export interface SimulationContext {
  nodes: Node[];
  edges: Edge[];
  activeSimulationEdges: string[];
  updatedNodes: Node[];
  newMetrics: Record<string, SimulationMetricPoint[]>;
  ticks: number;
  get: () => FlowState;
  set: (state: Partial<FlowState>) => void;
}

/**
 * Calculates which nodes are reachable from a set of starting nodes given active edges.
 */
export const calculateReachability = (startNodes: Node[], edges: Edge[], activeSimulationEdges: string[]): Set<string> => {
  const reachableNodes = new Set<string>();
  const queue = startNodes.map(n => n.id);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (reachableNodes.has(currId)) continue;
    reachableNodes.add(currId);

    for (const e of edges) {
      if (activeSimulationEdges.includes(String(e.id)) && String(e.source) === currId) {
        queue.push(String(e.target));
      }
    }
  }
  return reachableNodes;
};

/**
 * Handles PVC readiness logic. Pods remain pending if their connected PVCs are not Bound.
 */
export const checkPvcReadiness = (dep: Node, ctx: SimulationContext) => {
  const childPods = dep.type === 'Pod' ? [dep] : ctx.nodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
  const workloadIds = [dep.id, ...childPods.map(p => p.id)];

  const connectedPVCs = ctx.nodes.filter(n =>
    n.type === 'PVC' && ctx.edges.some(e => String(e.target) === n.id && workloadIds.includes(String(e.source)))
  );

  const hasUnboundPVC = connectedPVCs.some(pvc => pvc.data.pvcStatus !== 'Bound');

  if (connectedPVCs.length > 0) {
    return hasUnboundPVC
      ? handleUnboundPvcs(connectedPVCs, childPods, ctx)
      : handleBoundPvcs(childPods, ctx);
  }

  return { hasChanges: false, isBlocked: false };
};

export const updateNodeData = (ctx: SimulationContext, id: string, newData: any) => {
  const idx = ctx.updatedNodes.findIndex(un => un.id === id);
  if (idx !== -1) {
    ctx.updatedNodes[idx] = {
      ...ctx.updatedNodes[idx],
      data: { ...ctx.updatedNodes[idx].data, ...newData }
    };
    return true;
  }
  return false;
};

export const handleUnboundPvcs = (connectedPVCs: Node[], childPods: Node[], ctx: SimulationContext) => {
  let hasChanges = false;

  connectedPVCs.forEach(pvc => {
    if (pvc.data.pvcStatus !== 'Bound' && safeRandom() > 0.7) {
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

export const handleBoundPvcs = (childPods: Node[], ctx: SimulationContext) => {
  let hasChanges = false;
  childPods.forEach(pod => {
    const pData = pod.data as K8sNodeData;
    const isReadyStatus = !!(pData.webserver && pData.webserver !== 'none') || !!(pData.runtime && pData.runtime !== 'none');
    if (pData.status === 'pending' && isReadyStatus) {
      if (updateNodeData(ctx, pod.id, { status: 'ready' })) hasChanges = true;
    }
  });
  return { hasChanges, isBlocked: false };
};

/**
 * Calculates incoming traffic for a workload based on 'Internet' nodes.
 */
export const calculateIncomingTraffic = (dep: Node, ctx: SimulationContext) => {
  let hasChanges = false;
  const traffic = ctx.nodes
    .filter(n => n.type === 'Internet')
    .reduce((total, internet) => {
      const { traffic: internetTraffic, hasChanges: internetChanges } = updateInternetTraffic(internet, ctx);
      if (internetChanges) hasChanges = true;

      const reachableNodes = calculateReachability([internet], ctx.edges, ctx.activeSimulationEdges);
      const canReach = reachableNodes.has(dep.id) || ctx.nodes.some(n => n.parentId === dep.id && reachableNodes.has(n.id));

      return total + (canReach ? internetTraffic : 0);
    }, 0);

  return { traffic, hasChanges };
};

export const updateInternetTraffic = (internet: Node, ctx: SimulationContext) => {
  const iData = internet.data as K8sNodeData;
  const targetTraffic = iData.traffic ?? 1000;
  const currentTraffic = iData.currentTraffic ?? 0;
  let nextTraffic = currentTraffic;

  if (currentTraffic < targetTraffic) {
    nextTraffic = Math.min(targetTraffic as number, currentTraffic + 1000);
  } else if (currentTraffic > targetTraffic) {
    nextTraffic = Math.max(targetTraffic as number, currentTraffic - 2000);
  }

  let hasChanges = false;
  if (nextTraffic !== currentTraffic) {
    hasChanges = updateNodeData(ctx, internet.id, { currentTraffic: nextTraffic });
  }
  return { traffic: nextTraffic, hasChanges };
};

/**
 * Computes resource usage metrics (CPU, Memory) based on incoming traffic.
 */
export const calculateResourceMetrics = (dep: Node, incomingTraffic: number, ctx: SimulationContext) => {
  const dData = dep.data as K8sNodeData;
  const replicas = (dData.replicas as number) || 1;
  const cpuLimitMilli = parseCPU(dData.cpuLimit);
  const memLimitMiB = parseMemory(dData.memoryLimit);

  const noise = () => (safeRandom() * 20 - 10);
  const cpuValue = Math.max(10, Math.min(((incomingTraffic / 1000) * 200 / replicas) + 50 + noise(), cpuLimitMilli));
  const memValue = Math.max(20, Math.min(((incomingTraffic / 1000) * 128 / replicas) + 100 + noise(), memLimitMiB));

  const isThrottled = cpuValue >= cpuLimitMilli;
  const isOOM = memValue >= memLimitMiB;

  const cpuPercent = (cpuValue / cpuLimitMilli) * 100;
  const memoryPercent = (memValue / memLimitMiB) * 100;

  const existing = ctx.newMetrics[dep.id] || [];
  ctx.newMetrics[dep.id] = [...existing, {
    cpuPercent, memoryPercent, cpuValue, memoryValue: memValue,
    cpuLimit: cpuLimitMilli, memoryLimit: memLimitMiB, isThrottled, isOOM
  }].slice(-30);

  return { cpuPercent, isOOM };
};

/**
 * Simulates pod crashes due to OOM (Out Of Memory) conditions.
 */
export const handleOomCrashes = (dep: Node, isOOM: boolean, ctx: SimulationContext) => {
  if (!isOOM || safeRandom() <= 0.5) return false;

  const childPods = dep.type === 'Pod' ? [dep] : ctx.updatedNodes.filter(n => n.parentId === dep.id && n.type === 'Pod');
  if (childPods.length === 0) return false;

  const podToCrash = childPods[Math.floor(safeRandom() * childPods.length)];
  if (podToCrash.data.status === 'crashing') return false;

  const changed = updateNodeData(ctx, podToCrash.id, { status: 'crashing' });
  if (changed) scheduleRecovery(dep, podToCrash.id, ctx);
  return changed;
};

export const scheduleRecovery = (dep: Node, podId: string, ctx: SimulationContext) => {
  setTimeout(() => {
    const currentState = ctx.get();
    const nodeToRecover = currentState.nodes.find(n => n.id === podId);
    if (nodeToRecover?.data.status !== 'crashing') return;

    currentState.deleteNodes([nodeToRecover]);
    setTimeout(() => {
      const latestState = ctx.get();
      const parentDep = latestState.nodes.find(n => n.id === dep.id);
      if (!parentDep) return;

      const { updatedDeployment, laidOut } = syncDeployment(parentDep, latestState.nodes, 0, ctx.get);
      const filteredNodes = latestState.nodes.filter(n => n.id !== dep.id && n.parentId !== dep.id);
      ctx.set({ nodes: [...filteredNodes, updatedDeployment, ...laidOut] });
    }, 2000);
  }, 3000);
};

/**
 * Handles Horizontal Pod Autoscaler (HPA) scaling logic.
 */
export const handleHpaScaling = (dep: Node, cpuPercent: number, ctx: SimulationContext) => {
  const connectedHPA = ctx.nodes.find(n => n.type === 'HPA' && ctx.edges.some(e => e.source === n.id && e.target === dep.id));
  if (!connectedHPA) return false;

  let hasChanges = false;
  const hpaData = connectedHPA.data as K8sNodeData;
  const replicas = (dep.data as K8sNodeData).replicas || 1;
  const targetCPU = hpaData.targetCPU || 50;
  const cpuRatio = cpuPercent / targetCPU;

  let desiredReplicas = replicas;
  if (Math.abs(1 - cpuRatio) > 0.1) {
    desiredReplicas = Math.max(hpaData.minReplicas || 1, Math.min(hpaData.maxReplicas || 10, Math.ceil(replicas * cpuRatio)));
  }

  // Add some dampening/hysteresis to avoid flapping
  if (desiredReplicas < replicas && safeRandom() < 0.7) desiredReplicas = replicas;

  if (desiredReplicas !== replicas) {
    const nodeIndex = ctx.updatedNodes.findIndex(n => n.id === dep.id);
    if (nodeIndex !== -1) {
      const { updatedDeployment, laidOut } = syncDeployment(ctx.updatedNodes[nodeIndex], ctx.updatedNodes, desiredReplicas - replicas, ctx.get);
      const filteredNodes = ctx.updatedNodes.filter(n => n.id !== dep.id && n.parentId !== dep.id);
      ctx.updatedNodes.length = 0;
      ctx.updatedNodes.push(...filteredNodes, updatedDeployment, ...laidOut);
      hasChanges = true;
    }
  }

  if (updateNodeData(ctx, connectedHPA.id, { currentCPU: Math.round(cpuPercent) })) {
    hasChanges = true;
  }

  return hasChanges;
};

/**
 * Core entry point for processing simulation tick for a workload (Deployment/Pod).
 */
export const processWorkloadSimulation = (dep: Node, ctx: SimulationContext): { hasChanges: boolean } => {
  const pvcResult = checkPvcReadiness(dep, ctx);
  if (pvcResult.isBlocked) return { hasChanges: pvcResult.hasChanges };

  const trafficResult = calculateIncomingTraffic(dep, ctx);
  const metricsResult = calculateResourceMetrics(dep, trafficResult.traffic, ctx);

  const oomChanged = handleOomCrashes(dep, metricsResult.isOOM, ctx);
  const hpaChanged = handleHpaScaling(dep, metricsResult.cpuPercent, ctx);

  return { hasChanges: pvcResult.hasChanges || trafficResult.hasChanges || oomChanged || hpaChanged };
};
