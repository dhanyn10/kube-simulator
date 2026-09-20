import { Node, Edge } from '@xyflow/react';
import { K8sNodeData, K8sConfigMapItem } from '../types';
import { SimulationMetricPoint, FlowState } from '../store/types';
import { parseCPU, parseMemory, safeRandom } from './utils';
import { syncDeployment } from '../store/nodeHelpers';
import { logger } from './logger';

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

/**
 * Traverses active non-error edges starting from entry nodes to determine reachable target node IDs.
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
 * Checks PVC binding status for connected workload nodes, marking pods as pending if PVC is unbound.
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

/**
 * Updates data properties of a node in the active simulation context.
 */
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

/**
 * Handles unbound PVC state by attempting binding and updating dependent pod statuses to pending.
 */
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

/**
 * Handles bound PVC state by restoring pending pods to ready when container runtimes are configured.
 */
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

const getTrafficMultiplier = (unit?: string): number => {
  if (unit === 'millisecond') return 1000;
  if (unit === 'minute') return 1 / 60;
  return 1;
};

const canReachWorkload = (reachableNodes: Set<string>, depId: string, childPods?: Node[]): boolean => {
  if (reachableNodes.has(depId)) return true;
  const children = childPods || [];
  return children.some(child => reachableNodes.has(child.id));
};

/**
 * Calculates total incoming web traffic reaching a workload from connected Internet nodes.
 */
export const calculateIncomingTraffic = (dep: Node, ctx: SimulationContext): { traffic: number; hasChanges: boolean } => {
  if (!ctx.internetNodes || !ctx.internetReachableMap) return { traffic: 0, hasChanges: false };

  let totalTraffic = 0;
  const children = ctx.childPodMap?.get(dep.id);

  for (const node of ctx.internetNodes) {
    const reachableNodes = ctx.internetReachableMap.get(node.id);
    if (!reachableNodes) continue;

    const nData = node.data as K8sNodeData;
    const internetTraffic = nData.currentTraffic || 0;
    const multiplier = getTrafficMultiplier(nData.durationUnit);
    const effectiveTraffic = internetTraffic * multiplier;

    if (canReachWorkload(reachableNodes, dep.id, children)) {
      totalTraffic += effectiveTraffic;
    }
  }

  return { traffic: totalTraffic, hasChanges: false };
};

/**
 * Smoothly adjusts current internet traffic towards target traffic setting.
 */
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
 * Computes CPU and Memory usage metrics and throttle/OOM flags for a workload node based on traffic load.
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
 * Simulates random container crashes when memory usage exceeds memory limits (OOM state).
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

/**
 * Schedules automated recovery for crashing pods after a delay.
 */
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

/**
 * Evaluates connected HPA parameters and automatically scales workload replicas based on CPU load.
 */
export const handleHpaScaling = (dep: Node, cpuPercent: number, ctx: SimulationContext): boolean => {
  const depData = dep.data as K8sNodeData;
  let hpaConfig: { minReplicas: number; maxReplicas: number; targetCPU: number } | null = null;
  let connectedHPA: Node | undefined = undefined;

  if (Array.isArray(depData.hpas) && depData.hpas.length > 0) {
    const first = depData.hpas[0];
    hpaConfig = {
      minReplicas: first.minReplicas || 1,
      maxReplicas: first.maxReplicas || 10,
      targetCPU: first.targetCPU || 50,
    };
  } else {
    connectedHPA = findConnectedHPA(dep.id, ctx);
    if (connectedHPA) {
      const hData = connectedHPA.data as K8sNodeData;
      hpaConfig = {
        minReplicas: hData.minReplicas || 1,
        maxReplicas: hData.maxReplicas || 10,
        targetCPU: hData.targetCPU || 50,
      };
    } else if (depData.minReplicas && depData.maxReplicas) {
      hpaConfig = {
        minReplicas: depData.minReplicas,
        maxReplicas: depData.maxReplicas,
        targetCPU: depData.targetCPU || 50,
      };
    }
  }

  if (!hpaConfig) return false;

  let hasChanges = false;
  const replicas = depData.replicas || 1;
  const desiredReplicas = calculateDesiredReplicas(replicas, cpuPercent, hpaConfig as any);

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

  if (connectedHPA && updateNodeData(ctx, connectedHPA.id, { currentCPU: Math.round(cpuPercent) })) {
    hasChanges = true;
  }

  return hasChanges;
};

/**
 * Parses ConfigMap entries for simulation parameter overrides like CHAOS_MODE, PORT, MAX_CONNECTIONS, and LOG_LEVEL.
 */
