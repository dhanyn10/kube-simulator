import { Node } from '@xyflow/react';
import { K8sNodeData } from '@/types';
import { parseCPU, parseMemory, safeRandom } from './utils';
import { syncDeployment } from '@/store/nodeHelpers';
import { evaluateImageResourceConsumption } from '@/activities/ui/imageCharacteristicsHelpers';
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

  const nodeData = node.data as K8sNodeData;
  return nodeData.currentTraffic || 0;
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
  let targetTraffic = internetData.traffic ?? 1000;

  const state = ctx.get?.();
  const speed = state?.simulationSpeed || 1;

  // Track profileTicks to advance traffic cycle index only when connection is healthy
  const isRed = isInternetConnectionRed(internet, ctx);
  const prevProfileTicks = internetData.profileTicks ?? 0;
  const currentProfileTicks = isRed ? prevProfileTicks : (prevProfileTicks + 1);

  // Minute-level resolution across 1440 minutes in a 24-hour cycle
  const prevMinuteIndex = internetData.currentMinuteIndex ?? ((internetData.currentHourIndex ?? 0) * 60);
  const currentMinuteIndex = isRed ? prevMinuteIndex : ((prevMinuteIndex + 1) % 1440);
  const currentHourIndex = Math.floor(currentMinuteIndex / 60);

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

  let hasChanges = false;
  if (
    nextTraffic !== currentTraffic ||
    internetData.currentHourIndex !== currentHourIndex ||
    internetData.currentMinuteIndex !== currentMinuteIndex ||
    internetData.profileTicks !== currentProfileTicks
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
    const hpaData = connectedHPA.data as K8sNodeData;
    return {
      config: {
        minReplicas: hpaData.minReplicas || 1,
        maxReplicas: hpaData.maxReplicas || 10,
        targetCPU: hpaData.targetCPU || 50,
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
  const nodeIndex = ctx.nodeIndexMap?.get(dep.id) ?? ctx.updatedNodes.findIndex(node => node.id === dep.id);
  if (nodeIndex === -1) return false;

  const { updatedDeployment, laidOut } = syncDeployment(ctx.updatedNodes[nodeIndex], ctx.updatedNodes, diff, ctx.get);
  const filteredNodes = ctx.updatedNodes.filter(node => node.id !== dep.id && node.parentId !== dep.id);
  ctx.updatedNodes.length = 0;
  ctx.updatedNodes.push(...filteredNodes, updatedDeployment, ...laidOut);
  ctx.nodeIndexMap?.clear();
  return true;
};

/**
 * Evaluates connected HPA parameters and automatically scales workload replicas based on CPU load.
 */
export const handleHpaScaling = (dep: Node, cpuPercent: number, ctx: SimulationContext): boolean => {
  const deploymentData = dep.data as K8sNodeData;
  const { config: hpaConfig, connectedHPA } = resolveHpaConfig(dep, ctx);

  if (!hpaConfig) return false;

  let hasChanges = false;
  const replicas = deploymentData.replicas || 1;
  const desiredReplicas = calculateDesiredReplicas(replicas, cpuPercent, hpaConfig as any);

  if (desiredReplicas !== replicas) {
    hasChanges = scaleDeploymentReplicas(dep, desiredReplicas - replicas, ctx);
  }

  if (connectedHPA && updateNodeData(ctx, connectedHPA.id, { currentCPU: Math.round(cpuPercent) })) {
    hasChanges = true;
  }

  return hasChanges;
};
