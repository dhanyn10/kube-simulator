import { Node, Edge } from '@xyflow/react';
import { K8sNodeData, K8sConfigMapItem, K8sSecretItem } from '@/types';
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
  settings: { hasSimulatedFailure: boolean; failingCmName: string; cmPort: number | null; maxConnections: number | null; logLevel: string }
) => {
  const keyUpper = key?.trim().toUpperCase();
  const valueTrimmed = val?.trim();
  if (!keyUpper || !valueTrimmed) return;

  if ((keyUpper === 'CHAOS_MODE' && valueTrimmed.toLowerCase() === 'enabled') || (keyUpper === 'SIMULATE_FAILURE' && valueTrimmed.toLowerCase() === 'true')) {
    settings.hasSimulatedFailure = true;
    settings.failingCmName = cmName;
  }
  if (keyUpper === 'PORT' && !Number.isNaN(Number(valueTrimmed))) {
    settings.cmPort = Number(valueTrimmed);
  }
  if (keyUpper === 'MAX_CONNECTIONS' && !Number.isNaN(Number(valueTrimmed))) {
    settings.maxConnections = Number(valueTrimmed);
  }
  if (keyUpper === 'LOG_LEVEL') {
    settings.logLevel = valueTrimmed.toUpperCase();
  }
  if ((keyUpper === 'REQUIRE_SECRET' || keyUpper === 'AUTH_REQUIRED') && valueTrimmed.toLowerCase() === 'true') {
    settings.requireSecret = true;
  }
};

/**
 * Parses ConfigMap entries for simulation parameter overrides like CHAOS_MODE, PORT, MAX_CONNECTIONS, and LOG_LEVEL.
 */
