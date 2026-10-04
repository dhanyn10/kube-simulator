import { Node } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { parseCPU, parseMemory, safeRandom } from './utils';
import { syncDeployment } from '@/store/nodeHelpers';
import { SimulationContext, updateNodeData } from './simulationTypes';
import { isInternetConnectionRed } from './simulationReachability';

const canReachWorkload = (reachableNodes: Set<string>, depId: string, childPods?: Node[]): boolean => {
  if (reachableNodes.has(depId)) return true;
  const children = childPods || [];
  return children.some(child => reachableNodes.has(child.id));
};

const getInternetNodeTraffic = (
  node: Node,
  depId: string,
  children: Node[] | undefined,
  internetReachableMap: Map<string, Set<string>>
): number => {
  const reachableNodes = internetReachableMap.get(node.id);
  if (!reachableNodes) return 0;

  if (!canReachWorkload(reachableNodes, depId, children)) return 0;

  const nData = node.data as K8sNodeData;
  return nData.currentTraffic || 0;
};

/**
 * Calculates total incoming web traffic reaching a workload from connected Internet nodes.
 */
export const calculateIncomingTraffic = (dep: Node, ctx: SimulationContext): { traffic: number; hasChanges: boolean } => {
  if (!ctx.internetNodes || !ctx.internetReachableMap) return { traffic: 0, hasChanges: false };

  const children = ctx.childPodMap?.get(dep.id);
  let totalTraffic = 0;

  for (const node of ctx.internetNodes) {
    totalTraffic += getInternetNodeTraffic(node, dep.id, children, ctx.internetReachableMap);
  }

  return { traffic: totalTraffic, hasChanges: false };
};

interface ProfileMinutePoint {
  minute: number;
  val: number;
}

