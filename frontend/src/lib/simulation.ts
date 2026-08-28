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
  edgeMap?: Map<string, Edge[]>;
  targetEdgeMap?: Map<string, Edge[]>;
  nodeMap?: Map<string, Node>;
  childPodMap?: Map<string, Node[]>;
  internetNodes?: Node[];
  internetReachableMap?: Map<string, Set<string>>;
  nodeIndexMap?: Map<string, number>;
}

export const calculateReachability = (
  startNodes: Node[],
  edgeMap: Map<string, Edge[]>,
  activeSimulationEdges: string[] | Set<string>
): Set<string> => {
  const reachableNodes = new Set<string>();
  const queue = startNodes.map(n => n.id);
  const activeEdgesSet = activeSimulationEdges instanceof Set
    ? activeSimulationEdges
    : new Set(activeSimulationEdges);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (reachableNodes.has(currId)) continue;
    reachableNodes.add(currId);

    const outgoing = edgeMap.get(currId);
    if (!outgoing) continue;

    for (const e of outgoing) {
      if (activeEdgesSet.has(String(e.id)) && !e.data?.validationError) {
        queue.push(String(e.target));
      }
    }
  }
  return reachableNodes;
};

export const checkPvcReadiness = (dep: Node, ctx: SimulationContext): { hasChanges: boolean; isBlocked: boolean } => {
  const childPods = dep.type === 'Pod' ? [dep] : (ctx.childPodMap?.get(dep.id) || []);
  const workloadIds = [dep.id, ...childPods.map(p => p.id)];

  const connectedPVCs: Node[] = [];
  for (const wId of workloadIds) {
    const outgoing = ctx.edgeMap?.get(wId);
    if (!outgoing) continue;

    for (const edge of outgoing) {
      const targetNode = ctx.nodeMap?.get(String(edge.target));
      if (targetNode?.type === 'PVC') {
        connectedPVCs.push(targetNode);
      }
    }
  }

  const hasUnboundPVC = connectedPVCs.some(pvc => pvc.data.pvcStatus !== 'Bound');

  if (connectedPVCs.length > 0) {
    return hasUnboundPVC
      ? handleUnboundPvcs(connectedPVCs, childPods, ctx)
      : handleBoundPvcs(childPods, ctx);
  }

  return { hasChanges: false, isBlocked: false };
};