export const parseConfigMapSettings = (configMaps: K8sConfigMapItem[]) => {
  const settings = { hasSimulatedFailure: false, failingCmName: '', cmPort: null as number | null, maxConnections: null as number | null, logLevel: 'INFO', requireSecret: false };

  for (const cm of configMaps) {
    if (!cm.configData) continue;
    for (const kv of cm.configData) {
      parseConfigKeyValuePair(kv.key, kv.value, cm.name, settings);
    }
  }

  return settings;
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
  } catch (error) {
    logger.error('[ConfigMap Simulation] Failed to add log', error);
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

const isPodReadyConfigured = (podData: K8sNodeData): boolean => {
  return Boolean(podData.image);
};

const recoverSinglePod = (pod: Node, ctx: SimulationContext): boolean => {
  if (pod.data.status !== 'crashing' || !pod.data.simulatedFailureCM) {
    return false;
  }
  const podData = pod.data as K8sNodeData;
  const nextStatus = isPodReadyConfigured(podData) ? 'ready' : 'pending';
  if (!updateNodeData(ctx, pod.id, { status: nextStatus, simulatedFailureCM: undefined })) {
    return false;
  }
  try {
    ctx.get()?.addLog?.('info', `[ConfigMap Recovered] CHAOS_MODE disabled. Pod "${pod.data.label || pod.id}" restored to ${nextStatus}!`, 'Simulation');
  } catch (error) {
    logger.error('[ConfigMap Simulation] Failed to add log', error);
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
  } catch (error) {
    logger.error('[ConfigMap Simulation] Failed to add log', error);
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
  } catch (error) {
    logger.error('[ConfigMap Simulation] Failed to add log', error);
  }
};

/**
 * Evaluates attached ConfigMap settings during runtime simulation.
 */

const isAuthFailureEntry = (key?: string, value?: string): boolean => {
  const k = key?.trim().toUpperCase();
  const v = value?.trim().toLowerCase();
  const isFailureKey = k === 'SIMULATE_FAILURE' || k === 'INVALID_CREDENTIALS' || k === 'FAIL_AUTH';
  const isEnabledVal = v === 'true' || v === 'enabled';
  return isFailureKey && isEnabledVal;
};

const checkSecretHasAuthFailure = (sec: K8sSecretItem): boolean => {
  if (!Array.isArray(sec.secretData)) return false;
  return sec.secretData.some(kv => isAuthFailureEntry(kv.key, kv.value));
};

/**
 * Parses Secret entries for simulation failures like SIMULATE_FAILURE or INVALID_CREDENTIALS.
 */
export const parseSecretSimulationSettings = (secrets: K8sSecretItem[]) => {
  for (const sec of secrets) {
    if (checkSecretHasAuthFailure(sec)) {
      return { hasAuthFailure: true, failingSecretName: sec.name };
    }
  }

  return { hasAuthFailure: false, failingSecretName: '' };
};

const applySecretPodFailure = (
  pod: Node,
  ctx: SimulationContext,
  reason: string,
  logMsg: string
): boolean => {
  let changed = false;
  if (pod.data.status !== 'crashing') {
    if (updateNodeData(ctx, pod.id, { status: 'crashing', simulatedFailureSecret: reason })) {
      changed = true;
    }
  }
  if (ctx.ticks % 3 === 0) {
    try {
      ctx.get()?.addLog?.('warning', logMsg, 'Simulation');
    } catch (error) {
      logger.error('[Secret Simulation] Failed to add log', error);
    }
  }
  return changed;
};

const applySecretPodFailures = (
  childPods: Node[],
  ctx: SimulationContext,
  reason: string,
  logMsg: string
): boolean => {
  let hasChanges = false;
  for (const pod of childPods) {
    if (applySecretPodFailure(pod, ctx, reason, logMsg)) {
      hasChanges = true;
    }
  }
  return hasChanges;
};

const recoverSinglePodFromSecret = (pod: Node, ctx: SimulationContext): boolean => {
  if (pod.data.status !== 'crashing' || !pod.data.simulatedFailureSecret) {
    return false;
  }
  const podData = pod.data as K8sNodeData;
  const nextStatus = isPodReadyConfigured(podData) ? 'ready' : 'pending';
  if (!updateNodeData(ctx, pod.id, { status: nextStatus, simulatedFailureSecret: undefined })) {
    return false;
  }
  try {
    ctx.get()?.addLog?.('info', `[Secret Recovered] Credentials verified. Pod "${pod.data.label || pod.id}" restored to ${nextStatus}!`, 'Simulation');
  } catch (error) {
    logger.error('[Secret Simulation] Failed to add log', error);
  }
  return true;
};

const recoverSecretPodFailures = (
  childPods: Node[],
  ctx: SimulationContext
): boolean => {
  let hasChanges = false;
  for (const pod of childPods) {
    if (recoverSinglePodFromSecret(pod, ctx)) {
      hasChanges = true;
    }
  }
  return hasChanges;
};

/**
 * Evaluates attached Secret settings and authentication dependencies during runtime simulation.
 */
export const checkSecretSimulationStatus = (
  dep: Node,
  ctx: SimulationContext,
  isSecretRequired = false
): { hasChanges: boolean; isBlocked: boolean } => {
  const deploymentData = dep.data as K8sNodeData;
  const secrets = deploymentData.secrets || [];
  const childPods = dep.type === 'Pod' ? [dep] : (ctx.childPodMap?.get(dep.id) || []);
  const podLabel = (dep.data?.label as string) || dep.id;

  const { hasAuthFailure, failingSecretName } = parseSecretSimulationSettings(secrets);

  if (hasAuthFailure) {
    const msg = `[Secret Auth Failure] Invalid credentials in Secret "${failingSecretName}". Pod "${podLabel}" failed authentication (CrashLoopBackOff)!`;
    const hasChanges = applySecretPodFailures(childPods, ctx, failingSecretName, msg);
    return { hasChanges, isBlocked: true };
  }

  const mustHaveSecret = isSecretRequired || Boolean(deploymentData.requireSecret);
  if (mustHaveSecret && secrets.length === 0) {
    const msg = `[Secret Required] Workload "${podLabel}" requires an attached Secret for authentication. Pod set to CrashLoopBackOff!`;
    const hasChanges = applySecretPodFailures(childPods, ctx, 'missing_secret', msg);
    return { hasChanges, isBlocked: true };
  }

  const hasChanges = recoverSecretPodFailures(childPods, ctx);
  return { hasChanges, isBlocked: false };
};

export const checkConfigMapSimulationStatus = (dep: Node, ctx: SimulationContext): { hasChanges: boolean; isBlocked: boolean; effectiveTrafficLimit?: number; requireSecret?: boolean } => {
  const deploymentData = dep.data as K8sNodeData;
  const configMaps = deploymentData.configMaps || [];
  const childPods = dep.type === 'Pod' ? [dep] : (ctx.childPodMap?.get(dep.id) || []);

  const { hasSimulatedFailure, failingCmName, cmPort, maxConnections, logLevel, requireSecret } = parseConfigMapSettings(configMaps);

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
    requireSecret,
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
    } catch (error) {
      logger.error('[ConfigMap Simulation] Failed to add log', error);
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

  const secretResult = checkSecretSimulationStatus(dep, ctx, cmResult.requireSecret);
  if (secretResult.isBlocked) return { hasChanges: cmResult.hasChanges || secretResult.hasChanges };

  const pvcResult = checkPvcReadiness(dep, ctx);
  if (pvcResult.isBlocked) return { hasChanges: pvcResult.hasChanges || cmResult.hasChanges || secretResult.hasChanges };

  const trafficResult = calculateIncomingTraffic(dep, ctx);
  const effectiveTraffic = handleTrafficThrottling(dep, trafficResult.traffic, cmResult.effectiveTrafficLimit, ctx);

  const metricsResult = calculateResourceMetrics(dep, effectiveTraffic, ctx);

  const oomChanged = handleOomCrashes(dep, metricsResult.isOOM, ctx);
  const hpaChanged = handleHpaScaling(dep, metricsResult.cpuPercent, ctx);

  return { hasChanges: cmResult.hasChanges || secretResult.hasChanges || pvcResult.hasChanges || oomChanged || hpaChanged };
};
