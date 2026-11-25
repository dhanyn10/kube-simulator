import { Node } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { parseCPU, parseMemory, safeRandom } from './utils';
import { evaluateImageResourceConsumption } from './imageCharacteristics';
import { SimulationContext, updateNodeData } from './simulationTypes';
import { isInternetConnectionRed } from './simulationReachability';

const canReachWorkload = (reachableNodes: Set<string>, depId: string, childPods?: Node[]): boolean => {
  if (reachableNodes.has(depId)) return true;
  const children = childPods || [];
  return children.some(child => reachableNodes.has(child.id));
};

/**
 * Returns `true` if the given node is a simulatable workload (`Pod`, `Deployment`, or `StatefulSet`).
 *
 * @param node - The React Flow node to check.
 * @returns `true` if the node is a workload.
 */
export const isSimulationWorkload = (node: Node): boolean =>
  node.type === 'Deployment' ||
  node.type === 'StatefulSet' ||
  node.type === 'ReplicaSet' ||
  (node.type === 'Pod' && !node.parentId && !node.data?.parentId);

/**
 * Counts the number of reachable workload nodes from traffic entrypoints in the simulation graph.
 *
 * @param nodes - All nodes in the cluster canvas.
 * @param edges - All edges in the cluster canvas.
 * @returns The count of reachable workload nodes.
 */
export const getReachableWorkloadCount = (
  internetNodeId: string,
  ctx: SimulationContext
): number => {
  const reachableNodes = ctx.internetReachableMap?.get(internetNodeId);
  if (!reachableNodes || reachableNodes.size === 0) return 1;

  let candidateNodes = ctx.nodes;
  if (!candidateNodes || candidateNodes.length === 0) {
    candidateNodes = ctx.updatedNodes || [];
  }

  let count = 0;
  for (const n of candidateNodes) {
    if (isSimulationWorkload(n)) {
      const children = ctx.childPodMap?.get(n.id);
      if (canReachWorkload(reachableNodes, n.id, children)) {
        count++;
      }
    }
  }

  return Math.max(1, count);
};

const getInternetNodeTraffic = (
  node: Node,
  depId: string,
  children: Node[] | undefined,
  ctx: SimulationContext
): number => {
  const reachableNodes = ctx.internetReachableMap?.get(node.id);
  if (!reachableNodes) return 0;

  if (!canReachWorkload(reachableNodes, depId, children)) return 0;

  const nodeData = node.data as K8sNodeData;
  const currentTraffic = nodeData.currentTraffic || 0;
  if (currentTraffic <= 0) return 0;

  const reachableCount = getReachableWorkloadCount(node.id, ctx);
  return Math.round(currentTraffic / reachableCount);
};

/**
 * Calculates total incoming web traffic reaching a workload from connected Internet nodes.
 * Distributes incoming traffic across reachable workloads (Kubernetes Ingress & Service load balancing).
 */
export const calculateIncomingTraffic = (dep: Node, ctx: SimulationContext): { traffic: number; hasChanges: boolean } => {
  if (!ctx.internetNodes || !ctx.internetReachableMap) return { traffic: 0, hasChanges: false };

  const children = ctx.childPodMap?.get(dep.id);
  let totalTraffic = 0;

  for (const node of ctx.internetNodes) {
    totalTraffic += getInternetNodeTraffic(node, dep.id, children, ctx);
  }

  return { traffic: totalTraffic, hasChanges: false };
};

interface ProfileMinutePoint {
  minute: number;
  val: number;
}

const parseProfileMinutePoints = (hourly: Record<string, number>): ProfileMinutePoint[] => {
  const points = Object.keys(hourly)
    .map((key) => {
      const [hour, minute] = key.split(':').map(Number);
      return { minute: (hour || 0) * 60 + (minute || 0), val: Number(hourly[key]) };
    })
    .sort((pointA, pointB) => pointA.minute - pointB.minute);

  if (points.length > 0 && !points.some((point) => point.minute === 1440)) {
    const firstPoint = points.find((point) => point.minute === 0) || points[0];
    points.push({ minute: 1440, val: firstPoint.val });
  }
  return points;
};