export const updateNodeData = (ctx: SimulationContext, id: string, newData: any) => {
  let idx = ctx.nodeIndexMap?.get(id);
  if (idx === undefined) {
    idx = ctx.updatedNodes.findIndex(un => un.id === id);
    if (idx !== -1) ctx.nodeIndexMap?.set(id, idx);
  }

  if (idx !== undefined && idx !== -1) {
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

export const calculateIncomingTraffic = (dep: Node, ctx: SimulationContext): { traffic: number; hasChanges: boolean } => {
  let totalTraffic = 0;

  if (!ctx.internetNodes || !ctx.internetReachableMap) return { traffic: 0, hasChanges: false };

  for (const node of ctx.internetNodes) {
    const reachableNodes = ctx.internetReachableMap.get(node.id);
    if (!reachableNodes) continue;

    const nData = node.data as K8sNodeData;
    const internetTraffic = nData.currentTraffic || 0;
    const unit = nData.durationUnit || 'second';

    let multiplier = 1;
    if (unit === 'millisecond') {
      multiplier = 1000;
    } else if (unit === 'minute') {
      multiplier = 1 / 60;
    }
    const effectiveTraffic = internetTraffic * multiplier;

    let canReach = reachableNodes.has(dep.id);
    if (!canReach) {
      const children = ctx.childPodMap?.get(dep.id) || [];
      for (const child of children) {
        if (reachableNodes.has(child.id)) {
          canReach = true;
          break;
        }
      }
    }

    if (canReach) {
      totalTraffic += effectiveTraffic;
    }
  }

  return { traffic: totalTraffic, hasChanges: false };
};

export const updateInternetTraffic = (internet: Node, ctx: SimulationContext) => {
  const iData = internet.data as K8sNodeData;
  const targetTraffic = iData.traffic ?? 1000;
  const currentTraffic = iData.currentTraffic ?? 0;
  let nextTraffic = currentTraffic;

  if (currentTraffic < targetTraffic) {
    nextTraffic = Math.min(targetTraffic, currentTraffic + 1000);
  } else if (currentTraffic > targetTraffic) {
    nextTraffic = Math.max(targetTraffic, currentTraffic - 2000);
  }

  let hasChanges = false;
  if (nextTraffic !== currentTraffic) {
    hasChanges = updateNodeData(ctx, internet.id, { currentTraffic: nextTraffic });
  }
  return { traffic: nextTraffic, hasChanges };
};

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

export const handleOomCrashes = (dep: Node, isOOM: boolean, ctx: SimulationContext) => {
  if (!isOOM || safeRandom() <= 0.5) return false;

  const childPods = dep.type === 'Pod' ? [dep] : (ctx.childPodMap?.get(dep.id) || []);
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

const findConnectedHPA = (depId: string, ctx: SimulationContext): Node | undefined => {
  const incoming = ctx.targetEdgeMap?.get(depId);
  if (!incoming) return undefined;

  for (const edge of incoming) {
    const sourceNode = ctx.nodeMap?.get(String(edge.source));
    if (sourceNode?.type === 'HPA') {
      return sourceNode;
    }
  }
  return undefined;
};

const calculateDesiredReplicas = (
  replicas: number,
  cpuPercent: number,
  hpaData: K8sNodeData
): number => {
  const targetCPU = hpaData.targetCPU || 50;
  const cpuRatio = cpuPercent / targetCPU;

  let desired = replicas;
  if (Math.abs(1 - cpuRatio) > 0.1) {
    desired = Math.max(hpaData.minReplicas || 1, Math.min(hpaData.maxReplicas || 10, Math.ceil(replicas * cpuRatio)));
  }

  if (desired < replicas && safeRandom() < 0.7) {
    desired = replicas;
  }
  return desired;
};

export const handleHpaScaling = (dep: Node, cpuPercent: number, ctx: SimulationContext): boolean => {
  const connectedHPA = findConnectedHPA(dep.id, ctx);
  if (!connectedHPA) return false;

  let hasChanges = false;
  const hpaData = connectedHPA.data as K8sNodeData;
  const replicas = (dep.data as K8sNodeData).replicas || 1;
  const desiredReplicas = calculateDesiredReplicas(replicas, cpuPercent, hpaData);

  if (desiredReplicas !== replicas) {
    const nodeIndex = ctx.nodeIndexMap?.get(dep.id) ?? ctx.updatedNodes.findIndex(n => n.id === dep.id);
    if (nodeIndex !== -1) {
      const { updatedDeployment, laidOut } = syncDeployment(ctx.updatedNodes[nodeIndex], ctx.updatedNodes, desiredReplicas - replicas, ctx.get);

      const filteredNodes = ctx.updatedNodes.filter(n => n.id !== dep.id && n.parentId !== dep.id);
      ctx.updatedNodes.length = 0;
      ctx.updatedNodes.push(...filteredNodes, updatedDeployment, ...laidOut);

      ctx.nodeIndexMap?.clear();
      hasChanges = true;
    }
  }

  if (updateNodeData(ctx, connectedHPA.id, { currentCPU: Math.round(cpuPercent) })) {
    hasChanges = true;
  }

  return hasChanges;
};

export const processWorkloadSimulation = (dep: Node, ctx: SimulationContext): { hasChanges: boolean } => {
  const pvcResult = checkPvcReadiness(dep, ctx);
  if (pvcResult.isBlocked) return { hasChanges: pvcResult.hasChanges };

  const trafficResult = calculateIncomingTraffic(dep, ctx);
  const metricsResult = calculateResourceMetrics(dep, trafficResult.traffic, ctx);

  const oomChanged = handleOomCrashes(dep, metricsResult.isOOM, ctx);
  const hpaChanged = handleHpaScaling(dep, metricsResult.cpuPercent, ctx);

  return { hasChanges: pvcResult.hasChanges || oomChanged || hpaChanged };
};
