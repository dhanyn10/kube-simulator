import { Node, Edge } from '@xyflow/react';
import { K8sNodeData } from '../types';
import { SimulationMetricPoint, FlowState } from '../store/types';
import { parseCPU, parseMemory, safeRandom } from './utils';
import { syncDeployment } from '../store/nodeHelpers';

/**
 * Context payload containing the pre-calculated states, cache lookups,
 * and mutations during a single simulation iteration tick.
 */
export interface SimulationContext {
  /** The current immutable list of nodes in the workspace */
  nodes: Node[];
  /** The current list of edges in the workspace */
  edges: Edge[];
  /** Array of currently active edge IDs carrying virtual traffic flow */
  activeSimulationEdges: string[];
  /** Mutable clone of nodes being modified during the tick */
  updatedNodes: Node[];
  /** Accrued history of performance metrics (CPU/Mem percent and values) for each node */
  newMetrics: Record<string, SimulationMetricPoint[]>;
  /** Total elapsed clock ticks since the simulation started */
  ticks: number;
  /** Returns the current active Zustand store state */
  get: () => FlowState;
  /** Updates the Zustand store with partial state */
  set: (state: Partial<FlowState>) => void;
  /** Fast cache mapping sourceNodeId -> outgoing Edge array */
  edgeMap?: Map<string, Edge[]>;
  /** Fast cache mapping targetNodeId -> incoming Edge array */
  targetEdgeMap?: Map<string, Edge[]>;
  /** Fast cache mapping nodeId -> Node object */
  nodeMap?: Map<string, Node>;
  /** Fast cache mapping parentId -> children Pod nodes array */
  childPodMap?: Map<string, Node[]>;
  /** List of top-level internet gateway nodes */
  internetNodes?: Node[];
  /** Cache of node IDs reachable from each internet gateway node */
  internetReachableMap?: Map<string, Set<string>>;
  /** Fast index mapping node.id -> array index in updatedNodes */
  nodeIndexMap?: Map<string, number>;
}

/**
 * Calculates which nodes are reachable from a set of starting nodes using BFS traversal.
 * Uses a pre-computed adjacency map for fast, high-performance O(1) lookups.
 *
 * @param startNodes - Array of origin nodes (e.g., Internet source nodes)
 * @param edgeMap - Pre-calculated map of outgoing edges per node
 * @param activeSimulationEdges - Active visual edges to traverse
 * @returns A Set of reachable node IDs
 */
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

/**
 * Validates Persistent Volume Claim (PVC) bindings and readiness.
 * Standalone/workload pods remain in a 'pending' state until all attached PVC nodes are fully bound.
 *
 * @param dep - Workload or standalone Pod node to check
 * @param ctx - The active simulation tick context
 * @returns Object indicating whether any changes occurred and if the workload is currently blocked
 */
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

/**
 * Sums up incoming virtual network traffic flowing into a workload or Pod.
 * It traverses connectivity from all active 'Internet' traffic nodes down to this target.
 *
 * @param dep - Target workload node receiving traffic
 * @param ctx - The active simulation tick context
 * @returns Object indicating total computed traffic load (in requests/sec) and change status
 */
export const calculateIncomingTraffic = (dep: Node, ctx: SimulationContext): { traffic: number; hasChanges: boolean } => {
  let totalTraffic = 0;

  if (!ctx.internetNodes || !ctx.internetReachableMap) return { traffic: 0, hasChanges: false };

  for (const node of ctx.internetNodes) {
    const reachableNodes = ctx.internetReachableMap.get(node.id);
    if (!reachableNodes) continue;

    const internetTraffic = (node.data as K8sNodeData).currentTraffic || 0;

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
      totalTraffic += internetTraffic;
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

/**
 * Calculates resource utilization metrics (virtual CPU millicores and Memory MiB)
 * based on incoming request load, number of replicas, and config limits.
 *
 * @param dep - Target workload node
 * @param incomingTraffic - Total requests/sec load
 * @param ctx - The active simulation tick context
 * @returns Calculated CPU percentage use and boolean flag if the workload hit Out-Of-Memory (OOM) limits
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
 * Models dynamic Out-Of-Memory (OOM) crashes when pod memory utilization hits limits.
 * A single replica pod is randomly crashed and schedules a recovery sequence.
 *
 * @param dep - Workload parent node
 * @param isOOM - Whether memory limit has been exceeded
 * @param ctx - The active simulation tick context
 * @returns True if a crash event was triggered
 */
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

/**
 * Processes Kubernetes Horizontal Pod Autoscaler (HPA) auto-scaling algorithms.
 * Calculates desired replicas based on CPU utilization and triggers scale-up/scale-down actions,
 * incorporating basic hysteresis metrics to prevent replica oscillation (flapping).
 *
 * @param dep - Target workload deployment node
 * @param cpuPercent - Computed virtual CPU usage percentage
 * @param ctx - The active simulation tick context
 * @returns True if scaling or state update changes were executed
 */
export const handleHpaScaling = (dep: Node, cpuPercent: number, ctx: SimulationContext): boolean => {
  // Use targetEdgeMap for faster HPA lookup
  let connectedHPA: Node | undefined;
  const incoming = ctx.targetEdgeMap?.get(dep.id);
  if (incoming) {
    for (const edge of incoming) {
      const sourceNode = ctx.nodeMap?.get(String(edge.source));
      if (sourceNode?.type === 'HPA') {
        connectedHPA = sourceNode;
        break;
      }
    }
  }

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
    const nodeIndex = ctx.nodeIndexMap?.get(dep.id) ?? ctx.updatedNodes.findIndex(n => n.id === dep.id);
    if (nodeIndex !== -1) {
      const { updatedDeployment, laidOut } = syncDeployment(ctx.updatedNodes[nodeIndex], ctx.updatedNodes, desiredReplicas - replicas, ctx.get);

      // Rebuild the updatedNodes array to include new pods and remove old ones
      const filteredNodes = ctx.updatedNodes.filter(n => n.id !== dep.id && n.parentId !== dep.id);
      ctx.updatedNodes.length = 0;
      ctx.updatedNodes.push(...filteredNodes, updatedDeployment, ...laidOut);

      // Invalidate index map as the array was rebuilt
      ctx.nodeIndexMap?.clear();
      hasChanges = true;
    }
  }

  if (updateNodeData(ctx, connectedHPA.id, { currentCPU: Math.round(cpuPercent) })) {
    hasChanges = true;
  }

  return hasChanges;
};

/**
 * Standard processing loop for a single workload node (Deployment, ReplicaSet, or Standalone Pod)
 * during a simulation tick. Executes PVC validation, traffic calculations, resource metrics,
 * crash modeling, and HPA auto-scaling logic.
 *
 * @param dep - The workload or Pod node being processed
 * @param ctx - The active simulation tick context
 * @returns Object indicating whether any store updating actions occurred
 */
export const processWorkloadSimulation = (dep: Node, ctx: SimulationContext): { hasChanges: boolean } => {
  const pvcResult = checkPvcReadiness(dep, ctx);
  if (pvcResult.isBlocked) return { hasChanges: pvcResult.hasChanges };

  const trafficResult = calculateIncomingTraffic(dep, ctx);
  const metricsResult = calculateResourceMetrics(dep, trafficResult.traffic, ctx);

  const oomChanged = handleOomCrashes(dep, metricsResult.isOOM, ctx);
  const hpaChanged = handleHpaScaling(dep, metricsResult.cpuPercent, ctx);

  return { hasChanges: pvcResult.hasChanges || oomChanged || hpaChanged };
};