const findBoundingMinutePoints = (
  points: ProfileMinutePoint[],
  safeMinute: number
): { prev: ProfileMinutePoint; next: ProfileMinutePoint } => {
  let prev = points[0];
  let next = points.at(-1)!;

  for (const item of points) {
    if (item.minute <= safeMinute && item.minute >= prev.minute) {
      prev = item;
    }
    if (item.minute >= safeMinute && item.minute <= next.minute) {
      next = item;
    }
  }
  return { prev, next };
};

/**
 * Calculates linear interpolated traffic for a given minute index (0..1439).
 */
export const getInterpolatedProfileTraffic = (profile: any, minuteIndex: number): number => {
  if (!profile) return 1000;
  const safeMinute = ((Math.floor(minuteIndex) % 1440) + 1440) % 1440;

  const hourly = profile.hourly || profile.daily || {};
  const hourString = String(Math.floor(safeMinute / 60)).padStart(2, '0');
  const minuteString = String(safeMinute % 60).padStart(2, '0');
  const exactKey = `${hourString}:${minuteString}`;

  if (hourly[exactKey] !== undefined) {
    return hourly[exactKey];
  }

  const existingMinuteKeys = parseProfileMinutePoints(hourly);
  if (existingMinuteKeys.length === 0) return 1000;

  const { prev, next } = findBoundingMinutePoints(existingMinuteKeys, safeMinute);
  if (prev.minute === next.minute) {
    return prev.val;
  }

  const fraction = (safeMinute - prev.minute) / (next.minute - prev.minute);
  return Math.round(prev.val + fraction * (next.val - prev.val));
};

/**
 * Smoothly adjusts current internet traffic towards target traffic setting.
 */
export const updateInternetTraffic = (internet: Node, ctx: SimulationContext) => {
  const internetData = internet.data as K8sNodeData;

  const state = ctx.get?.();
  const speed = state?.simulationSpeed || 1;

  // The profile models external demand, so its clock keeps advancing even while the
  // cluster has no ready endpoints. Only the delivered traffic is gated by isRed.
  const isRed = isInternetConnectionRed(internet, ctx);
  const prevProfileTicks = internetData.profileTicks ?? 0;
  const currentProfileTicks = prevProfileTicks + 1;

  // Minute-level resolution across 1440 minutes in a 24-hour cycle
  const prevMinuteIndex = internetData.currentMinuteIndex ?? ((internetData.currentHourIndex ?? 0) * 60);
  const currentMinuteIndex = (prevMinuteIndex + 1) % 1440;
  const currentHourIndex = Math.floor(currentMinuteIndex / 60);

  let targetTraffic = internetData.traffic ?? 1000;
  if (internetData.connectionProfile) {
    targetTraffic = getInterpolatedProfileTraffic(internetData.connectionProfile, currentMinuteIndex);
  }

  const currentTraffic = internetData.currentTraffic ?? 0;
  let nextTraffic = currentTraffic;

  // Hold traffic at 0 during container initialization startup delay (ticks 1..3) or when connection is red
  if (ctx.ticks <= 3 || isRed) {
    nextTraffic = 0;
  } else if (internetData.connectionProfile) {
    nextTraffic = targetTraffic;
  } else {
    const step = 1000 * speed;
    if (currentTraffic < targetTraffic) {
      nextTraffic = Math.min(targetTraffic, currentTraffic + step);
    } else if (currentTraffic > targetTraffic) {
      nextTraffic = Math.max(targetTraffic, currentTraffic - step * 2);
    }
  }

  const hasChanges = updateNodeData(ctx, internet.id, {
    currentTraffic: nextTraffic,
    currentHourIndex,
    currentMinuteIndex,
    profileTicks: currentProfileTicks
  });
  return { traffic: nextTraffic, hasChanges };
};

const LATENCY_BASE_MS = 5;
const LATENCY_QUEUE_MS = 20;
const LATENCY_OVERLOAD_MS_PER_RATIO = 120;
const LATENCY_THROTTLED_MS = 80;
const LATENCY_OOM_MS = 150;
const LATENCY_MAX_MS = 1000;

/**
 * Models response latency as queueing delay relative to the image's safe traffic
 * capacity, plus throttling/OOM penalties. Zero traffic means no requests to measure.
 */
