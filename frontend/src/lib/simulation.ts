import { Node, Edge } from '@xyflow/react';
import { K8sNodeData, K8sConfigMapItem } from '@/types';
import { safeRandom } from './utils';
import { logger } from './logger';
import { SimulationContext, updateNodeData } from './simulationTypes';
import { checkPvcReadiness } from './simulationPvc';
import { calculateIncomingTraffic, calculateResourceMetrics, handleHpaScaling } from './simulationTraffic';
import { handleOomCrashes } from './simulationRecovery';

export * from './simulationTypes';
export * from './simulationReachability';
export * from './simulationPvc';
export * from './simulationTraffic';
export * from './simulationRecovery';

const parseConfigKeyValuePair = (
  key: string | undefined,
  val: string | undefined,
  cmName: string,
  acc: { hasSimulatedFailure: boolean; failingCmName: string; cmPort: number | null; maxConnections: number | null; logLevel: string }
) => {
  const k = key?.trim().toUpperCase();
  const v = val?.trim();
  if (!k || !v) return;

  if ((k === 'CHAOS_MODE' && v.toLowerCase() === 'enabled') || (k === 'SIMULATE_FAILURE' && v.toLowerCase() === 'true')) {
    acc.hasSimulatedFailure = true;
    acc.failingCmName = cmName;
  }
  if (k === 'PORT' && !Number.isNaN(Number(v))) {
    acc.cmPort = Number(v);
  }
  if (k === 'MAX_CONNECTIONS' && !Number.isNaN(Number(v))) {
    acc.maxConnections = Number(v);
  }
  if (k === 'LOG_LEVEL') {
    acc.logLevel = v.toUpperCase();
  }
};

/**
 * Parses ConfigMap entries for simulation parameter overrides like CHAOS_MODE, PORT, MAX_CONNECTIONS, and LOG_LEVEL.
 */
export const parseConfigMapSettings = (configMaps: K8sConfigMapItem[]) => {
  const acc = { hasSimulatedFailure: false, failingCmName: '', cmPort: null as number | null, maxConnections: null as number | null, logLevel: 'INFO' };

  for (const cm of configMaps) {
    if (!cm.configData) continue;
    for (const kv of cm.configData) {
      parseConfigKeyValuePair(kv.key, kv.value, cm.name, acc);
    }
  }

  return acc;
};

const applyPodSimulatedFailure = (
  pod: Node,
  ctx: SimulationContext,
  failingCmName: string
): boolean => {
  if (pod.data.status === 'crashing') return false;
  if (!updateNodeData(ctx, pod.id, { status: 'crashing', simulatedFailureCM: failingCmName })) {
    return false;
  }
  try {
    ctx.get()?.addLog?.('warning', `[ConfigMap Chaos] CHAOS_MODE enabled in ConfigMap "${failingCmName}". Pod "${pod.data.label || pod.id}" set to CrashLoopBackOff!`, 'Simulation');
  } catch (e) {
    logger.error('[ConfigMap Simulation] Failed to add log', e);
  }
  return true;
};

const applySimulatedFailures = (
  childPods: Node[],
  ctx: SimulationContext,
  failingCmName: string
): boolean => {
  let hasChanges = false;
  for (const pod of childPods) {
    if (applyPodSimulatedFailure(pod, ctx, failingCmName)) {
      hasChanges = true;
    }
  }
  return hasChanges;
};

const isPodReadyConfigured = (pData: K8sNodeData): boolean => {
  return Boolean(pData.image);
};

const recoverSinglePod = (pod: Node, ctx: SimulationContext): boolean => {
  if (pod.data.status !== 'crashing' || !pod.data.simulatedFailureCM) {
    return false;
  }
  const pData = pod.data as K8sNodeData;
  const nextStatus = isPodReadyConfigured(pData) ? 'ready' : 'pending';
  if (!updateNodeData(ctx, pod.id, { status: nextStatus, simulatedFailureCM: undefined })) {
    return false;
  }
  try {
    ctx.get()?.addLog?.('info', `[ConfigMap Recovered] CHAOS_MODE disabled. Pod "${pod.data.label || pod.id}" restored to ${nextStatus}!`, 'Simulation');
  } catch (e) {
    logger.error('[ConfigMap Simulation] Failed to add log', e);
  }
  return true;
};

const recoverFromSimulatedFailures = (
  childPods: Node[],
  ctx: SimulationContext
): boolean => {
  let hasChanges = false;
  for (const pod of childPods) {
    if (recoverSinglePod(pod, ctx)) {
      hasChanges = true;
    }
  }
  return hasChanges;
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
  if (hasSimulatedFailure) {
    const hasChanges = applySimulatedFailures(childPods, ctx, failingCmName);
    return { hasChanges, isBlocked: true };
  }

  const hasChanges = recoverFromSimulatedFailures(childPods, ctx);
  return { hasChanges, isBlocked: false };
};