export const parseConfigMapSettings = (configMaps: K8sConfigMapItem[]) => {
  let hasSimulatedFailure = false;
  let failingCmName = '';
  let cmPort: number | null = null;
  let maxConnections: number | null = null;
  let logLevel = 'INFO';

  for (const cm of configMaps) {
    if (!cm.configData) continue;
    for (const kv of cm.configData) {
      const k = kv.key?.trim().toUpperCase();
      const v = kv.value?.trim();
      if ((k === 'CHAOS_MODE' && v?.toLowerCase() === 'enabled') || (k === 'SIMULATE_FAILURE' && v?.toLowerCase() === 'true')) {
        hasSimulatedFailure = true;
        failingCmName = cm.name;
      }
      if (k === 'PORT' && v && !Number.isNaN(Number(v))) {
        cmPort = Number(v);
      }
      if (k === 'MAX_CONNECTIONS' && v && !Number.isNaN(Number(v))) {
        maxConnections = Number(v);
      }
      if (k === 'LOG_LEVEL' && v) {
        logLevel = v.toUpperCase();
      }
    }
  }

  return { hasSimulatedFailure, failingCmName, cmPort, maxConnections, logLevel };
};

/**
 * Simulates pod crashes or recoveries based on ConfigMap CHAOS_MODE setting.
 */
export const handleChaosModeSimulation = (
  childPods: Node[],
  ctx: SimulationContext,
  hasSimulatedFailure: boolean,
  failingCmName: string
): { hasChanges: boolean; isBlocked: boolean } => {
  let hasChanges = false;

  if (hasSimulatedFailure) {
    for (const pod of childPods) {
      if (pod.data.status !== 'crashing' && updateNodeData(ctx, pod.id, { status: 'crashing', simulatedFailureCM: failingCmName })) {
        hasChanges = true;
        try {
          ctx.get()?.addLog?.('warning', `[ConfigMap Chaos] CHAOS_MODE enabled in ConfigMap "${failingCmName}". Pod "${pod.data.label || pod.id}" set to CrashLoopBackOff!`, 'Simulation');
        } catch (e) {
          logger.error('[ConfigMap Simulation] Failed to add log', e);
        }
      }
    }
    return { hasChanges, isBlocked: true };
  }

  for (const pod of childPods) {
    if (pod.data.status === 'crashing' && pod.data.simulatedFailureCM) {
      const pData = pod.data as K8sNodeData;
      const isReadyStatus = !!(pData.webserver && pData.webserver !== 'none') || !!(pData.runtime && pData.runtime !== 'none');
      const nextStatus = isReadyStatus ? 'ready' : 'pending';
      if (updateNodeData(ctx, pod.id, { status: nextStatus, simulatedFailureCM: undefined })) {
        hasChanges = true;
        try {
          ctx.get()?.addLog?.('info', `[ConfigMap Recovered] CHAOS_MODE disabled. Pod "${pod.data.label || pod.id}" restored to ${nextStatus}!`, 'Simulation');
        } catch (e) {
          logger.error('[ConfigMap Simulation] Failed to add log', e);
        }
      }
    }
  }

  return { hasChanges, isBlocked: false };
};

/**
 * Detects target port mismatches between connecting Service and container PORT setting in ConfigMap.
 */
export const checkPortMismatch = (
  dep: Node,
  ctx: SimulationContext,
  cmPort: number | null
): { hasChanges: boolean; isBlocked: boolean } => {
  let hasChanges = false;
  const incomingEdges = ctx.targetEdgeMap?.get(dep.id) || [];

  for (const edge of incomingEdges) {
    const sourceNode = ctx.nodeMap?.get(String(edge.source));
    if (sourceNode?.type !== 'Service') continue;

    const sData = sourceNode.data as K8sNodeData;
    const srvTargetPort = Number(sData.targetPort || sData.port || 80);

    if (cmPort !== null && cmPort !== srvTargetPort) {
      const portErr = `Port Mismatch: Service "${sData.label || sourceNode.id}" targets port ${srvTargetPort}, but container PORT is ${cmPort}`;
      if (edge.data?.validationError !== portErr) {
        edge.data = { ...edge.data, validationError: portErr };
        hasChanges = true;
        try {
          ctx.get()?.addLog?.('error', `[ConfigMap Port Mismatch] Connection Refused (HTTP 502): Service "${sData.label || sourceNode.id}" (port ${srvTargetPort}) -> Pod "${dep.data?.label || dep.id}" (listening on PORT ${cmPort})`, 'Simulation');
        } catch (e) {
          logger.error('[ConfigMap Simulation] Failed to add log', e);
        }
      }
      return { hasChanges: true, isBlocked: true };
    }

    if (edge.data?.validationError?.includes('Port Mismatch')) {
      edge.data = { ...edge.data, validationError: undefined };
      hasChanges = true;
    }
  }

  return { hasChanges, isBlocked: false };
};