export const calculateResponseLatencyMs = (
  incomingTraffic: number,
  trafficPerReplica: number,
  safeCapacityRpm: number,
  isThrottled: boolean,
  isOOM: boolean
): number => {
  if (incomingTraffic <= 0) return 0;

  const utilization = safeCapacityRpm > 0 ? trafficPerReplica / safeCapacityRpm : 1;
  const queueingMs = utilization <= 1
    ? LATENCY_QUEUE_MS * utilization * utilization
    : LATENCY_QUEUE_MS + (utilization - 1) * LATENCY_OVERLOAD_MS_PER_RATIO;
  const penaltyMs = (isThrottled ? LATENCY_THROTTLED_MS : 0) + (isOOM ? LATENCY_OOM_MS : 0);

  return Math.round(Math.min(LATENCY_MAX_MS, LATENCY_BASE_MS + queueingMs + penaltyMs));
};

/**
 * Computes CPU, Memory, and response latency metrics for a workload node based on traffic load.
 */
export const calculateResourceMetrics = (dep: Node, incomingTraffic: number, ctx: SimulationContext) => {
  const deploymentData = dep.data as K8sNodeData;
  const replicas = (deploymentData.replicas as number) || 1;
  const cpuLimitMilli = parseCPU(deploymentData.cpuLimit);
  const memLimitMiB = parseMemory(deploymentData.memoryLimit);

  const imageName = (deploymentData.image as string) || 'nginx:latest';
  const noiseVal = safeRandom() * 20 - 10;
  const computed = evaluateImageResourceConsumption(imageName, incomingTraffic, replicas, noiseVal);

  const cpuValue = Math.max(10, Math.min(computed.cpuValue, cpuLimitMilli));
  const memValue = Math.max(10, Math.min(computed.memValue, memLimitMiB));

  const isThrottled = cpuValue >= cpuLimitMilli;
  const isOOM = memValue >= memLimitMiB;

  const cpuPercent = (cpuValue / cpuLimitMilli) * 100;
  const memoryPercent = (memValue / memLimitMiB) * 100;

  const characteristics = computed.characteristics;
  const safeCapacityRpm = characteristics.maxTrafficRpm * characteristics.spikeToleranceRatio;
  const trafficPerReplica = incomingTraffic / Math.max(1, replicas);
  const latencyMs = calculateResponseLatencyMs(
    incomingTraffic,
    trafficPerReplica,
    safeCapacityRpm,
    isThrottled,
    isOOM
  );

  // Metric charts share one global 24h clock. Using the first Internet node's
  // profile minute would mislabel every workload when multiple Internet nodes
  // run different profiles at different times.
  const minuteIndex = (ctx.ticks || 0) % 1440;

  const existing = ctx.newMetrics[dep.id] || [];
  const nextPoint = {
    cpuPercent,
    memoryPercent,
    cpuValue,
    memoryValue: memValue,
    cpuLimit: cpuLimitMilli,
    memoryLimit: memLimitMiB,
    isThrottled,
    isOOM,
    trafficRpm: incomingTraffic,
    latencyMs,
    replicas,
    minuteIndex,
    tickIndex: ctx.ticks,
    timestamp: Date.now(),
  };

  const lastExisting = existing.at(-1);
  if (
    lastExisting &&
    typeof lastExisting.minuteIndex === 'number' &&
    lastExisting.minuteIndex === minuteIndex
  ) {
    ctx.newMetrics[dep.id] = [...existing.slice(0, -1), nextPoint];
  } else {
    ctx.newMetrics[dep.id] = [...existing, nextPoint].slice(-2880);
  }

  return { cpuPercent, memoryPercent, isOOM };
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

/** Consecutive low-CPU ticks required before HPA removes a replica (~5 simulated minutes). */
export const HPA_SCALE_DOWN_STABILIZATION_TICKS = 5;

const HPA_DEADBAND_RATIO = 0.1;

const desiredForMetric = (
  replicas: number,
  usagePercent: number,
  targetPercent: number,
  minReplicas: number,
  maxReplicas: number
): number => {
  if (targetPercent <= 0) return replicas;

  const ratio = usagePercent / targetPercent;
  if (Math.abs(1 - ratio) <= HPA_DEADBAND_RATIO) return replicas;

  return Math.max(minReplicas, Math.min(maxReplicas, Math.ceil(replicas * ratio)));
};

/**
 * Pure replica formula, matching HPA semantics: compute the desired replicas
 * per configured metric and use the largest one. A missing metric/target is
 * ignored, so existing CPU-only HPAs behave exactly as before.
 * Timing policy (stabilization) is applied by handleHpaScaling, not here.
 */
export const calculateDesiredReplicas = (
  replicas: number,
  cpuPercent: number,
  hpaData: K8sNodeData,
  memoryPercent?: number | null
): number => {
  const minReplicas = hpaData.minReplicas || 1;
  const maxReplicas = hpaData.maxReplicas || 10;

  const desiredCPU = desiredForMetric(replicas, cpuPercent, hpaData.targetCPU || 50, minReplicas, maxReplicas);
  // An unconfigured/absent metric contributes 0 so it does not block a scale-down
  // chosen by the other metric.
  const desiredMemory = memoryPercent == null || !hpaData.targetMemory
    ? 0
    : desiredForMetric(replicas, memoryPercent, hpaData.targetMemory, minReplicas, maxReplicas);

  return Math.max(desiredCPU, desiredMemory);
};

const resolveDirectHpaConfig = (depData: K8sNodeData) => {
  if (Array.isArray(depData.hpas) && depData.hpas.length > 0) {
    const first = depData.hpas[0];
    return {
      minReplicas: first.minReplicas || 1,
      maxReplicas: first.maxReplicas || 10,
      targetCPU: first.targetCPU || 50,
      targetMemory: first.targetMemory,
    };
  }
  return null;
};

const resolveConnectedHpaConfig = (depId: string, ctx: SimulationContext) => {
  const connectedHPA = findConnectedHPA(depId, ctx);
  if (connectedHPA) {
    const hpaData = connectedHPA.data as K8sNodeData;
    return {
      config: {
        minReplicas: hpaData.minReplicas || 1,
        maxReplicas: hpaData.maxReplicas || 10,
        targetCPU: hpaData.targetCPU || 50,
        targetMemory: hpaData.targetMemory,
      },
      connectedHPA,
    };
  }
  return null;
};

const resolveNodeBoundHpaConfig = (depData: K8sNodeData) => {
  if (depData.minReplicas && depData.maxReplicas) {
    return {
      minReplicas: depData.minReplicas,
      maxReplicas: depData.maxReplicas,
      targetCPU: depData.targetCPU || 50,
      targetMemory: depData.targetMemory,
    };
  }
  return null;
};

const resolveHpaConfig = (dep: Node, ctx: SimulationContext): {
  config: { minReplicas: number; maxReplicas: number; targetCPU: number; targetMemory?: number } | null;
  connectedHPA: Node | undefined;
} => {
  const depData = dep.data as K8sNodeData;
  const directConfig = resolveDirectHpaConfig(depData);
  if (directConfig) return { config: directConfig, connectedHPA: undefined };

  const connectedResult = resolveConnectedHpaConfig(dep.id, ctx);
  if (connectedResult) return connectedResult;

  const nodeBoundConfig = resolveNodeBoundHpaConfig(depData);
  if (nodeBoundConfig) return { config: nodeBoundConfig, connectedHPA: undefined };

  return { config: null, connectedHPA: undefined };
};

interface StabilizedReplicaDecision {
  desiredReplicas: number;
  lowCpuTicks: number;
  counterChanged: boolean;
}

/**
 * Applies the scale-down stabilization window as a pure decision.
 * lowCpuTicks is the persisted counter name; it now counts consecutive ticks
 * where all configured metrics agree that replicas can be reduced.
 */
const resolveStabilizedReplicas = (
  replicas: number,
  formulaReplicas: number,
  deploymentData: K8sNodeData
): StabilizedReplicaDecision => {
  const wantsScaleDown = formulaReplicas < replicas;
  const previousTicks = Number(deploymentData.lowCpuTicks) || 0;
  const lowCpuTicks = wantsScaleDown ? previousTicks + 1 : 0;
  const isStabilized = lowCpuTicks >= HPA_SCALE_DOWN_STABILIZATION_TICKS;

  return {
    desiredReplicas: wantsScaleDown && !isStabilized ? replicas : formulaReplicas,
    lowCpuTicks,
    counterChanged: lowCpuTicks !== previousTicks,
  };
};

const scaleDeploymentReplicas = (dep: Node, diff: number, ctx: SimulationContext): boolean => {
  const nodeIndex = ctx.nodeIndexMap?.get(dep.id) ?? ctx.updatedNodes.findIndex(node => node.id === dep.id);
  if (nodeIndex === -1) return false;

  const targetNode = ctx.updatedNodes[nodeIndex];
  if (ctx.syncDeployment) {
    const { updatedDeployment, laidOut } = ctx.syncDeployment(targetNode, ctx.updatedNodes, diff, ctx.get);
    const filteredNodes = ctx.updatedNodes.filter(node => node.id !== dep.id && node.parentId !== dep.id);
    ctx.updatedNodes.length = 0;
    ctx.updatedNodes.push(...filteredNodes, updatedDeployment, ...laidOut);
    ctx.nodeIndexMap?.clear();
    return true;
  }

  // Pure standalone replica and child pod scaling without store dependencies
  const currentReplicas = Number(targetNode.data?.replicas) || 1;
  const newReplicas = Math.max(1, currentReplicas + diff);
  const updatedDeployment = {
    ...targetNode,
    data: {
      ...targetNode.data,
      replicas: newReplicas,
    },
  };

  const childPods = ctx.updatedNodes.filter(n => (n.parentId === dep.id || n.data?.parentId === dep.id) && n.type === 'Pod');
  const templatePod = childPods[0];
  let updatedChildPods = [...childPods];

  if (diff > 0 && templatePod) {
    for (let i = 0; i < diff; i++) {
      const newIndex = childPods.length + i;
      const newPodId = `${dep.id}-pod-${newIndex}`;
      updatedChildPods.push({
        ...templatePod,
        id: newPodId,
        parentId: dep.id,
        data: {
          ...templatePod.data,
          parentId: dep.id,
          label: `${templatePod.data?.label || 'pod'}-${newIndex}`,
        },
      });
    }
  } else if (diff < 0) {
    updatedChildPods = updatedChildPods.slice(0, newReplicas);
  }

  const nonChildNodes = ctx.updatedNodes.filter(node => node.id !== dep.id && node.parentId !== dep.id && node.data?.parentId !== dep.id);
  ctx.updatedNodes.length = 0;
  ctx.updatedNodes.push(...nonChildNodes, updatedDeployment, ...updatedChildPods);
  ctx.nodeIndexMap?.clear();
  return true;
};

/**
 * Evaluates connected HPA parameters and automatically scales workload replicas based on CPU load.
 */
export const handleHpaScaling = (
  dep: Node,
  cpuPercent: number,
  ctx: SimulationContext,
  memoryPercent?: number | null
): boolean => {
  const deploymentData = dep.data as K8sNodeData;
  const { config: hpaConfig, connectedHPA } = resolveHpaConfig(dep, ctx);

  if (!hpaConfig) return false;

  let hasChanges = false;
  const replicas = deploymentData.replicas || 1;
  const formulaReplicas = calculateDesiredReplicas(replicas, cpuPercent, hpaConfig as any, memoryPercent);

  // Real HPA uses a stabilization window before scaling down so a short CPU dip
  // does not remove replicas. Counting consecutive low-CPU ticks is deterministic
  // and reproducible, unlike the previous random coin flip.
  const { desiredReplicas, lowCpuTicks, counterChanged } = resolveStabilizedReplicas(
    replicas,
    formulaReplicas,
    deploymentData
  );

  if (counterChanged && updateNodeData(ctx, dep.id, { lowCpuTicks })) {
    hasChanges = true;
  }

  if (desiredReplicas !== replicas) {
    hasChanges = scaleDeploymentReplicas(dep, desiredReplicas - replicas, ctx);
    if (hasChanges) {
      const depLabel = dep.data?.label || dep.id;
      const targetCpu = hpaConfig.targetCPU;
      const direction = desiredReplicas > replicas ? 'up' : 'down';
      const logMsg = `[HPA Autoscaler] Scaled ${direction} deployment/${depLabel} from ${replicas} to ${desiredReplicas} replicas (CPU: ${Math.round(cpuPercent)}%, Target: ${targetCpu}%)`;
      ctx.get?.()?.addActivityLog?.(logMsg);
    }
  }

  if (connectedHPA && updateNodeData(ctx, connectedHPA.id, { currentCPU: Math.round(cpuPercent) })) {
    hasChanges = true;
  }

  return hasChanges;
};