const logPortMismatchError = (
  ctx: SimulationContext,
  sData: K8sNodeData,
  sourceNodeId: string,
  srvTargetPort: number,
  podLabel: string | undefined,
  podId: string,
  cmPort: number
) => {
  try {
    ctx.get()?.addLog?.(
      'error',
      `[ConfigMap Port Mismatch] Connection Refused (HTTP 502): Service "${sData.label || sourceNodeId}" (port ${srvTargetPort}) -> Pod "${podLabel || podId}" (listening on PORT ${cmPort})`,
      'Simulation'
    );
  } catch (e) {
    logger.error('[ConfigMap Simulation] Failed to add log', e);
  }
};

const validateEdgePortMismatch = (
  edge: Edge,
  dep: Node,
  ctx: SimulationContext,
  cmPort: number
): { hasChanges: boolean; isBlocked: boolean } => {
  const sourceNode = ctx.nodeMap?.get(String(edge.source));
  if (sourceNode?.type !== 'Service') return { hasChanges: false, isBlocked: false };

  const sData = sourceNode.data as K8sNodeData;
  const srvTargetPort = Number(sData.targetPort || sData.port || 80);

  if (cmPort !== srvTargetPort) {
    const portErr = `Port Mismatch: Service "${sData.label || sourceNode.id}" targets port ${srvTargetPort}, but container PORT is ${cmPort}`;
    let hasChanges = false;
    if (edge.data?.validationError !== portErr) {
      edge.data = { ...edge.data, validationError: portErr };
      logPortMismatchError(ctx, sData, sourceNode.id, srvTargetPort, dep.data?.label, dep.id, cmPort);
    }
    return { hasChanges: true, isBlocked: true };
  }

  if (edge.data?.validationError?.includes('Port Mismatch')) {
    edge.data = { ...edge.data, validationError: undefined };
    return { hasChanges: true, isBlocked: false };
  }

  return { hasChanges: false, isBlocked: false };
};

/**
 * Detects target port mismatches between connecting Service and container PORT setting in ConfigMap.
 */
export const checkPortMismatch = (
  dep: Node,
  ctx: SimulationContext,
  cmPort: number | null
): { hasChanges: boolean; isBlocked: boolean } => {
  if (cmPort === null) return { hasChanges: false, isBlocked: false };

  let hasChanges = false;
  const incomingEdges = ctx.targetEdgeMap?.get(dep.id) || [];

  for (const edge of incomingEdges) {
    const result = validateEdgePortMismatch(edge, dep, ctx, cmPort);
    if (result.hasChanges) hasChanges = true;
    if (result.isBlocked) return { hasChanges: true, isBlocked: true };
  }

  return { hasChanges, isBlocked: false };
};

/**
 * Logs request stream messages to terminal console matching configured ConfigMap LOG_LEVEL.
 */
const getLogMessageForLevel = (logLevel: string, podLabel: string): { type: 'info' | 'warning' | 'error'; message: string } => {
  if (logLevel === 'DEBUG') {
    return { type: 'info', message: `[ConfigMap Log DEBUG] [${podLabel}] Handling request stream - active threads: 8, memory heap: 42MB` };
  }
  if (logLevel === 'WARN') {
    return { type: 'warning', message: `[ConfigMap Log WARN] [${podLabel}] Connection pool threshold > 75%` };
  }
  if (logLevel === 'ERROR') {
    return { type: 'error', message: `[ConfigMap Log ERROR] [${podLabel}] Unhandled internal exception trace in worker process` };
  }
  return { type: 'info', message: `[ConfigMap Log INFO] [${podLabel}] HTTP 200 OK - Processing traffic stream` };
};

/**
 * Logs request stream messages to terminal console matching configured ConfigMap LOG_LEVEL.
 */
export const logLogLevelStream = (dep: Node, ctx: SimulationContext, logLevel: string) => {
  if (ctx.ticks % 3 !== 0 || safeRandom() <= 0.4) return;

  try {
    const podLabel = dep.data?.label || dep.id;
    const { type, message } = getLogMessageForLevel(logLevel, podLabel);
    ctx.get()?.addLog?.(type, message, 'App');
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

const handleTrafficThrottling = (
  dep: Node,
  traffic: number,
  limit: number | undefined,
  ctx: SimulationContext
): number => {
  if (!limit || traffic <= limit) return traffic;

  const droppedCount = traffic - limit;
  if (ctx.ticks % 2 === 0) {
    try {
      ctx.get()?.addLog?.('warning', `[ConfigMap Capacity Limit] HTTP 503 Service Unavailable: ${droppedCount} requests/sec dropped on "${dep.data?.label || dep.id}" (MAX_CONNECTIONS=${limit})`, 'Simulation');
    } catch (e) {
      logger.error('[ConfigMap Simulation] Failed to add log', e);
    }
  }
  return limit;
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
  const effectiveTraffic = handleTrafficThrottling(dep, trafficResult.traffic, cmResult.effectiveTrafficLimit, ctx);

  const metricsResult = calculateResourceMetrics(dep, effectiveTraffic, ctx);

  const oomChanged = handleOomCrashes(dep, metricsResult.isOOM, ctx);
  const hpaChanged = handleHpaScaling(dep, metricsResult.cpuPercent, ctx);

  return { hasChanges: cmResult.hasChanges || pvcResult.hasChanges || oomChanged || hpaChanged };
};