/**
 * Logs request stream messages to terminal console matching configured ConfigMap LOG_LEVEL.
 */
export const logLogLevelStream = (dep: Node, ctx: SimulationContext, logLevel: string) => {
  if (ctx.ticks % 3 !== 0 || safeRandom() <= 0.4) return;

  try {
    const podLabel = dep.data?.label || dep.id;
    if (logLevel === 'DEBUG') {
      ctx.get()?.addLog?.('info', `[ConfigMap Log DEBUG] [${podLabel}] Handling request stream - active threads: 8, memory heap: 42MB`, 'App');
    } else if (logLevel === 'WARN') {
      ctx.get()?.addLog?.('warning', `[ConfigMap Log WARN] [${podLabel}] Connection pool threshold > 75%`, 'App');
    } else if (logLevel === 'ERROR') {
      ctx.get()?.addLog?.('error', `[ConfigMap Log ERROR] [${podLabel}] Unhandled internal exception trace in worker process`, 'App');
    } else {
      ctx.get()?.addLog?.('info', `[ConfigMap Log INFO] [${podLabel}] HTTP 200 OK - Processing traffic stream`, 'App');
    }
  } catch (e) {
    logger.error('[ConfigMap Simulation] Failed to add log', e);
  }
};

/**
 * Evaluates attached ConfigMap settings during runtime simulation.
 */
export const checkConfigMapSimulationStatus = (dep: Node, ctx: SimulationContext): { hasChanges: boolean; isBlocked: boolean; effectiveTrafficLimit?: number } => {
  const dData = dep.data as K8sNodeData;
  const configMaps = dData.configMaps || [];
  const childPods = dep.type === 'Pod' ? [dep] : (ctx.childPodMap?.get(dep.id) || []);

  const { hasSimulatedFailure, failingCmName, cmPort, maxConnections, logLevel } = parseConfigMapSettings(configMaps);

  const chaosResult = handleChaosModeSimulation(childPods, ctx, hasSimulatedFailure, failingCmName);
  if (chaosResult.isBlocked) {
    return { hasChanges: chaosResult.hasChanges, isBlocked: true };
  }

  const portResult = checkPortMismatch(dep, ctx, cmPort);
  if (portResult.isBlocked) {
    return { hasChanges: chaosResult.hasChanges || portResult.hasChanges, isBlocked: true };
  }

  logLogLevelStream(dep, ctx, logLevel);

  return {
    hasChanges: chaosResult.hasChanges || portResult.hasChanges,
    isBlocked: false,
    effectiveTrafficLimit: maxConnections ?? undefined,
  };
};

/**
 * Orchestrates complete simulation cycle for workload nodes (ConfigMaps, PVCs, traffic, OOM, and HPAs).
 */
export const processWorkloadSimulation = (dep: Node, ctx: SimulationContext): { hasChanges: boolean } => {
  const cmResult = checkConfigMapSimulationStatus(dep, ctx);
  if (cmResult.isBlocked) return { hasChanges: cmResult.hasChanges };

  const pvcResult = checkPvcReadiness(dep, ctx);
  if (pvcResult.isBlocked) return { hasChanges: pvcResult.hasChanges || cmResult.hasChanges };

  const trafficResult = calculateIncomingTraffic(dep, ctx);

  // Apply ConfigMap MAX_CONNECTIONS throttling if traffic exceeds capacity limit
  let effectiveTraffic = trafficResult.traffic;
  if (cmResult.effectiveTrafficLimit && effectiveTraffic > cmResult.effectiveTrafficLimit) {
    const droppedCount = effectiveTraffic - cmResult.effectiveTrafficLimit;
    effectiveTraffic = cmResult.effectiveTrafficLimit;
    if (ctx.ticks % 2 === 0) {
      try {
        ctx.get()?.addLog?.('warning', `[ConfigMap Capacity Limit] HTTP 503 Service Unavailable: ${droppedCount} requests/sec dropped on "${dep.data?.label || dep.id}" (MAX_CONNECTIONS=${cmResult.effectiveTrafficLimit})`, 'Simulation');
      } catch (e) {
        logger.error('[ConfigMap Simulation] Failed to add log', e);
      }
    }
  }

  const metricsResult = calculateResourceMetrics(dep, effectiveTraffic, ctx);

  const oomChanged = handleOomCrashes(dep, metricsResult.isOOM, ctx);
  const hpaChanged = handleHpaScaling(dep, metricsResult.cpuPercent, ctx);

  return { hasChanges: cmResult.hasChanges || pvcResult.hasChanges || oomChanged || hpaChanged };
};