const parseProfileMinutePoints = (hourly: Record<string, number>): ProfileMinutePoint[] => {
  const points = Object.keys(hourly)
    .map((k) => {
      const [h, m] = k.split(':').map(Number);
      return { minute: (h || 0) * 60 + (m || 0), val: Number(hourly[k]) };
    })
    .sort((a, b) => a.minute - b.minute);

  if (points.length > 0 && !points.some((k) => k.minute === 1440)) {
    const min0 = points.find((k) => k.minute === 0) || points[0];
    points.push({ minute: 1440, val: min0.val });
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
  const hh = String(Math.floor(safeMinute / 60)).padStart(2, '0');
  const mm = String(safeMinute % 60).padStart(2, '0');
  const exactKey = `${hh}:${mm}`;

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
  const iData = internet.data as K8sNodeData;
  let targetTraffic = iData.traffic ?? 1000;

  const state = ctx.get?.();
  const speed = state?.simulationSpeed || 1;

  // Track profileTicks to advance traffic cycle index only when connection is healthy
  const isRed = isInternetConnectionRed(internet, ctx);
  const prevProfileTicks = iData.profileTicks ?? 0;
  const currentProfileTicks = isRed ? prevProfileTicks : (prevProfileTicks + 1);

  // Minute-level resolution across 1440 minutes in a 24-hour cycle
  const prevMinuteIndex = iData.currentMinuteIndex ?? ((iData.currentHourIndex ?? 0) * 60);
  const currentMinuteIndex = isRed ? prevMinuteIndex : ((prevMinuteIndex + 1) % 1440);
  const currentHourIndex = Math.floor(currentMinuteIndex / 60);

  if (iData.connectionProfile) {
    targetTraffic = getInterpolatedProfileTraffic(iData.connectionProfile, currentMinuteIndex);
  }

  const currentTraffic = iData.currentTraffic ?? 0;
  let nextTraffic = currentTraffic;

  // Hold traffic at 0 during container initialization startup delay (ticks 1..3) or when connection is red
  if (ctx.ticks <= 3 || isRed) {
    nextTraffic = 0;
  } else if (iData.connectionProfile) {
    nextTraffic = targetTraffic;
  } else {
    const step = 1000 * speed;
    if (currentTraffic < targetTraffic) {
      nextTraffic = Math.min(targetTraffic, currentTraffic + step);
    } else if (currentTraffic > targetTraffic) {
      nextTraffic = Math.max(targetTraffic, currentTraffic - step * 2);
    }
  }

  let hasChanges = false;
  if (
    nextTraffic !== currentTraffic ||
    iData.currentHourIndex !== currentHourIndex ||
    iData.currentMinuteIndex !== currentMinuteIndex ||
    iData.profileTicks !== currentProfileTicks
  ) {
    hasChanges = updateNodeData(ctx, internet.id, {
      currentTraffic: nextTraffic,
      currentHourIndex,
      currentMinuteIndex,
      profileTicks: currentProfileTicks
    });
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

const resolveDirectHpaConfig = (depData: K8sNodeData) => {
  if (Array.isArray(depData.hpas) && depData.hpas.length > 0) {
    const first = depData.hpas[0];
    return {
      minReplicas: first.minReplicas || 1,
      maxReplicas: first.maxReplicas || 10,
      targetCPU: first.targetCPU || 50,
    };
  }
  return null;
};

const resolveConnectedHpaConfig = (depId: string, ctx: SimulationContext) => {
  const connectedHPA = findConnectedHPA(depId, ctx);
  if (connectedHPA) {
    const hData = connectedHPA.data as K8sNodeData;
    return {
      config: {
        minReplicas: hData.minReplicas || 1,
        maxReplicas: hData.maxReplicas || 10,
        targetCPU: hData.targetCPU || 50,
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
    };
  }
  return null;
};

const resolveHpaConfig = (dep: Node, ctx: SimulationContext): { config: { minReplicas: number; maxReplicas: number; targetCPU: number } | null; connectedHPA: Node | undefined } => {
  const depData = dep.data as K8sNodeData;
  const directConfig = resolveDirectHpaConfig(depData);
  if (directConfig) return { config: directConfig, connectedHPA: undefined };

  const connectedResult = resolveConnectedHpaConfig(dep.id, ctx);
  if (connectedResult) return connectedResult;

  const nodeBoundConfig = resolveNodeBoundHpaConfig(depData);
  if (nodeBoundConfig) return { config: nodeBoundConfig, connectedHPA: undefined };

  return { config: null, connectedHPA: undefined };
};

const scaleDeploymentReplicas = (dep: Node, diff: number, ctx: SimulationContext): boolean => {
  const nodeIndex = ctx.nodeIndexMap?.get(dep.id) ?? ctx.updatedNodes.findIndex(n => n.id === dep.id);
  if (nodeIndex === -1) return false;

  const { updatedDeployment, laidOut } = syncDeployment(ctx.updatedNodes[nodeIndex], ctx.updatedNodes, diff, ctx.get);
  const filteredNodes = ctx.updatedNodes.filter(n => n.id !== dep.id && n.parentId !== dep.id);
  ctx.updatedNodes.length = 0;
  ctx.updatedNodes.push(...filteredNodes, updatedDeployment, ...laidOut);
  ctx.nodeIndexMap?.clear();
  return true;
};

/**
 * Evaluates connected HPA parameters and automatically scales workload replicas based on CPU load.
 */
export const handleHpaScaling = (dep: Node, cpuPercent: number, ctx: SimulationContext): boolean => {
  const depData = dep.data as K8sNodeData;
  const { config: hpaConfig, connectedHPA } = resolveHpaConfig(dep, ctx);

  if (!hpaConfig) return false;

  let hasChanges = false;
  const replicas = depData.replicas || 1;
  const desiredReplicas = calculateDesiredReplicas(replicas, cpuPercent, hpaConfig as any);

  if (desiredReplicas !== replicas) {
    hasChanges = scaleDeploymentReplicas(dep, desiredReplicas - replicas, ctx);
  }

  if (connectedHPA && updateNodeData(ctx, connectedHPA.id, { currentCPU: Math.round(cpuPercent) })) {
    hasChanges = true;
  }

  return hasChanges;
};
